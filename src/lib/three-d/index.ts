import "server-only";
import { FakeModelProvider } from "./fake";
import { MeshyModelProvider } from "./meshy";
import type { ModelProvider } from "./provider";

export type { CreateModelTaskInput, ModelProvider, ModelTaskResult } from "./provider";

/** `MODEL_PROVIDER=meshy` usa a API de verdade; qualquer outro valor (ou ausente) cai no fake — esse é o padrão em dev. */
export function getModelProvider(): ModelProvider {
  return process.env.MODEL_PROVIDER === "meshy" ? new MeshyModelProvider() : new FakeModelProvider();
}
