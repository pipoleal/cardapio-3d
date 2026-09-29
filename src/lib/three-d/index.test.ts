import { afterEach, describe, expect, it, vi } from "vitest";

// `server-only` lança fora de um Server Component de verdade (Next.js troca
// isso por um no-op via resolve condition do bundler) — o vitest não tem
// esse contexto, então neutraliza só aqui, sem tirar a proteção real do
// código (o import continua lá em lib/three-d/index.ts).
vi.mock("server-only", () => ({}));

const { getModelProvider, resolveEffectiveAiModel } = await import("./index");

describe("getModelProvider", () => {
  const original = process.env.MODEL_PROVIDER;
  afterEach(() => {
    if (original === undefined) delete process.env.MODEL_PROVIDER;
    else process.env.MODEL_PROVIDER = original;
  });

  it("usa fake por padrão (sem MODEL_PROVIDER)", () => {
    delete process.env.MODEL_PROVIDER;
    expect(getModelProvider().name).toBe("fake");
  });

  it("usa fake pra qualquer valor desconhecido", () => {
    process.env.MODEL_PROVIDER = "algo-invalido";
    expect(getModelProvider().name).toBe("fake");
  });

  it("usa meshy quando MODEL_PROVIDER=meshy", () => {
    process.env.MODEL_PROVIDER = "meshy";
    expect(getModelProvider().name).toBe("meshy");
  });

  it("usa selfhosted quando MODEL_PROVIDER=selfhosted", () => {
    process.env.MODEL_PROVIDER = "selfhosted";
    expect(getModelProvider().name).toBe("selfhosted");
  });
});

describe("resolveEffectiveAiModel", () => {
  it("força trellis pra quem não é superadmin, mesmo pedindo hunyuan", () => {
    expect(resolveEffectiveAiModel("hunyuan", false)).toBe("trellis");
  });

  it("deixa hunyuan só pra superadmin", () => {
    expect(resolveEffectiveAiModel("hunyuan", true)).toBe("hunyuan");
  });

  it("trellis é o padrão quando nada foi pedido", () => {
    expect(resolveEffectiveAiModel(undefined, true)).toBe("trellis");
    expect(resolveEffectiveAiModel(undefined, false)).toBe("trellis");
  });
});
