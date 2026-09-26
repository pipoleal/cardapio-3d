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
    const handleUploadUrl = opts.access === "public" ? "/api/blob/upload/public" : "/api/blob/upload/private";
    // O servidor decide, por ambiente, entre BLOB_READ_WRITE_TOKEN_* estático
    // (se existir) ou storeId/OIDC (padrão desde que a Vercel mudou o
    // modelo em 2026 — ver src/app/api/blob/upload/public/route.ts) — o
    // cliente precisa chamar a função correspondente, por isso o modo
    // também precisa estar disponível aqui (NEXT_PUBLIC_, ver .env.example).
    const usePresigned = process.env.NEXT_PUBLIC_BLOB_UPLOAD_AUTH !== "token";
    const { upload, uploadPresigned } = await import("@vercel/blob/client");
    const uploadFn = usePresigned ? uploadPresigned : upload;
    const result = await uploadFn(path, blob, {
      access: opts.access,
      contentType: opts.contentType,
      handleUploadUrl,
    });
    return { url: result.url, path: result.pathname };
  }

  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: opts.contentType });
  return { url: toPublicStorageUrl(await getDownloadURL(fileRef)), path };
}
