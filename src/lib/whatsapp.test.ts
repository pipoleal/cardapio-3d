import { describe, expect, it } from "vitest";
import {
  applyProductTemplate,
  buildProductWhatsappMessage,
  buildProductWhatsappUrl,
  buildWhatsappUrl,
} from "./whatsapp";

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

describe("buildProductWhatsappMessage", () => {
  const template = "Olá! Quero encomendar {produto} ({variacao})";

  it("cliente no idioma padrão da loja (pt/pt): mensagem normal, sem linha extra", () => {
    const message = buildProductWhatsappMessage({
      template,
      clientLocale: "pt",
      storeDefaultLocale: "pt",
      productName: "Bolo de chocolate",
      productNameInStoreLocale: "Bolo de chocolate",
      variantName: "Médio",
      variantNameInStoreLocale: "Médio",
    });
    expect(message).toBe("Olá! Quero encomendar Bolo de chocolate (Médio)");
  });

  it("cliente em inglês (loja padrão pt): saudação em inglês, produto/variação em pt + linha 'Cliente em inglês'", () => {
    const message = buildProductWhatsappMessage({
      template: "Hi! I'd like to order {produto} ({variacao})",
      clientLocale: "en",
      storeDefaultLocale: "pt",
      productName: "Chocolate cake",
      productNameInStoreLocale: "Bolo de chocolate",
      variantName: "Medium",
      variantNameInStoreLocale: "Médio",
    });
    expect(message).toBe(
      "Hi! I'd like to order Bolo de chocolate (Médio)\nCliente em inglês",
    );
  });

  it("cliente em espanhol (loja padrão pt): saudação em espanhol, produto/variação em pt + linha 'Cliente em espanhol'", () => {
    const message = buildProductWhatsappMessage({
      template: "¡Hola! Quiero pedir {produto} ({variacao})",
      clientLocale: "es",
      storeDefaultLocale: "pt",
      productName: "Torta de chocolate",
      productNameInStoreLocale: "Bolo de chocolate",
      variantName: "Mediana",
      variantNameInStoreLocale: "Médio",
    });
    expect(message).toBe(
      "¡Hola! Quiero pedir Bolo de chocolate (Médio)\nCliente em espanhol",
    );
  });

  it("sem variação (híbrido): remove o parêntese vazio normalmente", () => {
    const message = buildProductWhatsappMessage({
      template: "Hi! I'd like to order {produto} ({variacao})",
      clientLocale: "en",
      storeDefaultLocale: "pt",
      productName: "Croissant",
      productNameInStoreLocale: "Croissant",
    });
    expect(message).toBe("Hi! I'd like to order Croissant\nCliente em inglês");
  });
});

describe("buildProductWhatsappUrl", () => {
  it("junta template + link do produto na mensagem", () => {
    const url = buildProductWhatsappUrl({
      phone: "5511999999999",
      template: "Olá! Quero encomendar {produto} ({variacao})",
      clientLocale: "pt",
      storeDefaultLocale: "pt",
      productName: "Bolo de chocolate",
      productNameInStoreLocale: "Bolo de chocolate",
      variantName: "Médio",
      variantNameInStoreLocale: "Médio",
      productUrl: "https://demo.localhost:3000/p/bolo-de-chocolate",
    });
    const message = decodeURIComponent(url.split("text=")[1]!);
    expect(message).toBe(
      "Olá! Quero encomendar Bolo de chocolate (Médio)\nhttps://demo.localhost:3000/p/bolo-de-chocolate",
    );
  });

  it("mensagem híbrida (cliente en, loja pt) também leva o link no fim", () => {
    const url = buildProductWhatsappUrl({
      phone: "5511999999999",
      template: "Hi! I'd like to order {produto} ({variacao})",
      clientLocale: "en",
      storeDefaultLocale: "pt",
      productName: "Chocolate cake",
      productNameInStoreLocale: "Bolo de chocolate",
      variantName: "Medium",
      variantNameInStoreLocale: "Médio",
      productUrl: "https://demo.localhost:3000/en/p/bolo-de-chocolate",
    });
    const message = decodeURIComponent(url.split("text=")[1]!);
    expect(message).toBe(
      "Hi! I'd like to order Bolo de chocolate (Médio)\nCliente em inglês\nhttps://demo.localhost:3000/en/p/bolo-de-chocolate",
    );
  });

  it("nunca usa um path /loja/<slug>/... no link do produto (responsabilidade de quem chama, mas o teste documenta o formato esperado)", () => {
    const url = buildProductWhatsappUrl({
      phone: "5511999999999",
      template: "Quero {produto}",
      clientLocale: "pt",
      storeDefaultLocale: "pt",
      productName: "Croissant",
      productNameInStoreLocale: "Croissant",
      productUrl: "https://demo.localhost:3000/p/croissant",
    });
    expect(decodeURIComponent(url)).not.toContain("/loja/");
  });
});
