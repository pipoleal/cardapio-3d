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

export type BuildProductWhatsappUrlParams = {
  phone: string;
  /** Template já no locale certo. */
  template: string;
  productName: string;
  variantName?: string;
  /** Link público do produto (ex.: https://demo.<dominio>/en/p/bolo) — nunca /loja/<slug>/... */
  productUrl: string;
};

export function buildProductWhatsappUrl({
  phone,
  template,
  productName,
  variantName,
  productUrl,
}: BuildProductWhatsappUrlParams): string {
  const message = applyProductTemplate(template, productName, variantName);
  return buildWhatsappUrl(phone, `${message}\n${productUrl}`);
}
