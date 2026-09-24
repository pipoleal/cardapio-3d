import { z } from "zod";

export const localeSchema = z.enum(["pt", "en", "es"]);
export type Locale = z.infer<typeof localeSchema>;

// pt é sempre obrigatório; en/es são preenchidos por tradução automática e
// só aparecem pro cliente quando aprovados (ver i18nStatus em product.ts).
export const localizedTextSchema = z.object({
  pt: z.string(),
  en: z.string().optional(),
  es: z.string().optional(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const i18nFieldStatusSchema = z.enum(["missing", "auto", "approved"]);
export type I18nFieldStatus = z.infer<typeof i18nFieldStatusSchema>;

/**
 * Aprovação de tradução por ENTIDADE (tenant, categoria ou produto), não
 * por campo: um `i18nStatus[locale] === "approved"` libera TODOS os
 * `LocalizedText` daquela entidade pro cliente (no produto: nome,
 * descrição e nomes das variações juntos; no tenant: descrição, horário
 * de funcionamento e template do WhatsApp juntos). Ver
 * docs/MODELO-DE-DADOS.md, "Traduções".
 */
export const i18nStatusSchema = z.object({
  en: i18nFieldStatusSchema.optional(),
  es: i18nFieldStatusSchema.optional(),
});
export type I18nStatus = z.infer<typeof i18nStatusSchema>;

export const allergenSchema = z.enum([
  "gluten",
  "lactose",
  "milk",
  "egg",
  "peanut",
  "tree_nuts",
  "soy",
  "sesame",
  "fish",
  "shellfish",
  "sulfites",
]);
export type Allergen = z.infer<typeof allergenSchema>;
