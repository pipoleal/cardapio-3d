import "server-only";
import { adminStorage } from "@/lib/firebase/admin";

const isEmulator = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

/**
 * A Meshy não alcança URLs do emulador (127.0.0.1/IP da rede local só
 * existem pro computador de dev, não pra internet) — em dev, baixa cada
 * foto pelo Admin SDK (sempre alcança o emulador de verdade) e manda como
 * data URI base64 (a Meshy aceita os dois formatos, confirmado na
 * documentação: "publicly accessible URL or base64 data URI"). Em
 * produção, usa URL assinada (mais leve — não infla ~33% em base64).
 */
export async function resolveInputImageUrls(paths: string[]): Promise<string[]> {
  const bucket = adminStorage.bucket();

  if (isEmulator) {
    return Promise.all(
      paths.map(async (path) => {
        const [buffer] = await bucket.file(path).download();
        const contentType = path.endsWith(".png") ? "image/png" : "image/webp";
        return `data:${contentType};base64,${buffer.toString("base64")}`;
      }),
    );
  }

  return Promise.all(
    paths.map(async (path) => {
      const [url] = await bucket.file(path).getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000, // 1h — só pro provider baixar, não fica salvo
      });
      return url;
    }),
  );
}
