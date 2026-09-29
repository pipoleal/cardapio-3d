export type AiModel = "trellis" | "hunyuan";

export type CreateModelTaskInput = {
  /** URLs públicas OU data URIs base64 (a Meshy aceita os dois — em dev com emulador, o servidor não alcança URLs do emulador, então usamos base64; ver lib/three-d/meshy.ts). Ignorado quando `videoUrl` está presente. */
  imageUrls: string[];
  /** Só o provider self-hosted usa — vídeo de escaneamento (10-15s), o worker extrai os melhores quadros. Mutuamente exclusivo com `imageUrls` (Meshy/fake ignoram). */
  videoUrl?: string;
  /** Só o provider self-hosted usa — qual modelo de IA rodar (TRELLIS padrão, Hunyuan só teste-superadmin). Meshy/fake ignoram. */
  aiModel?: AiModel;
};

export type ModelTaskResult = {
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  outputs?: { glbUrl: string; usdzUrl?: string; thumbnailUrl?: string };
  error?: string;
  /** Meshy: créditos consumidos, convertidos em centavos via MESHY_CREDIT_PRICE_CENTS. */
  consumedCredits?: number;
  /** Self-hosted: custo real já em centavos (tempo de GPU × preço), sem precisar de conversão. */
  costCents?: number;
};

export interface ModelProvider {
  name: "meshy" | "fake" | "selfhosted";
  createTask(input: CreateModelTaskInput): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<ModelTaskResult>;
}
