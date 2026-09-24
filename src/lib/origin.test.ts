import { describe, expect, it } from "vitest";
import {
  ORIGIN_DIRECT,
  ORIGIN_INSTAGRAM,
  isInstagramUserAgent,
  isPresencialOrigin,
  isValidOrigin,
  resolveOrigin,
  resolveWhatsappMode,
  shouldShowDiscreetWhatsappHint,
  shouldShowProminentWhatsappCta,
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

describe("resolveWhatsappMode", () => {
  it("origem presencial reduz prominent pra discreet", () => {
    expect(resolveWhatsappMode("loja", "prominent")).toBe("discreet");
    expect(resolveWhatsappMode("mesa", "prominent")).toBe("discreet");
  });

  it("origem presencial não muda quem já é discreet", () => {
    expect(resolveWhatsappMode("vitrine", "discreet")).toBe("discreet");
  });

  it("origem presencial NÃO liga o whatsapp de novo quando a loja desligou (off continua off)", () => {
    expect(resolveWhatsappMode("loja", "off")).toBe("off");
  });

  it("origem instagram/direto usa o que o tenant configurou, os 3 modos", () => {
    expect(resolveWhatsappMode("instagram", "prominent")).toBe("prominent");
    expect(resolveWhatsappMode("direto", "discreet")).toBe("discreet");
    expect(resolveWhatsappMode("direto", "off")).toBe("off");
  });
});

describe("shouldShowProminentWhatsappCta", () => {
  it("só true quando o modo resolvido é prominent", () => {
    expect(shouldShowProminentWhatsappCta("instagram", "prominent")).toBe(true);
    expect(shouldShowProminentWhatsappCta("direto", "discreet")).toBe(false);
    expect(shouldShowProminentWhatsappCta("direto", "off")).toBe(false);
  });

  it("origem presencial nunca mostra o CTA chamativo, mesmo com tenant prominent", () => {
    expect(shouldShowProminentWhatsappCta("loja", "prominent")).toBe(false);
  });
});

describe("shouldShowDiscreetWhatsappHint", () => {
  it("só true quando o modo resolvido é discreet", () => {
    expect(shouldShowDiscreetWhatsappHint("direto", "discreet")).toBe(true);
    expect(shouldShowDiscreetWhatsappHint("instagram", "prominent")).toBe(false);
    expect(shouldShowDiscreetWhatsappHint("direto", "off")).toBe(false);
  });

  it("origem presencial com tenant prominent vira discreet -> mostra a dica", () => {
    expect(shouldShowDiscreetWhatsappHint("mesa", "prominent")).toBe(true);
  });

  it("origem presencial com tenant off continua off -> não mostra nada", () => {
    expect(shouldShowDiscreetWhatsappHint("mesa", "off")).toBe(false);
  });
});
