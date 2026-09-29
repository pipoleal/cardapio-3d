import "server-only";
import { FakeModelProvider } from "./fake";
import { MeshyModelProvider } from "./meshy";
import type { AiModel, ModelProvider } from "./provider";
import { SelfHostedModelProvider } from "./selfhosted";

export type { AiModel, CreateModelTaskInput, ModelProvider, ModelTaskResult } from "./provider";
export { cleanupSelfHostedTask } from "./selfhosted";

/** `MODEL_PROVIDER=meshy|selfhosted` usa o provider de verdade correspondente; qualquer outro valor (ou ausente) cai no fake — esse é o padrão em dev. */
export function getModelProvider(): ModelProvider {
  if (process.env.MODEL_PROVIDER === "meshy") return new MeshyModelProvider();
  if (process.env.MODEL_PROVIDER === "selfhosted") return new SelfHostedModelProvider();
  return new FakeModelProvider();
}

/**
 * Hunyuan é só ferramenta de teste do superadmin (custo bem maior, ~US$0,38
 * por geração vs. ~US$0,02 do TRELLIS) — defesa em profundidade: quem
 * decide é sempre o servidor, mesmo que o corpo da requisição peça Hunyuan
 * (a UI de `CaptureFlow.tsx` já esconde a opção pra quem não é superadmin,
 * mas não confiamos só nisso). Usado por `POST /api/models`.
 */
export function resolveEffectiveAiModel(requested: AiModel | undefined, isSuperadmin: boolean): AiModel {
  return isSuperadmin && requested === "hunyuan" ? "hunyuan" : "trellis";
}
