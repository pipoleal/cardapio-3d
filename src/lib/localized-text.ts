import type { I18nStatus, Locale, LocalizedText } from "./schemas/common";

/**
 * en/es aparecem pro cliente assim que traduzidos — "auto" (automático,
 * ainda não revisado) ou "approved" (revisado/editado à mão); só cai pro
 * pt quando o campo nunca foi traduzido ("missing"/ausente). docs/
 * ARQUITETURA.md, "Internacionalização"; docs/DECISOES.md sobre a mudança
 * de "só approved" pra "auto já conta".
 */
export function resolveLocalizedText(
  text: LocalizedText,
  locale: Locale,
  i18nStatus?: I18nStatus,
): string {
  if (locale === "pt") return text.pt;

  const status = i18nStatus?.[locale];
  const value = text[locale];
  return (status === "approved" || status === "auto") && value ? value : text.pt;
}
