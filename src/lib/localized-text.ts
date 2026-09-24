import type { Locale, LocalizedText } from "./schemas/common";

type I18nFieldStatus = "missing" | "auto" | "approved";
type I18nStatus = Partial<Record<Exclude<Locale, "pt">, I18nFieldStatus>>;

/**
 * en/es só aparecem pro cliente quando aprovados pelo lojista
 * (`i18nStatus[locale] === "approved"`); senão cai pro pt.
 * docs/ARQUITETURA.md, "Internacionalização".
 */
export function resolveLocalizedText(
  text: LocalizedText,
  locale: Locale,
  i18nStatus?: I18nStatus,
): string {
  if (locale === "pt") return text.pt;

  const status = i18nStatus?.[locale];
  const value = text[locale];
  return status === "approved" && value ? value : text.pt;
}
