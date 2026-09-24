import "server-only";
import { adminStorage } from "@/lib/firebase/admin";
import { toPublicStorageUrl } from "@/lib/storage-url";
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

/**
 * `models/{file}` é público (`storage.rules`) — em vez de URL assinada
 * (pensada pra arquivo privado, com token que expira), monta a URL
 * pública de download direto (formato REST do Storage, `?alt=media`, sem
 * token — não precisa, a leitura já é liberada pras regras).
 */
function publicDownloadUrl(bucketName: string, path: string): string {
  const encoded = encodeURIComponent(path);
  const rawUrl =
    process.env.NEXT_PUBLIC_USE_EMULATORS === "true"
      ? `http://127.0.0.1:9199/v0/b/${bucketName}/o/${encoded}?alt=media`
      : `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`;
  return toPublicStorageUrl(rawUrl);
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
 * nosso Storage: as URLs do provider são temporárias/assinadas (regra 8
 * do CLAUDE.md — nunca salvar como definitiva).
 */
export async function finalizeModelOutputs(
  tenantId: string,
  productId: string,
  outputs: NonNullable<ModelTaskResult["outputs"]>,
): Promise<FinalizedModel> {
  const bucket = adminStorage.bucket();
  const basePath = `tenants/${tenantId}/products/${productId}/models`;

  const glbExt = extensionOf(outputs.glbUrl, "glb");
  const glbBuffer = await downloadToBuffer(outputs.glbUrl);
  const glbPath = `${basePath}/model.${glbExt}`;
  await bucket.file(glbPath).save(glbBuffer, { contentType: CONTENT_TYPES[glbExt] ?? "application/octet-stream" });

  let usdzUrl: string | undefined;
  let usdzPath: string | undefined;
  if (outputs.usdzUrl) {
    const usdzBuffer = await downloadToBuffer(outputs.usdzUrl);
    usdzPath = `${basePath}/model.usdz`;
    await bucket.file(usdzPath).save(usdzBuffer, { contentType: CONTENT_TYPES.usdz });
    usdzUrl = publicDownloadUrl(bucket.name, usdzPath);
  }

  let posterUrl: string | undefined;
  if (outputs.thumbnailUrl) {
    const posterExt = extensionOf(outputs.thumbnailUrl, "png");
    const posterBuffer = await downloadToBuffer(outputs.thumbnailUrl);
    const posterPath = `${basePath}/poster.${posterExt}`;
    await bucket
      .file(posterPath)
      .save(posterBuffer, { contentType: CONTENT_TYPES[posterExt] ?? "application/octet-stream" });
    posterUrl = publicDownloadUrl(bucket.name, posterPath);
  }

  return {
    glbUrl: publicDownloadUrl(bucket.name, glbPath),
    glbPath,
    usdzUrl,
    usdzPath,
    posterUrl,
    fileSizeBytes: glbBuffer.length,
  };
}
