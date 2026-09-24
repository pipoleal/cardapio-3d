import { z } from "zod";
import { i18nStatusSchema, localeSchema, localizedTextSchema, whatsappModeSchema } from "./common";

export const tenantThemeSchema = z.object({
  primary: z.string(),
  background: z.string().optional(),
  font: z.enum(["sans", "serif"]).optional(),
});

export const tenantSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: localizedTextSchema.optional(),
  logoUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  whatsapp: z.string(),
  whatsappTemplate: localizedTextSchema.optional(),
  // "discreet": esconde o CTA fixo do WhatsApp (loja física, o cliente já
  // pode pedir no balcão). "direct": CTA normal, chamativo (padrão online).
  // Origem presencial (lib/origin.ts) sempre força "discreet", não importa
  // esse valor — ele só vale pra origem instagram/direto.
  whatsappMode: whatsappModeSchema,
  instagram: z.string().optional(),
  address: z.string().optional(),
  openingHours: localizedTextSchema.optional(),
  // Gate único pra description + openingHours + whatsappTemplate (ver common.ts).
  i18nStatus: i18nStatusSchema.optional(),
  locales: z.array(localeSchema),
  defaultLocale: localeSchema,
  theme: tenantThemeSchema,
  ownerUids: z.array(z.string()),
  plan: z.enum(["pilot", "free", "pro"]),
  limits: z.object({
    modelsPerMonth: z.number(),
    products: z.number(),
  }),
  active: z.boolean(),
  // Date, não Timestamp: precisa ser serializável pra sair de uma função
  // 'use cache' (lib/tenant.ts). Convertido em lib/firestore-dates.ts.
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Tenant = z.infer<typeof tenantSchema>;
