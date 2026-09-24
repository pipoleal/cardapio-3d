export type CreateModelTaskInput = {
  /** URLs públicas OU data URIs base64 (a Meshy aceita os dois — em dev com emulador, o servidor não alcança URLs do emulador, então usamos base64; ver lib/three-d/meshy.ts). */
  imageUrls: string[];
};

export type ModelTaskResult = {
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  outputs?: { glbUrl: string; usdzUrl?: string; thumbnailUrl?: string };
  error?: string;
  consumedCredits?: number;
};

export interface ModelProvider {
  name: "meshy" | "fake";
  createTask(input: CreateModelTaskInput): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<ModelTaskResult>;
}
