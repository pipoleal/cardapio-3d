"use server";

import type { DocumentReference, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { updateTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { Tenant } from "@/lib/schemas/tenant";
import { getTranslator } from "@/lib/translate";
import { assertTenantOwner } from "./guard";

type EntityKind = "tenant" | "category" | "product";
type TargetLocale = "en" | "es";
type RawVariant = { id: string; name: { pt: string; en?: string; es?: string }; priceCents: number };

function entityRef(tenantId: string, kind: EntityKind, entityId: string): DocumentReference {
  if (kind === "tenant") return adminDb.collection("tenants").doc(tenantId);
  const sub = kind === "category" ? "categories" : "products";
  return adminDb.collection("tenants").doc(tenantId).collection(sub).doc(entityId);
}

/**
 * Junta os campos traduzíveis da entidade inteira numa tacada só — nome +
 * descrição + nome de CADA variação (produto); nome (categoria); descrição
 * + horário + template do WhatsApp (loja) — mesmo agrupamento do
 * `i18nStatus` (docs/MODELO-DE-DADOS.md, "Traduções").
 */
async function loadFields(
  ref: DocumentReference,
  kind: EntityKind,
): Promise<{ fields: Record<string, string>; variants: RawVariant[] }> {
  const doc = await ref.get();
  const data = (doc.data() ?? {}) as Record<string, { pt?: string } | undefined> & {
    variants?: RawVariant[];
  };

  if (kind === "tenant") {
    const fields: Record<string, string> = {};
    if (data.description?.pt) fields.description = data.description.pt;
    if (data.openingHours?.pt) fields.openingHours = data.openingHours.pt;
    if (data.whatsappTemplate?.pt) fields.whatsappTemplate = data.whatsappTemplate.pt;
    return { fields, variants: [] };
  }

  if (kind === "category") {
    return { fields: { name: data.name?.pt ?? "" }, variants: [] };
  }

  const fields: Record<string, string> = { name: data.name?.pt ?? "" };
  if (data.description?.pt) fields.description = data.description.pt;
  const variants = data.variants ?? [];
  for (const variant of variants) {
    fields[`variant:${variant.id}`] = variant.name.pt;
  }
  return { fields, variants };
}

/**
 * Núcleo reaproveitado por todo caminho que traduz (clique manual
 * "Traduzir", auto-tradução ao salvar, "Traduzir tudo") — sempre grava
 * como `"auto"` (nunca aprova sozinho; aprovar continua sendo uma ação à
 * parte). Não mexe no tag de cache — quem chama decide quando invalidar
 * (pode ser uma vez só, depois de traduzir vários itens em lote).
 */
async function runTranslation(ref: DocumentReference, kind: EntityKind, targets: TargetLocale[]): Promise<void> {
  const { fields, variants } = await loadFields(ref, kind);
  if (Object.keys(fields).length === 0) return;

  for (const target of targets) {
    const translated = await getTranslator().translateFields(fields, target);

    const update: Record<string, unknown> = { [`i18nStatus.${target}`]: "auto" };
    for (const [key, value] of Object.entries(translated)) {
      if (key.startsWith("variant:")) continue; // tratado abaixo, junto no array `variants`
      update[`${key}.${target}`] = value;
    }
    if (variants.length > 0) {
      update.variants = variants.map((variant) => ({
        ...variant,
        name: { ...variant.name, [target]: translated[`variant:${variant.id}`] ?? variant.name.pt },
      }));
    }

    await ref.update(update);
  }
}

export async function translateEntity(
  tenantId: string,
  kind: EntityKind,
  entityId: string,
  target: TargetLocale,
): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  await runTranslation(entityRef(tenant.id, kind, entityId), kind, [target]);
  updateTag(`tenant:${tenant.id}`);
}

/** Só vira `"approved"` — nenhuma tradução nova é feita aqui. */
export async function approveTranslation(
  tenantId: string,
  kind: EntityKind,
  entityId: string,
  target: TargetLocale,
): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  await entityRef(tenant.id, kind, entityId).update({ [`i18nStatus.${target}`]: "approved" });
  updateTag(`tenant:${tenant.id}`);
}

/**
 * Chamada pelas Server Actions de criar/editar produto, categoria e
 * configurações da loja, logo depois de gravar — nunca lança: quem chama
 * decide o que fazer com o resultado (toast de aviso, sem desfazer o
 * save já feito). Traduz pros idiomas ATIVOS da loja (`tenant.locales`,
 * sempre inclui "pt" — excluído aqui) além do pt; loja só com pt ativo
 * não faz nada (`attempted: false`).
 */
export async function autoTranslateEntity(
  tenant: Pick<Tenant, "id" | "locales">,
  kind: EntityKind,
  entityId: string,
): Promise<{ attempted: boolean; ok: boolean }> {
  const targets = tenant.locales.filter((locale): locale is TargetLocale => locale !== "pt");
  if (targets.length === 0) return { attempted: false, ok: true };

  try {
    await runTranslation(entityRef(tenant.id, kind, entityId), kind, targets);
    updateTag(`tenant:${tenant.id}`);
    return { attempted: true, ok: true };
  } catch {
    return { attempted: true, ok: false };
  }
}

/**
 * "Traduzir tudo" (botão da página Traduções) — só os itens "missing"
 * (nunca traduzidos) pros idiomas ativos da loja; pula qualquer item já
 * "auto" ou "approved" (resolve o TODO de scripts/translate-tenant.ts:
 * nunca sobrescreve uma tradução — automática ou editada à mão — que já
 * existe). Segue mesmo se um item falhar, pra não travar os outros.
 */
export async function translateAllMissing(tenantId: string): Promise<{ translated: number; failed: number }> {
  const { tenant } = await assertTenantOwner(tenantId);
  const targets = tenant.locales.filter((locale): locale is TargetLocale => locale !== "pt");
  if (targets.length === 0) return { translated: 0, failed: 0 };

  let translated = 0;
  let failed = 0;

  const [categoriesSnap, productsSnap] = await Promise.all([
    adminDb.collection("tenants").doc(tenant.id).collection("categories").get(),
    adminDb.collection("tenants").doc(tenant.id).collection("products").get(),
  ]);

  const entries: Array<{ doc: QueryDocumentSnapshot; kind: EntityKind }> = [
    ...categoriesSnap.docs.map((doc) => ({ doc, kind: "category" as const })),
    ...productsSnap.docs.map((doc) => ({ doc, kind: "product" as const })),
  ];

  for (const { doc, kind } of entries) {
    const i18nStatus = (doc.data().i18nStatus ?? {}) as Record<string, string | undefined>;
    const missingTargets = targets.filter((target) => {
      const status = i18nStatus[target];
      return !status || status === "missing";
    });
    if (missingTargets.length === 0) continue;

    try {
      await runTranslation(doc.ref, kind, missingTargets);
      translated += 1;
    } catch {
      failed += 1;
    }
  }

  if (translated > 0) updateTag(`tenant:${tenant.id}`);
  return { translated, failed };
}
