import { describe, expect, it } from "vitest";
import { parseUploadPathname } from "./pathnames";

describe("parseUploadPathname", () => {
  it("aceita o formato de logo", () => {
    expect(parseUploadPathname("tenants/demo/branding/logo.webp")).toEqual({
      kind: "logo",
      tenantId: "demo",
    });
  });

  it("aceita o formato de capa", () => {
    expect(parseUploadPathname("tenants/demo/products/abc123/cover.webp")).toEqual({
      kind: "cover",
      tenantId: "demo",
      productId: "abc123",
    });
  });

  it("aceita o formato de foto de captura", () => {
    expect(parseUploadPathname("tenants/demo/products/abc123/captures/job1/frente.webp")).toEqual({
      kind: "capture",
      tenantId: "demo",
      productId: "abc123",
      captureId: "job1",
      pose: "frente",
    });
  });

  it("aceita o formato de modelo 3D (glb e usdz)", () => {
    expect(parseUploadPathname("tenants/demo/products/abc123/models/model.glb")).toEqual({
      kind: "model",
      tenantId: "demo",
      productId: "abc123",
      ext: "glb",
    });
    expect(parseUploadPathname("tenants/demo/products/abc123/models/model.usdz")).toEqual({
      kind: "model",
      tenantId: "demo",
      productId: "abc123",
      ext: "usdz",
    });
  });

  it("rejeita caminho com ../ tentando escapar do tenant", () => {
    expect(parseUploadPathname("tenants/demo/../outra-loja/branding/logo.webp")).toBeNull();
  });

  it("rejeita caminho de outro formato de arquivo (não webp) pra capa", () => {
    expect(parseUploadPathname("tenants/demo/products/abc123/cover.png")).toBeNull();
  });

  it("rejeita pathname que não bate com nenhum padrão conhecido", () => {
    expect(parseUploadPathname("qualquer/coisa.txt")).toBeNull();
    expect(parseUploadPathname("tenants/demo/secrets.json")).toBeNull();
  });

  it("rejeita extensão de modelo fora de glb/usdz", () => {
    expect(parseUploadPathname("tenants/demo/products/abc123/models/model.exe")).toBeNull();
  });
});
