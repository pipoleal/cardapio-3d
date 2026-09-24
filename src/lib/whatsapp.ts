import type { Locale } from "./schemas/common";

/**
 * Monta links `wa.me`. Não sabe nada de i18n — quem chama já resolveu o
 * template/mensagem no locale certo (via next-intl / resolveLocalizedText).
 */
export function buildWhatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Substitui `{produto}`/`{variacao}` no template da loja
 * (`tenant.whatsappTemplate`, ex.: "Olá! Quero encomendar {produto} ({variacao})").
 * Sem variante, remove o "()" vazio que sobraria em vez de deixar feio.
 */
export function applyProductTemplate(
  template: string,
  productName: string,
  variantName?: string,
): string {
  const withValues = template
    .replaceAll("{produto}", productName)
    .replaceAll("{variacao}", variantName ?? "");

  return withValues
    .replace(/\s*\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Rótulo do idioma do cliente pra lojista (que lê em português) — sempre em
// pt, não importa o locale do cliente. Ver buildProductWhatsappMessage.
const CLIENT_LOCALE_LABEL_PT: Record<Locale, string> = {
  pt: "português",
  en: "inglês",
  es: "espanhol",
};

export type BuildProductWhatsappMessageParams = {
  /** Template já resolvido no locale do CLIENTE — a saudação sempre fica nesse idioma. */
  template: string;
  clientLocale: Locale;
  /** `tenant.defaultLocale` — normalmente "pt". */
  storeDefaultLocale: Locale;
  /** Nome do produto resolvido no locale do cliente. */
  productName: string;
  /** Nome do produto resolvido no locale padrão da loja (o que a lojista reconhece). */
  productNameInStoreLocale: string;
  variantName?: string;
  variantNameInStoreLocale?: string;
};

/**
 * Mensagem híbrida: a saudação do template fica sempre no idioma do
 * cliente, mas quando esse idioma não é o padrão da loja, o nome do
 * produto/variação vai no idioma da loja (o que a lojista reconhece no
 * sistema/cozinha) + uma linha avisando o idioma do cliente — assim a
 * lojista (que lê em português) entende o pedido mesmo sem falar inglês ou
 * espanhol. Quando o cliente já está no idioma padrão da loja (o caso
 * comum: pt), a mensagem fica exatamente como sempre foi.
 */
export function buildProductWhatsappMessage({
  template,
  clientLocale,
  storeDefaultLocale,
  productName,
  productNameInStoreLocale,
  variantName,
  variantNameInStoreLocale,
}: BuildProductWhatsappMessageParams): string {
  const isHybrid = clientLocale !== storeDefaultLocale;

  const message = isHybrid
    ? applyProductTemplate(template, productNameInStoreLocale, variantNameInStoreLocale)
    : applyProductTemplate(template, productName, variantName);

  if (!isHybrid) return message;

  return `${message}\nCliente em ${CLIENT_LOCALE_LABEL_PT[clientLocale]}`;
}

export type BuildProductWhatsappUrlParams = BuildProductWhatsappMessageParams & {
  phone: string;
  /** Link público do produto (ex.: https://demo.<dominio>/en/p/bolo) — nunca /loja/<slug>/... */
  productUrl: string;
};

export function buildProductWhatsappUrl({
  phone,
  productUrl,
  ...messageParams
}: BuildProductWhatsappUrlParams): string {
  const message = buildProductWhatsappMessage(messageParams);
  return buildWhatsappUrl(phone, `${message}\n${productUrl}`);
}
