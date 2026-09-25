import "server-only";
import { FirebaseStorageProvider } from "./firebase-provider";
import type { StorageProvider } from "./provider";
import { VercelBlobStorageProvider } from "./vercel-blob-provider";

/**
 * `STORAGE_PROVIDER` é independente de `NEXT_PUBLIC_USE_EMULATORS`: o
 * projeto de staging tem Firestore/Auth REAIS (não emulados) mas usa Blob
 * pro armazenamento de arquivo (o Firebase de lá não tem Cloud Storage —
 * ver docs/DECISOES.md). Dev local pode usar `firebase` (padrão, Storage
 * emulator) ou também `vercel-blob` (com tokens reais no `.env.local`,
 * pra testar upload antes do deploy — ver README).
 */
export function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === "vercel-blob"
    ? new VercelBlobStorageProvider()
    : new FirebaseStorageProvider();
}
