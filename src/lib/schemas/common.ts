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
