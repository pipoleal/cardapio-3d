import { z } from "zod";

export const userSchema = z.object({
  // doc id (== Firebase Auth uid), populado por quem lê, igual ao "id" de tenant.
  uid: z.string(),
  email: z.string(),
  displayName: z.string().optional(),
  tenantIds: z.array(z.string()),
  createdAt: z.date(),
});

export type User = z.infer<typeof userSchema>;
