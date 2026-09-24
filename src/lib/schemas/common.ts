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

/**
 * Origem da visita (`?origem=` — ver lib/origin.ts). Lista aberta de
 * propósito (loja, instagram, mesa, vitrine, ou qualquer slug novo que o
 * lojista queira usar num link/QR) — só valida o FORMATO (slug curto),
 * não os valores.
 */
export const originSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,19}$/, "slug curto: minúsculas, números e hífen, começando por letra");
export type Origin = z.infer<typeof originSchema>;

/**
 * "discreet" (padrão): sem CTA fixo, só dicas discretas (ver lib/origin.ts).
 * "prominent": CTA fixo e chamativo. "off": nenhum WhatsApp em lugar nenhum,
 * nem os discretos — pra loja que não usa WhatsApp de jeito nenhum.
 */
export const whatsappModeSchema = z.enum(["discreet", "prominent", "off"]);
export type WhatsappMode = z.infer<typeof whatsappModeSchema>;

/**
 * URL de mídia (capa, logo, GLB/USDZ...) — normalmente uma URL completa,
 * mas em dev com emulador vira um caminho relativo `/__storage/...`
 * (mesma origem, ver lib/storage-url.ts, evita mixed content no HTTPS do
 * celular). `z.string().url()` sozinho rejeitaria o caminho relativo.
 */
export const mediaUrlSchema = z
  .string()
  .refine((value) => value.startsWith("/") || z.string().url().safeParse(value).success, {
    message: "precisa ser uma URL válida ou um caminho relativo (começando com /)",
  });

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
