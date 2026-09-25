"use client";

import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { toPublicStorageUrl } from "@/lib/storage-url";
import type { StorageAccess } from "./provider";

/**
 * Ponto único de decisão pro upload direto do navegador (capa, logo,
 * fotos de captura, modelo 3D manual) — os componentes chamam isto em vez
 * de `uploadBytes`/`upload` direto, então não sabem (nem precisam saber)
 * qual provider está ativo. Import dinâmico do `@vercel/blob/client`: não
 * precisa ir pro bundle de quem só usa Firebase (padrão em dev).
 */
export async function uploadFile(
  path: string,
  blob: Blob,
  opts: { contentType: string; access: StorageAccess },
): Promise<{ url: string; path: string }> {
  if (process.env.NEXT_PUBLIC_STORAGE_PROVIDER === "vercel-blob") {
    const { upload } = await import("@vercel/blob/client");
    const result = await upload(path, blob, {
      access: opts.access,
      contentType: opts.contentType,
      handleUploadUrl: opts.access === "public" ? "/api/blob/upload/public" : "/api/blob/upload/private",
    });
    return { url: result.url, path: result.pathname };
  }

  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: opts.contentType });
  return { url: toPublicStorageUrl(await getDownloadURL(fileRef)), path };
}
