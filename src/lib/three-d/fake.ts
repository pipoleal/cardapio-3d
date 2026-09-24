import "server-only";
import type { ModelProvider, ModelTaskResult } from "./provider";

const QUEUED_MS = 3000;
const PROCESSING_MS = 8000;

function appOrigin(): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const protocol = rootDomain.includes(":") ? "http" : "https";
  return `${protocol}://${rootDomain}`;
}

/**
 * Sem estado em memória — o horário de criação vai codificado no próprio
 * taskId (`fake-<timestamp>`), então funciona igual depois de um reload
 * do servidor de dev. Os outputs apontam pro `.gltf` de amostra deste
 * mesmo app (public/sample-models/, gerado por
 * scripts/generate-sample-model.ts) — o `GET /api/models/[jobId]` baixa e
 * sobe pro nosso Storage exatamente como faria com a Meshy de verdade
 * (mesmo caminho de finalização, sem atalho). Sem URL de USDZ: não dá
 * pra fabricar um USDZ válido à mão, então em modo fake o AR não aparece
 * no iPhone — pra validar isso, rodar uma vez com MODEL_PROVIDER=meshy.
 */
export class FakeModelProvider implements ModelProvider {
  name = "fake" as const;

  async createTask(): Promise<{ taskId: string }> {
    return { taskId: `fake-${Date.now()}` };
  }

  async getTask(taskId: string): Promise<ModelTaskResult> {
    const createdAt = Number(taskId.replace("fake-", ""));
    const elapsed = Date.now() - (Number.isFinite(createdAt) ? createdAt : 0);

    if (elapsed < QUEUED_MS) return { status: "queued", progress: 5 };
    if (elapsed < PROCESSING_MS) return { status: "processing", progress: 60 };

    return {
      status: "succeeded",
      progress: 100,
      outputs: {
        glbUrl: `${appOrigin()}/sample-models/doce.gltf`,
        thumbnailUrl: `${appOrigin()}/sample-models/doce-poster.svg`,
      },
      consumedCredits: 0,
    };
  }
}
