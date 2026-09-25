import { z } from "zod";
import { localeSchema, originSchema } from "./common";

// tenantId/productId viram segmento de caminho de documento e nome de
// campo (dot-path) no Firestore — nunca aceitar "/", "." nem espaço.
export const firestoreIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, "id inválido");

export const trackEventSchema = z.enum([
  "menu_view",
  "product_view",
  "model_open",
  "ar_open",
  "whatsapp_click",
]);
export type TrackEvent = z.infer<typeof trackEventSchema>;

const EVENTS_WITH_REQUIRED_PRODUCT = new Set<TrackEvent>(["product_view", "model_open", "ar_open"]);

export const trackBodySchema = z
  .object({
    tenantId: firestoreIdSchema,
    event: trackEventSchema,
    // Ausente em menu_view e no CTA geral do WhatsApp (não ligado a um produto).
    productId: firestoreIdSchema.optional(),
    locale: localeSchema,
    origin: originSchema,
  })
  .refine((body) => !EVENTS_WITH_REQUIRED_PRODUCT.has(body.event) || body.productId, {
    message: "productId é obrigatório pra este evento",
    path: ["productId"],
  });
