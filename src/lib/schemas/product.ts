import { z } from "zod";
import { allergenSchema, localizedTextSchema } from "./common";

export const productVariantSchema = z.object({
  id: z.string(),
  name: localizedTextSchema,
  priceCents: z.number().int().nonnegative(),
});

export const productModelSchema = z.object({
  status: z.enum(["none", "processing", "ready", "failed"]),
  glbUrl: z.string().optional(),
  glbPath: z.string().optional(),
  usdzUrl: z.string().optional(),
  usdzPath: z.string().optional(),
  posterUrl: z.string().optional(),
  jobId: z.string().optional(),
  scale: z.number().optional(),
  route: z.enum(["photos_ai", "video_scan"]).optional(),
  costCents: z.number().optional(),
  fileSizeBytes: z.number().optional(),
  updatedAt: z.date().optional(),
});

const i18nFieldStatusSchema = z.enum(["missing", "auto", "approved"]);

export const productSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: localizedTextSchema,
  description: localizedTextSchema.optional(),
  priceCents: z.number().int().nonnegative(),
  variants: z.array(productVariantSchema).optional(),
  servings: z.number().int().positive().optional(),
  allergens: z.array(allergenSchema),
  mayContain: z.array(allergenSchema).optional(),
  tags: z.array(z.enum(["vegan", "sugar_free", "gluten_free", "new", "bestseller"])).optional(),
  coverImage: z
    .object({
      url: z.string(),
      path: z.string(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  model: productModelSchema,
  sliceModel: productModelSchema.optional(),
  i18nStatus: z
    .object({
      en: i18nFieldStatusSchema.optional(),
      es: i18nFieldStatusSchema.optional(),
    })
    .optional(),
  available: z.boolean(),
  // Date "crua" (não filtrada por FRESH_HOURS aqui) — "use cache" não pode
  // fazer essa conta com Date.now(), fica pra renderização (lib/fresh.ts).
  freshFromOvenAt: z.date().nullable().optional(),
  acceptsOrders: z.boolean(),
  order: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Product = z.infer<typeof productSchema>;
