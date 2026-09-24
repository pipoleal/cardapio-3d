/** Preço em centavos (inteiro) -> string formatada em BRL pro locale. */
export function formatPriceCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}
