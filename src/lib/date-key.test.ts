import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, dateKeyInTimezone } from "./date-key";

describe("dateKeyInTimezone", () => {
  it("usa o dia em Brasília, não o dia em UTC", () => {
    // 2026-03-05T02:29:00Z = 2026-03-04T23:29:00-03:00 (ainda dia 04 em Brasília)
    expect(dateKeyInTimezone(new Date("2026-03-05T02:29:00Z"), DEFAULT_TIMEZONE)).toBe("2026-03-04");
  });

  it("vira o dia certo depois da meia-noite em Brasília (03:00 UTC)", () => {
    // 2026-03-05T03:00:00Z = 2026-03-05T00:00:00-03:00 (já é dia 05 em Brasília)
    expect(dateKeyInTimezone(new Date("2026-03-05T03:00:00Z"), DEFAULT_TIMEZONE)).toBe("2026-03-05");
  });
});
