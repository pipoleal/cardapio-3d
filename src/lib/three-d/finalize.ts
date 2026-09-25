import "server-only";
import { getStorageProvider } from "@/lib/storage";
import type { ModelTaskResult } from "./provider";

const CONTENT_TYPES: Record<string, string> = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  usdz: "model/vnd.usdz+zip",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function extensionOf(url: string, fallback: string): string {
  try {
    const match = /\.([a-z0-9]+)$/i.exec(new URL(url).pathname);
    return match ? match[1]!.toLowerCase() : fallback;
  } catch {
    return fallback;
  }
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha baixando ${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export type FinalizedModel = {
  glbUrl: string;
  glbPath: string;
  usdzUrl?: string;
  usdzPath?: string;
  posterUrl?: string;
  fileSizeBytes: number;
};

/**
 * Baixa os outputs do provider (Meshy de verdade OU o `.gltf` de amostra
 * do fake — mesmo caminho pros dois, ver lib/three-d/fake.ts) e sobe pro
 * nosso storage (`StorageProvider`, Firebase em dev ou Vercel Blob em
 * produção/staging — ver docs/DECISOES.md): as URLs do provider são
 * temporárias/assinadas (regra 8 do CLAUDE.md — nunca salvar como
 * definitiva). Modelos são sempre públicos, mesmo espírito de
 * `storage.rules` (`models/{file}`, `allow read: if true`).
 */
export async function finalizeModelOutputs(
  tenantId: string,
  productId: string,
  outputs: NonNullable<ModelTaskResult["outputs"]>,
): Promise<FinalizedModel> {
  const storage = getStorageProvider();
  const basePath = `tenants/${tenantId}/products/${productId}/models`;

  const glbExt = extensionOf(outputs.glbUrl, "glb");
  const glbBuffer = await downloadToBuffer(outputs.glbUrl);
  const glb = await storage.uploadBuffer(`${basePath}/model.${glbExt}`, glbBuffer, {
    contentType: CONTENT_TYPES[glbExt] ?? "application/octet-stream",
    access: "public",
  });

  let usdzUrl: string | undefined;
  let usdzPath: string | undefined;
  if (outputs.usdzUrl) {
    const usdzBuffer = await downloadToBuffer(outputs.usdzUrl);
    const usdz = await storage.uploadBuffer(`${basePath}/model.usdz`, usdzBuffer, {
      contentType: CONTENT_TYPES.usdz!,
      access: "public",
    });
    usdzUrl = usdz.url;
    usdzPath = usdz.path;
  }

  let posterUrl: string | undefined;
  if (outputs.thumbnailUrl) {
    const posterExt = extensionOf(outputs.thumbnailUrl, "png");
    const posterBuffer = await downloadToBuffer(outputs.thumbnailUrl);
    const poster = await storage.uploadBuffer(`${basePath}/poster.${posterExt}`, posterBuffer, {
      contentType: CONTENT_TYPES[posterExt] ?? "application/octet-stream",
      access: "public",
    });
    posterUrl = poster.url;
  }

  return {
    glbUrl: glb.url,
    glbPath: glb.path,
    usdzUrl,
    usdzPath,
    posterUrl,
    fileSizeBytes: glbBuffer.length,
  };
}
