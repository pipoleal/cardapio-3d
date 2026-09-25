import "server-only";
import { adminStorage } from "@/lib/firebase/admin";
import { toPublicStorageUrl } from "@/lib/storage-url";
import type { StorageAccess, StorageProvider, UploadResult } from "./provider";

const CONTENT_TYPES_BY_EXT: Record<string, string> = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  usdz: "model/vnd.usdz+zip",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * `models/{file}` (e outros caminhos públicos) são lidos via a URL REST do
 * Storage sem token (`?alt=media`, sem `token=`) — funciona porque
 * `storage.rules` já libera `allow read: if true` nesses caminhos; não
 * precisa de URL assinada pra algo que já é público pelas regras.
 */
function publicDownloadUrl(bucketName: string, path: string): string {
  const encoded = encodeURIComponent(path);
  const rawUrl =
    process.env.NEXT_PUBLIC_USE_EMULATORS === "true"
      ? `http://127.0.0.1:9199/v0/b/${bucketName}/o/${encoded}?alt=media`
      : `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`;
  return toPublicStorageUrl(rawUrl);
}

function extensionOf(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1]!.toLowerCase() : "";
}

export class FirebaseStorageProvider implements StorageProvider {
  name = "firebase" as const;

  async uploadBuffer(
    path: string,
    buffer: Buffer,
    opts: { contentType: string; access: StorageAccess },
  ): Promise<UploadResult> {
    const bucket = adminStorage.bucket();
    await bucket.file(path).save(buffer, { contentType: opts.contentType });

    if (opts.access === "public") {
      return { url: publicDownloadUrl(bucket.name, path), path };
    }
    const [url] = await bucket.file(path).getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
    return { url: toPublicStorageUrl(url), path };
  }

  async getExternalReadUrl(path: string, opts: { access: StorageAccess; ttlSeconds: number }): Promise<string> {
    const bucket = adminStorage.bucket();
    if (opts.access === "public") return publicDownloadUrl(bucket.name, path);
    const [url] = await bucket.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + opts.ttlSeconds * 1000,
    });
    return url;
  }

  async downloadBuffer(path: string): Promise<Buffer> {
    const [buffer] = await adminStorage.bucket().file(path).download();
    return buffer;
  }

  async delete(path: string): Promise<void> {
    // `opts.access` não importa aqui — o bucket do emulador é um só.
    await adminStorage.bucket().file(path).delete({ ignoreNotFound: true });
  }
}

export { CONTENT_TYPES_BY_EXT, extensionOf };
