/**
 * Backfill de tradução EN/ES pra categorias e produtos JÁ EXISTENTES de uma
 * loja — pro fluxo normal (traduzir + aprovar um de cada vez no painel, ou
 * o botão "Traduzir tudo" da página Traduções, que já faz isso pelos itens
 * "missing" — `src/lib/actions/translate.ts`) não servir quando é preciso
 * forçar uma loja inteira de uma vez, ignorando o que já existe.
 *
 * Diferença de propósito do fluxo do painel: aqui a tradução sai direto como
 * `i18nStatus.<locale> = "approved"` (sem passar por "auto"/revisão manual)
 * — é pra backfill/lançamento, não o fluxo do dia a dia.
 *
 * Por padrão PULA qualquer item que já tenha `i18nStatus.<locale>` setado
 * (`"auto"` ou `"approved"` — traduzido automaticamente ao salvar, ou
 * editado/aprovado à mão) — resolve o TODO antigo: rodar de novo não some
 * mais com ajustes manuais sem avisar. Use `--force` pra ignorar isso e
 * sobrescrever tudo incondicionalmente (ex.: depois de uma correção em massa
 * no texto em PT que precisa recomeçar a tradução do zero).
 *
 * "google" (`TRANSLATOR_PROVIDER=google`) usa a Cloud Translation API;
 * "deepl" (`TRANSLATOR_PROVIDER=deepl`, precisa de `DEEPL_API_KEY`) usa o
 * plano grátis do DeepL — ver docs/DECISOES.md sobre a escolha entre os
 * dois. Não importamos `src/lib/translate` (tem `server-only`, que sempre
 * lança fora de um Server Component de verdade, mesmo em scripts Node) —
 * por isso as chamadas são replicadas aqui, iguais a `src/lib/translate/
 * google.ts` e `deepl.ts`. "fake" (padrão sem a env var) só prefixa
 * "[EN] "/"[ES] ", pra testar a lógica sem gastar crédito.
 *
 *   npm run translate-tenant -- boaconfe
 *   npm run translate-tenant -- boaconfe --force
 */
import { Translate } from "@google-cloud/translate/build/src/v2";
import { adminDb } from "../src/lib/firebase/admin-app";

type TargetLocale = "en" | "es";
const TARGETS: TargetLocale[] = ["en", "es"];
const DEEPL_TARGET_LANG: Record<TargetLocale, string> = { en: "EN-US", es: "ES" };

function googleClient(): Translate {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltam FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY no ambiente.");
  }
  return new Translate({ projectId, credentials: { client_email: clientEmail, private_key: privateKey } });
}

async function deeplTranslate(values: string[], target: TargetLocale): Promise<string[]> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error("Falta DEEPL_API_KEY no ambiente.");

  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: values, source_lang: "PT", target_lang: DEEPL_TARGET_LANG[target] }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`DeepL respondeu ${response.status}: ${body.slice(0, 300)}`);
  }
  const data = (await response.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => t.text);
}

async function translateFields(
  fields: Record<string, string>,
  target: TargetLocale,
): Promise<Record<string, string>> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return {};
  const values = keys.map((key) => fields[key]!);

  if (process.env.TRANSLATOR_PROVIDER === "google") {
    const translate = googleClient();
    const [translations] = await translate.translate(values, { from: "pt", to: target });
    const translatedValues = Array.isArray(translations) ? translations : [translations];
    return Object.fromEntries(keys.map((key, index) => [key, translatedValues[index]!]));
  }

  if (process.env.TRANSLATOR_PROVIDER === "deepl") {
    const translatedValues = await deeplTranslate(values, target);
    return Object.fromEntries(keys.map((key, index) => [key, translatedValues[index] ?? fields[key]!]));
  }

  const prefix = target === "en" ? "[EN] " : "[ES] ";
  return Object.fromEntries(keys.map((key) => [key, `${prefix}${fields[key]}`]));
}

async function translateCategory(tenantId: string, categoryId: string, force: boolean): Promise<void> {
  const ref = adminDb.collection("tenants").doc(tenantId).collection("categories").doc(categoryId);
  const data = (await ref.get()).data() as
    | { name?: { pt?: string }; i18nStatus?: Record<string, string> }
    | undefined;
  const namePt = data?.name?.pt;
  if (!namePt) return;

  for (const target of TARGETS) {
    if (!force && data?.i18nStatus?.[target]) {
      console.log(`  categoria ${categoryId}: ${target} já tem tradução (${data.i18nStatus[target]}), pulando`);
      continue;
    }
    const translated = await translateFields({ name: namePt }, target);
    await ref.update({ [`name.${target}`]: translated.name, [`i18nStatus.${target}`]: "approved" });
    console.log(`  categoria ${categoryId}: ${target} ok`);
  }
}

type RawVariant = { id: string; name: { pt: string; en?: string; es?: string }; priceCents: number };

async function translateProduct(tenantId: string, productId: string, force: boolean): Promise<void> {
  const ref = adminDb.collection("tenants").doc(tenantId).collection("products").doc(productId);
  const data = (await ref.get()).data() as
    | {
        name?: { pt?: string };
        description?: { pt?: string };
        variants?: RawVariant[];
        i18nStatus?: Record<string, string>;
      }
    | undefined;
  const namePt = data?.name?.pt;
  if (!namePt) return;
  const variants = data?.variants ?? [];

  for (const target of TARGETS) {
    if (!force && data?.i18nStatus?.[target]) {
      console.log(`  produto ${productId}: ${target} já tem tradução (${data.i18nStatus[target]}), pulando`);
      continue;
    }
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
  const force = process.argv.includes("--force");
  if (!tenantId) {
    console.error("uso: npm run translate-tenant -- <tenantId> [--force]");
    process.exit(1);
  }

  const provider = process.env.TRANSLATOR_PROVIDER;
  console.log(`Provider: ${provider === "google" || provider === "deepl" ? `${provider} (de verdade)` : "fake (teste)"}`);
  console.log(force ? "Modo: --force (sobrescreve tudo, até tradução já aprovada/editada à mão)" : "Modo: pula o que já tem tradução (use --force pra sobrescrever)");

  const categoriesSnap = await adminDb.collection("tenants").doc(tenantId).collection("categories").get();
  console.log(`Traduzindo ${categoriesSnap.size} categorias...`);
  for (const doc of categoriesSnap.docs) {
    await translateCategory(tenantId, doc.id, force);
  }

  const productsSnap = await adminDb.collection("tenants").doc(tenantId).collection("products").get();
  console.log(`Traduzindo ${productsSnap.size} produtos...`);
  for (const doc of productsSnap.docs) {
    await translateProduct(tenantId, doc.id, force);
  }

  console.log("OK: tradução concluída (EN/ES, já aprovada).");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
