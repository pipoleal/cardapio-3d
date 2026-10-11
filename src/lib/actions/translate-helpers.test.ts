import { describe, expect, it } from "vitest";
import { textFieldsChanged } from "./translate-helpers";

describe("textFieldsChanged", () => {
  it("mesmo texto em todos os campos -> não mudou", () => {
    expect(textFieldsChanged({ name: "Bolo", description: "Doce" }, { name: "Bolo", description: "Doce" })).toBe(
      false,
    );
  });

  it("nome diferente -> mudou", () => {
    expect(textFieldsChanged({ name: "Bolo" }, { name: "Bolo de chocolate" })).toBe(true);
  });

  it("descrição diferente, nome igual -> mudou (qualquer campo conta)", () => {
    expect(textFieldsChanged({ name: "Bolo", description: "A" }, { name: "Bolo", description: "B" })).toBe(true);
  });

  it("campo ausente antes, string vazia depois -> não conta como mudança", () => {
    expect(textFieldsChanged({ description: undefined }, { description: "" })).toBe(false);
  });

  it("campo ausente antes, texto de verdade depois -> mudou", () => {
    expect(textFieldsChanged({ description: undefined }, { description: "Nova descrição" })).toBe(true);
  });

  it("campo deixou de existir (apagado) -> mudou", () => {
    expect(textFieldsChanged({ description: "Tinha algo" }, { description: undefined })).toBe(true);
  });

  it("só espaços em branco a mais/a menos ainda conta como diferente (comparação exata)", () => {
    expect(textFieldsChanged({ name: "Bolo" }, { name: "Bolo " })).toBe(true);
  });
});
