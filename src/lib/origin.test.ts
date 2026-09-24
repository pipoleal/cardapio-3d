import { describe, expect, it } from "vitest";
import {
  ORIGIN_DIRECT,
  ORIGIN_INSTAGRAM,
  isInstagramUserAgent,
  isPresencialOrigin,
  isValidOrigin,
  resolveOrigin,
  resolveWhatsappMode,
  shouldShowWhatsappCta,
} from "./origin";

describe("isValidOrigin", () => {
  it("aceita slugs curtos válidos", () => {
    expect(isValidOrigin("loja")).toBe(true);
    expect(isValidOrigin("mesa-12")).toBe(true);
    expect(isValidOrigin("a")).toBe(true);
  });

  it("rejeita vazio, maiúsculas, espaço, começando por número, ou longo demais", () => {
    expect(isValidOrigin("")).toBe(false);
    expect(isValidOrigin(null)).toBe(false);
    expect(isValidOrigin(undefined)).toBe(false);
    expect(isValidOrigin("Loja")).toBe(false);
    expect(isValidOrigin("loja balcão")).toBe(false);
    expect(isValidOrigin("1loja")).toBe(false);
    expect(isValidOrigin("a".repeat(21))).toBe(false);
  });
});

describe("isPresencialOrigin", () => {
  it("loja, mesa e vitrine são presenciais", () => {
    expect(isPresencialOrigin("loja")).toBe(true);
    expect(isPresencialOrigin("mesa")).toBe(true);
    expect(isPresencialOrigin("vitrine")).toBe(true);
  });

  it("instagram e direto não são presenciais", () => {
    expect(isPresencialOrigin("instagram")).toBe(false);
    expect(isPresencialOrigin("direto")).toBe(false);
  });
});

describe("isInstagramUserAgent", () => {
  it("detecta o navegador interno do Instagram", () => {
    expect(isInstagramUserAgent("Mozilla/5.0 ... Instagram 302.0.0.23.114 ...")).toBe(true);
  });

  it("não detecta Chrome/Safari normais", () => {
    expect(isInstagramUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS) AppleWebKit/605.1.15 Safari/604.1")).toBe(
      false,
    );
  });

  it("sem user-agent, não detecta", () => {
    expect(isInstagramUserAgent(null)).toBe(false);
    expect(isInstagramUserAgent(undefined)).toBe(false);
  });
});

describe("resolveOrigin", () => {
  it("?origem= válido sempre vence", () => {
    expect(
      resolveOrigin({ queryParam: "loja", cookieValue: "instagram", userAgent: null }),
    ).toBe("loja");
  });

  it("?origem= inválido cai pro cookie", () => {
    expect(
      resolveOrigin({ queryParam: "MAIÚSCULA", cookieValue: "mesa", userAgent: null }),
    ).toBe("mesa");
  });

  it("sem query nem cookie, User-Agent do Instagram -> instagram", () => {
    expect(
      resolveOrigin({ queryParam: null, cookieValue: null, userAgent: "... Instagram 302 ..." }),
    ).toBe(ORIGIN_INSTAGRAM);
  });

  it("sem nada -> direto", () => {
    expect(resolveOrigin({ queryParam: null, cookieValue: null, userAgent: "Chrome" })).toBe(
      ORIGIN_DIRECT,
    );
  });

  it("cookie vence sobre a heurística de user-agent", () => {
    expect(
      resolveOrigin({ queryParam: null, cookieValue: "vitrine", userAgent: "... Instagram ..." }),
    ).toBe("vitrine");
  });
});

describe("resolveWhatsappMode / shouldShowWhatsappCta", () => {
  it("origem presencial força discreet mesmo com tenant configurado como direct", () => {
    expect(resolveWhatsappMode("loja", "direct")).toBe("discreet");
    expect(shouldShowWhatsappCta("mesa", "direct")).toBe(false);
  });

  it("origem instagram/direto usa o que o tenant configurou", () => {
    expect(resolveWhatsappMode("instagram", "direct")).toBe("direct");
    expect(resolveWhatsappMode("direto", "discreet")).toBe("discreet");
    expect(shouldShowWhatsappCta("instagram", "direct")).toBe(true);
    expect(shouldShowWhatsappCta("direto", "discreet")).toBe(false);
  });
});
