// Puro, sem "server-only" de propósito: usado tanto pelos Route Handlers
// de upload (server) quanto testado direto em Vitest, sem precisar de
// nenhuma credencial (Firebase ou Blob).
const ID = "[A-Za-z0-9_-]+";

export type ParsedUploadPath =
  | { kind: "logo"; tenantId: string }
  | { kind: "cover"; tenantId: string; productId: string }
  | { kind: "capture"; tenantId: string; productId: string; captureId: string; pose: string }
  | { kind: "capture-video"; tenantId: string; productId: string; captureId: string; ext: "webm" | "mp4" | "mov" }
  | { kind: "model"; tenantId: string; productId: string; ext: "glb" | "usdz" };

const PATTERNS: Array<{ regex: RegExp; build: (m: RegExpExecArray) => ParsedUploadPath }> = [
  {
    regex: new RegExp(`^tenants/(${ID})/branding/logo\\.webp$`),
    build: (m) => ({ kind: "logo", tenantId: m[1]! }),
  },
  {
    regex: new RegExp(`^tenants/(${ID})/products/(${ID})/cover\\.webp$`),
    build: (m) => ({ kind: "cover", tenantId: m[1]!, productId: m[2]! }),
  },
  {
    regex: new RegExp(`^tenants/(${ID})/products/(${ID})/captures/(${ID})/([a-z0-9]+)\\.webp$`),
    build: (m) => ({ kind: "capture", tenantId: m[1]!, productId: m[2]!, captureId: m[3]!, pose: m[4]! }),
  },
  {
    // Rota "Vídeo · escaneamento" (CaptureFlow.tsx) — um vídeo só por captura, sem pose.
    regex: new RegExp(`^tenants/(${ID})/products/(${ID})/captures/(${ID})/video\\.(webm|mp4|mov)$`),
    build: (m) => ({
      kind: "capture-video",
      tenantId: m[1]!,
      productId: m[2]!,
      captureId: m[3]!,
      ext: m[4] as "webm" | "mp4" | "mov",
    }),
  },
  {
    regex: new RegExp(`^tenants/(${ID})/products/(${ID})/models/model\\.(glb|usdz)$`),
    build: (m) => ({ kind: "model", tenantId: m[1]!, productId: m[2]!, ext: m[3] as "glb" | "usdz" }),
  },
];

/**
 * Valida o `pathname` que o cliente propõe pro upload (Vercel Blob,
 * `onBeforeGenerateToken`) contra os formatos conhecidos — nunca confia
 * cegamente num caminho vindo do navegador (podia ser de outro tenant, ou
 * nem seguir o formato esperado). `null` = formato desconhecido, rejeita.
 */
export function parseUploadPathname(pathname: string): ParsedUploadPath | null {
  for (const { regex, build } of PATTERNS) {
    const match = regex.exec(pathname);
    if (match) return build(match);
  }
  return null;
}
