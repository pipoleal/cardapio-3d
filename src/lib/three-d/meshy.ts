import "server-only";
import type { CreateModelTaskInput, ModelProvider, ModelTaskResult } from "./provider";

// Confirmado na documentação atual (docs.meshy.ai, 2026-09) — só o endpoint
// Multi-Image to 3D: aceita 1 a 4 imagens, então cobre o caso de 1 foto
// também (sem precisar alternar entre dois endpoints).
const BASE_URL = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";

function apiKey(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) {
    throw new Error("Falta MESHY_API_KEY em .env.local pra usar MODEL_PROVIDER=meshy.");
  }
  return key;
}

type MeshyStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";

function mapStatus(status: MeshyStatus): ModelTaskResult["status"] {
  switch (status) {
    case "PENDING":
      return "queued";
    case "IN_PROGRESS":
      return "processing";
    case "SUCCEEDED":
      return "succeeded";
    default:
      return "failed"; // FAILED | CANCELED
  }
}

export type MeshyTaskResponse = {
  id?: string;
  status: MeshyStatus;
  progress: number;
  model_urls?: { glb?: string; usdz?: string };
  thumbnail_url?: string;
  task_error?: { message?: string };
  consumed_credits?: number;
};

/**
 * Compartilhado entre o polling (`getTask`) e o webhook
 * (`/api/models/webhook/meshy`) — o payload do webhook é "o objeto da
 * task" (confirmado em docs.meshy.ai/en/api/webhooks), mesmo formato do
 * `GET` que este parser já entende.
 */
export function parseMeshyTaskResponse(data: MeshyTaskResponse): ModelTaskResult {
  return {
    status: mapStatus(data.status),
    progress: data.progress,
    outputs: data.model_urls?.glb
      ? { glbUrl: data.model_urls.glb, usdzUrl: data.model_urls.usdz, thumbnailUrl: data.thumbnail_url }
      : undefined,
    error: data.task_error?.message,
    consumedCredits: data.consumed_credits,
  };
}

/**
 * Sem SDK — a API da Meshy é só REST. `target_formats` já pede GLB e USDZ
 * numa tacada só; `enable_pbr: false` por padrão (custa mais crédito,
 * texturizar sem PBR já deve bastar pra um preview de cardápio —
 * reavaliar se a qualidade não convencer no piloto).
 */
export class MeshyModelProvider implements ModelProvider {
  name = "meshy" as const;

  async createTask({ imageUrls }: CreateModelTaskInput): Promise<{ taskId: string }> {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_urls: imageUrls,
        target_formats: ["glb", "usdz"],
        should_texture: true,
        enable_pbr: false,
        topology: "triangle",
        target_polycount: 20000,
      }),
    });
    if (!response.ok) {
      throw new Error(`Meshy createTask falhou (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as { result: string };
    return { taskId: data.result };
  }

  async getTask(taskId: string): Promise<ModelTaskResult> {
    const response = await fetch(`${BASE_URL}/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    if (!response.ok) {
      throw new Error(`Meshy getTask falhou (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as MeshyTaskResponse;
    return parseMeshyTaskResponse(data);
  }
}
