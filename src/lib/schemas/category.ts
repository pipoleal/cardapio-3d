import { z } from "zod";
import { i18nStatusSchema, localizedTextSchema } from "./common";

export const categorySchema = z.object({
  id: z.string(),
  name: localizedTextSchema,
  i18nStatus: i18nStatusSchema.optional(),
  order: z.number(),
  active: z.boolean(),
});

export type Category = z.infer<typeof categorySchema>;
