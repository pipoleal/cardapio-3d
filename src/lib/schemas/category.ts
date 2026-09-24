import { z } from "zod";
import { localizedTextSchema } from "./common";

export const categorySchema = z.object({
  id: z.string(),
  name: localizedTextSchema,
  order: z.number(),
  active: z.boolean(),
});

export type Category = z.infer<typeof categorySchema>;
