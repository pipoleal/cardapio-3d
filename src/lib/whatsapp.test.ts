import { describe, expect, it } from "vitest";
import { applyProductTemplate, buildProductWhatsappUrl, buildWhatsappUrl } from "./whatsapp";

describe("buildWhatsappUrl", () => {
  it("monta o link wa.me com a mensagem codificada", () => {
    expect(buildWhatsappUrl("5511999999999", "Olá!")).toBe(
      "https://wa.me/5511999999999?text=Ol%C3%A1!",
    );
  });

  it("escapa caracteres especiais (&, ?, quebras de linha)", () => {
    const url = buildWhatsappUrl("5511999999999", "Linha 1\nLinha 2 & mais?");
    expect(url).not.toContain("\n");
    expect(url).not.toContain(" ");
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe("Linha 1\nLinha 2 & mais?");
  });
});

describe("applyProductTemplate", () => {
  const template = "Olá! Quero encomendar {produto} ({variacao})";

  it("substitui produto e variação", () => {
    expect(applyProductTemplate(template, "Bolo de chocolate", "Médio")).toBe(
      "Olá! Quero encomendar Bolo de chocolate (Médio)",
    );
  });

  it("sem variação, remove o parêntese vazio", () => {
    expect(applyProductTemplate(template, "Bolo de chocolate")).toBe(
      "Olá! Quero encomendar Bolo de chocolate",
    );
  });

  it("template sem placeholder de variação funciona normalmente", () => {
    expect(applyProductTemplate("Quero {produto}, por favor", "Croissant")).toBe(
      "Quero Croissant, por favor",
    );
  });
});

describe("buildProductWhatsappUrl", () => {
  it("junta template + link do produto na mensagem", () => {
    const url = buildProductWhatsappUrl({
      phone: "5511999999999",
      template: "Olá! Quero encomendar {produto} ({variacao})",
      productName: "Bolo de chocolate",
      variantName: "Médio",
      productUrl: "https://demo.localhost:3000/en/p/bolo-de-chocolate",
    });
    const message = decodeURIComponent(url.split("text=")[1]!);
    expect(message).toBe(
      "Olá! Quero encomendar Bolo de chocolate (Médio)\nhttps://demo.localhost:3000/en/p/bolo-de-chocolate",
    );
  });

  it("nunca usa um path /loja/<slug>/... no link do produto (responsabilidade de quem chama, mas o teste documenta o formato esperado)", () => {
    const url = buildProductWhatsappUrl({
      phone: "5511999999999",
      template: "Quero {produto}",
      productName: "Croissant",
      productUrl: "https://demo.localhost:3000/p/croissant",
    });
    expect(decodeURIComponent(url)).not.toContain("/loja/");
  });
});
