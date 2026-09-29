import "server-only";
import type { CreateModelTaskInput, ModelProvider, ModelTaskResult } from "./provider";

function workerUrl(): string {
  const url = process.env.SELFHOSTED_WORKER_URL;
  if (!url) {
    throw new Error("Falta SELFHOSTED_WORKER_URL em .env.local pra usar MODEL_PROVIDER=selfhosted.");
  }
  return url;
}

function apiSecret(): string {
  const secret = process.env.SELFHOSTED_API_SECRET;
  if (!secret) {
    throw new Error("Falta SELFHOSTED_API_SECRET em .env.local pra usar MODEL_PROVIDER=selfhosted.");
  }
  return secret;
}

/** Mesma ideia de lib/three-d/fake.ts — o worker precisa de uma URL https pública pra chamar de volta. */
function appOrigin(): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const protocol = rootDomain.includes(":") ? "http" : "https";
  return `${protocol}://${rootDomain}`;
}

/**
 * URL completa do webhook (já com o segredo embutido, igual configuraríamos
 * no dashboard de um provider de terceiro) — o worker não sabe nem precisa
 * saber o valor de `SELFHOSTED_WEBHOOK_SECRET`, só recebe essa URL pronta e
 * faz um POST nela quando terminar. Mesma rota genérica `[provider]` que já
 * atende a Meshy (`docs/PIPELINE-3D.md`).
 */
function webhookUrl(): string {
  const secret = process.env.SELFHOSTED_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Falta SELFHOSTED_WEBHOOK_SECRET em .env.local pra usar MODEL_PROVIDER=selfhosted.");
  }
  return `${appOrigin()}/api/models/webhook/selfhosted?token=${encodeURIComponent(secret)}`;
}

type WorkerStatusResponse = {
  status: "queued" | "processing" | "succeeded" | "failed";
  progress?: number;
  outputs?: { glbUrl: string; posterUrl?: string };
  costCents?: number;
  error?: string;
};

function toModelTaskResult(data: WorkerStatusResponse): ModelTaskResult {
  return {
    status: data.status,
    progress: data.progress ?? (data.status === "succeeded" ? 100 : data.status === "failed" ? 0 : 0),
    outputs: data.outputs
      ? { glbUrl: data.outputs.glbUrl, thumbnailUrl: data.outputs.posterUrl }
      : undefined,
    error: data.error,
    costCents: data.costCents,
  };
}

/**
 * Worker próprio (TRELLIS/Hunyuan3D-2mv-turbo, `cardapio-3d-worker` na
 * Modal) — mesmo contrato createTask/getTask da Meshy, só que HTTP direto
 * contra o serviço que a gente controla (ver docs/DECISOES.md). O worker
 * expõe os arquivos como URL temporária (`/download`, token com TTL) —
 * `finalize.ts` baixa e sobe pro nosso Storage exatamente como já faz com
 * a Meshy, sem nenhuma mudança lá.
 */
export class SelfHostedModelProvider implements ModelProvider {
  name = "selfhosted" as const;

  async createTask({ imageUrls, videoUrl, aiModel }: CreateModelTaskInput): Promise<{ taskId: string }> {
    const response = await fetch(`${workerUrl()}/create?token=${encodeURIComponent(apiSecret())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_urls: videoUrl ? undefined : imageUrls,
        video_url: videoUrl,
        ai_model: aiModel ?? "trellis",
        webhook_url: webhookUrl(),
      }),
    });
    if (!response.ok) {
      throw new Error(`Worker self-hosted createTask falhou (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as { task_id: string };
    return { taskId: data.task_id };
  }

  async getTask(taskId: string): Promise<ModelTaskResult> {
    const url = `${workerUrl()}/status?task_id=${encodeURIComponent(taskId)}&token=${encodeURIComponent(apiSecret())}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Worker self-hosted getTask falhou (${response.status}): ${await response.text()}`);
    }
    return toModelTaskResult((await response.json()) as WorkerStatusResponse);
  }
}

/**
 * Chamado por `jobs.ts` assim que confirma a cópia pro Blob — libera o
 * espaço no Volume do worker sem esperar o token de download expirar
 * (docs/DECISOES.md). Melhor esforço: erro aqui nunca derruba o finalize,
 * só fica em log (o arquivo só fica parado no Volume até uma limpeza
 * manual, sem risco de segurança — o token já tem TTL próprio).
 */
export async function cleanupSelfHostedTask(taskId: string): Promise<void> {
  try {
    const response = await fetch(`${workerUrl()}/cleanup?token=${encodeURIComponent(apiSecret())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId }),
    });
    if (!response.ok) {
      console.error(`cleanupSelfHostedTask: worker respondeu ${response.status} pra task ${taskId}`);
    }
  } catch (err) {
    console.error(`cleanupSelfHostedTask: falhou pra task ${taskId}`, err);
  }
}
