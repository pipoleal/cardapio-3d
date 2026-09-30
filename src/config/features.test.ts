import { describe, expect, it } from "vitest";
import { FEATURES, isFeatureEnabled } from "./features";

describe("isFeatureEnabled", () => {
  it("usa o padrão global (tudo desligado) sem tenant ou sem override", () => {
    expect(isFeatureEnabled(undefined, "modelos3D")).toBe(FEATURES.modelos3D);
    expect(isFeatureEnabled(null, "fotosIA")).toBe(FEATURES.fotosIA);
    expect(isFeatureEnabled({}, "realidadeAumentada")).toBe(FEATURES.realidadeAumentada);
    expect(isFeatureEnabled({ features: {} }, "modelos3D")).toBe(FEATURES.modelos3D);
  });

  it("override por loja liga uma flag específica", () => {
    expect(isFeatureEnabled({ features: { modelos3D: true } }, "modelos3D")).toBe(true);
    expect(isFeatureEnabled({ features: { modelos3D: true } }, "fotosIA")).toBe(FEATURES.fotosIA);
  });

  it("override por loja também desliga explicitamente, mesmo se o padrão global mudasse", () => {
    expect(isFeatureEnabled({ features: { fotosIA: false } }, "fotosIA")).toBe(false);
  });
});
