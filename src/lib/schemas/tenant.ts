import { z } from "zod";
import { localeSchema, localizedTextSchema } from "./common";

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
  instagram: z.string().optional(),
  address: z.string().optional(),
  openingHours: localizedTextSchema.optional(),
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
