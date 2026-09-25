import "server-only";
import { getStorageProvider } from "@/lib/storage";

const INPUT_URL_TTL_SECONDS = 60 * 60; // 1h — só pro provider baixar, não fica salvo

/**
 * A Meshy não alcança `127.0.0.1` (emulador do Firebase Storage, só existe
 * pro computador de dev) — nesse caso baixa cada foto pelo Admin SDK e
 * manda como data URI base64 (a Meshy aceita os dois formatos, confirmado
 * na documentação: "publicly accessible URL or base64 data URI").
 *
 * Em qualquer outro caso (Vercel Blob, sempre um host de internet de
 * verdade — inclusive o store PRIVADO, via URL assinada temporária, ver
 * `lib/storage/vercel-blob-provider.ts`) manda a URL direto — mais leve
 * que inflar ~33% em base64, e o próprio Blob resolve o acesso.
 */
export async function resolveInputImageUrls(paths: string[]): Promise<string[]> {
  const storage = getStorageProvider();

  if (storage.name === "firebase" && process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
    return Promise.all(
      paths.map(async (path) => {
        const buffer = await storage.downloadBuffer(path);
        const contentType = path.endsWith(".png") ? "image/png" : "image/webp";
        return `data:${contentType};base64,${buffer.toString("base64")}`;
      }),
    );
  }

  return Promise.all(
    paths.map((path) => storage.getExternalReadUrl(path, { access: "private", ttlSeconds: INPUT_URL_TTL_SECONDS })),
  );
}
