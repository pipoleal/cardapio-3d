import { describe, expect, it } from "vitest";
import { isFresh } from "./fresh";

const NOW = new Date("2026-01-01T12:00:00Z").getTime();

describe("isFresh", () => {
  it("null/undefined nunca é fresh", () => {
    expect(isFresh(null, 3, NOW)).toBe(false);
    expect(isFresh(undefined, 3, NOW)).toBe(false);
  });

  it("dentro da janela (1h atrás, janela de 3h)", () => {
    const oneHourAgo = new Date(NOW - 1 * 60 * 60 * 1000);
    expect(isFresh(oneHourAgo, 3, NOW)).toBe(true);
  });

  it("exatamente no limite (3h atrás, janela de 3h) já não é mais fresh", () => {
    const threeHoursAgo = new Date(NOW - 3 * 60 * 60 * 1000);
    expect(isFresh(threeHoursAgo, 3, NOW)).toBe(false);
  });

  it("fora da janela (4h atrás, janela de 3h)", () => {
    const fourHoursAgo = new Date(NOW - 4 * 60 * 60 * 1000);
    expect(isFresh(fourHoursAgo, 3, NOW)).toBe(false);
  });

  it("agora mesmo é fresh", () => {
    expect(isFresh(new Date(NOW), 3, NOW)).toBe(true);
  });
});
