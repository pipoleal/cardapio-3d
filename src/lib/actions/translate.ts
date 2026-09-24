"use server";

import type { DocumentReference } from "firebase-admin/firestore";
import { updateTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
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

export async function translateEntity(
  tenantId: string,
  kind: EntityKind,
  entityId: string,
  target: TargetLocale,
): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const ref = entityRef(tenant.id, kind, entityId);
  const { fields, variants } = await loadFields(ref, kind);

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
