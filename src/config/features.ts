// Flags globais (padrão desligado pro lançamento da boaconfe — ver
// docs/DECISOES.md). Sobrescritas por loja via `tenant.features` (mesmas
// chaves, todas opcionais) — ausência de campo usa o padrão daqui.
export const FEATURES = {
  modelos3D: false,
  realidadeAumentada: false,
  fotosIA: false,
} as const;

export type FeatureFlags = typeof FEATURES;
export type FeatureKey = keyof FeatureFlags;

export function isFeatureEnabled(
  tenant: { features?: Partial<Record<FeatureKey, boolean>> } | null | undefined,
  key: FeatureKey,
): boolean {
  return tenant?.features?.[key] ?? FEATURES[key];
}
