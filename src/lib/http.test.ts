import { describe, expect, it } from "vitest";
import { isDocumentNavigation } from "./http";

describe("isDocumentNavigation", () => {
  it("navegação de documento (real) conta", () => {
    expect(isDocumentNavigation("document")).toBe(true);
  });

  it("sem o header (curl, scripts) também conta — não é um navegador fazendo prefetch", () => {
    expect(isDocumentNavigation(null)).toBe(true);
  });

  it("prefetch do <Link> (empty/iframe/etc.) NÃO conta", () => {
    expect(isDocumentNavigation("empty")).toBe(false);
    expect(isDocumentNavigation("iframe")).toBe(false);
  });
});
