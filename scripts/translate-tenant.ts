/**
 * Backfill de tradução EN/ES pra categorias e produtos JÁ EXISTENTES de uma
 * loja — pro fluxo normal (traduzir + aprovar um de cada vez no painel,
 * `src/lib/actions/translate.ts`) não servir quando é preciso uma loja
 * inteira de uma vez antes de um lançamento.
 *
 * Diferença de propósito do fluxo do painel: aqui a tradução já sai como
 * `i18nStatus.<locale> = "approved"` direto (sem passar por "auto"/revisão
 * manual) — é um backfill de lançamento, não o fluxo do dia a dia. Rodar de
 * novo é seguro: sobrescreve com uma tradução nova, não duplica nada.
 *
 * TODO (pós-lançamento, pedido do Felipe): hoje roda tudo incondicionalmente
 * — se alguém editar EN/ES à mão no painel depois do backfill, rodar o
 * script de novo apaga esse ajuste manual sem avisar. Adicionar um
 * `--only-missing` (ou pular item com `i18nStatus.<locale> === "approved"`
 * já setado) antes de virar rotina.
 *
 * "google" (`TRANSLATOR_PROVIDER=google`) usa a Cloud Translation API de
 * verdade, reaproveitando as MESMAS credenciais do Admin SDK
 * (FIREBASE_ADMIN_*) — não importamos `src/lib/translate` (tem
 * `server-only`, que sempre lança fora de um Server Component de verdade,
 * mesmo em scripts Node) — por isso a chamada à API é replicada aqui,
 * igual a `src/lib/translate/google.ts`. "fake" (padrão sem a env var) só
 * prefixa "[EN] "/"[ES] ", pra testar a lógica sem gastar crédito.
 *
 *   npm run translate-tenant -- boaconfe
 */
import { Translate } from "@google-cloud/translate/build/src/v2";
import { adminDb } from "../src/lib/firebase/admin-app";

type TargetLocale = "en" | "es";
const TARGETS: TargetLocale[] = ["en", "es"];

function googleClient(): Translate {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltam FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY no ambiente.");
  }
  return new Translate({ projectId, credentials: { client_email: clientEmail, private_key: privateKey } });
}

async function translateFields(
  fields: Record<string, string>,
  target: TargetLocale,
): Promise<Record<string, string>> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return {};

  if (process.env.TRANSLATOR_PROVIDER !== "google") {
    const prefix = target === "en" ? "[EN] " : "[ES] ";
    return Object.fromEntries(keys.map((key) => [key, `${prefix}${fields[key]}`]));
  }

  const translate = googleClient();
  const values = keys.map((key) => fields[key]!);
  const [translations] = await translate.translate(values, { from: "pt", to: target });
  const translatedValues = Array.isArray(translations) ? translations : [translations];
  return Object.fromEntries(keys.map((key, index) => [key, translatedValues[index]!]));
}

async function translateCategory(tenantId: string, categoryId: string): Promise<void> {
  const ref = adminDb.collection("tenants").doc(tenantId).collection("categories").doc(categoryId);
  const data = (await ref.get()).data() as { name?: { pt?: string } } | undefined;
  const namePt = data?.name?.pt;
  if (!namePt) return;

  for (const target of TARGETS) {
    const translated = await translateFields({ name: namePt }, target);
    await ref.update({ [`name.${target}`]: translated.name, [`i18nStatus.${target}`]: "approved" });
    console.log(`  categoria ${categoryId}: ${target} ok`);
  }
}

type RawVariant = { id: string; name: { pt: string; en?: string; es?: string }; priceCents: number };

async function translateProduct(tenantId: string, productId: string): Promise<void> {
  const ref = adminDb.collection("tenants").doc(tenantId).collection("products").doc(productId);
  const data = (await ref.get()).data() as
    | { name?: { pt?: string }; description?: { pt?: string }; variants?: RawVariant[] }
    | undefined;
  const namePt = data?.name?.pt;
  if (!namePt) return;
  const variants = data?.variants ?? [];

  for (const target of TARGETS) {
    const fields: Record<string, string> = { name: namePt };
    if (data?.description?.pt) fields.description = data.description.pt;
    for (const variant of variants) fields[`variant:${variant.id}`] = variant.name.pt;

    const translated = await translateFields(fields, target);

    const update: Record<string, unknown> = { [`i18nStatus.${target}`]: "approved" };
    for (const [key, value] of Object.entries(translated)) {
      if (key.startsWith("variant:")) continue;
      update[`${key}.${target}`] = value;
    }
    if (variants.length > 0) {
      update.variants = variants.map((variant) => ({
        ...variant,
        name: { ...variant.name, [target]: translated[`variant:${variant.id}`] ?? variant.name.pt },
      }));
    }

    await ref.update(update);
    console.log(`  produto ${productId}: ${target} ok`);
  }
}

async function run(): Promise<void> {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error("uso: npm run translate-tenant -- <tenantId>");
    process.exit(1);
  }

  console.log(`Provider: ${process.env.TRANSLATOR_PROVIDER === "google" ? "google (de verdade)" : "fake (teste)"}`);

  const categoriesSnap = await adminDb.collection("tenants").doc(tenantId).collection("categories").get();
  console.log(`Traduzindo ${categoriesSnap.size} categorias...`);
  for (const doc of categoriesSnap.docs) {
    await translateCategory(tenantId, doc.id);
  }

  const productsSnap = await adminDb.collection("tenants").doc(tenantId).collection("products").get();
  console.log(`Traduzindo ${productsSnap.size} produtos...`);
  for (const doc of productsSnap.docs) {
    await translateProduct(tenantId, doc.id);
  }

  console.log("OK: tradução concluída (EN/ES, já aprovada).");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
