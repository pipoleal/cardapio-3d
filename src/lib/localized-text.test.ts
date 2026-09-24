import { describe, expect, it } from "vitest";
import { resolveLocalizedText } from "./localized-text";

const text = { pt: "Bolo de chocolate", en: "Chocolate cake", es: "Torta de chocolate" };

describe("resolveLocalizedText", () => {
  it("pt sempre usa o texto em pt, sem checar i18nStatus", () => {
    expect(resolveLocalizedText(text, "pt")).toBe("Bolo de chocolate");
  });

  it("en aprovado usa o texto em en", () => {
    expect(resolveLocalizedText(text, "en", { en: "approved" })).toBe("Chocolate cake");
  });

  it("en não aprovado (auto) cai pro pt", () => {
    expect(resolveLocalizedText(text, "en", { en: "auto" })).toBe("Bolo de chocolate");
  });

  it("sem i18nStatus nenhum, cai pro pt", () => {
    expect(resolveLocalizedText(text, "en")).toBe("Bolo de chocolate");
  });

  it("aprovado mas sem o texto no locale, cai pro pt (não quebra)", () => {
    expect(resolveLocalizedText({ pt: "Bolo" }, "es", { es: "approved" })).toBe("Bolo");
  });
});
