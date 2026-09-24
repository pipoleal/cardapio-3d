import { describe, expect, it } from "vitest";
import {
  buildExternalPath,
  buildLojaRewritePath,
  detectPreferredLocale,
  resolveLocaleForPath,
  shouldSyncLocaleCookie,
} from "./resolve-locale";

describe("resolveLocaleForPath", () => {
  it("sem prefixo, preferido = padrão (pt) -> serve sem redirect", () => {
    expect(resolveLocaleForPath("/", "pt")).toEqual({
      locale: "pt",
      needsRedirect: false,
      pathWithoutLocale: "/",
    });
    expect(resolveLocaleForPath("/bolo", "pt")).toEqual({
      locale: "pt",
      needsRedirect: false,
      pathWithoutLocale: "/bolo",
    });
  });

  it("sem prefixo, preferido != padrão -> precisa redirect pra acrescentar o prefixo", () => {
    expect(resolveLocaleForPath("/bolo", "en")).toEqual({
      locale: "en",
      needsRedirect: true,
      pathWithoutLocale: "/bolo",
    });
  });

  it("prefixo explícito não-padrão -> serve sem redirect", () => {
    expect(resolveLocaleForPath("/en/bolo", "pt")).toEqual({
      locale: "en",
      needsRedirect: false,
      pathWithoutLocale: "/bolo",
    });
  });

  it("prefixo redundante do padrão (/pt) -> precisa redirect pra remover", () => {
    expect(resolveLocaleForPath("/pt/bolo", "pt")).toEqual({
      locale: "pt",
      needsRedirect: true,
      pathWithoutLocale: "/bolo",
    });
    expect(resolveLocaleForPath("/pt", "en")).toEqual({
      locale: "pt",
      needsRedirect: true,
      pathWithoutLocale: "/",
    });
  });
});

describe("buildExternalPath", () => {
  it("locale padrão nunca aparece na URL", () => {
    expect(buildExternalPath("pt", "/bolo")).toBe("/bolo");
    expect(buildExternalPath("pt", "/")).toBe("/");
  });

  it("locale não-padrão sempre aparece na URL", () => {
    expect(buildExternalPath("en", "/bolo")).toBe("/en/bolo");
    expect(buildExternalPath("en", "/")).toBe("/en");
  });
});

describe("buildLojaRewritePath", () => {
  it("monta o path interno /loja/<slug>/<locale>/...", () => {
    expect(buildLojaRewritePath("demo", "pt", "/")).toBe("/loja/demo/pt");
    expect(buildLojaRewritePath("demo", "en", "/bolo")).toBe("/loja/demo/en/bolo");
  });
});

describe("detectPreferredLocale", () => {
  it("cookie válido vence", () => {
    expect(detectPreferredLocale("en", "pt-BR")).toBe("en");
  });

  it("sem cookie, usa o Accept-Language", () => {
    expect(detectPreferredLocale(undefined, "es-ES,es;q=0.9,en;q=0.8")).toBe("es");
  });

  it("sem cookie nem header reconhecido, cai para o padrão (pt)", () => {
    expect(detectPreferredLocale(undefined, "fr-FR")).toBe("pt");
    expect(detectPreferredLocale(null, null)).toBe("pt");
  });
});

describe("shouldSyncLocaleCookie", () => {
  it("navegação de documento (real) sincroniza o cookie", () => {
    expect(shouldSyncLocaleCookie("document")).toBe(true);
  });

  it("sem o header (curl, scripts) também sincroniza — não é um navegador fazendo prefetch", () => {
    expect(shouldSyncLocaleCookie(null)).toBe(true);
  });

  it("prefetch do <Link> (empty/iframe/etc.) NÃO sincroniza — é o bug que isso corrige", () => {
    expect(shouldSyncLocaleCookie("empty")).toBe(false);
    expect(shouldSyncLocaleCookie("iframe")).toBe(false);
  });
});
