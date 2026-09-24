import { z } from "zod";

export const modelJobSchema = z.object({
  id: z.string(),
  productId: z.string(),
  provider: z.enum(["meshy", "fake"]),
  providerTaskId: z.string(),
  mode: z.enum(["single", "multi"]),
  inputPaths: z.array(z.string()),
  status: z.enum(["queued", "processing", "succeeded", "failed", "canceled"]),
  progress: z.number().int().min(0).max(100),
  target: z.enum(["model", "sliceModel"]),
  costCents: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.date(),
  finishedAt: z.date().optional(),
  // Trava de transação: só quem consegue virar isso de false->true é quem
  // finaliza (baixa da Meshy, sobe pro nosso Storage) — ver
  // docs/PIPELINE-3D.md, "Idempotência".
  finalizing: z.boolean().optional(),
});

export type ModelJob = z.infer<typeof modelJobSchema>;
