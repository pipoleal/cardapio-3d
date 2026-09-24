import { describe, expect, it } from "vitest";
import { formatPriceCents } from "./price";

describe("formatPriceCents", () => {
  it("formata em BRL no locale pt", () => {
    const formatted = formatPriceCents(1000, "pt");
    expect(formatted).toContain("10,00");
  });

  it("formata em BRL no locale en (separador decimal muda, moeda continua BRL)", () => {
    const formatted = formatPriceCents(1000, "en");
    expect(formatted).toContain("10.00");
  });

  it("centavos viram parte decimal corretamente", () => {
    expect(formatPriceCents(350, "pt")).toContain("3,50");
  });

  it("zero não quebra", () => {
    expect(formatPriceCents(0, "pt")).toContain("0,00");
  });
});
