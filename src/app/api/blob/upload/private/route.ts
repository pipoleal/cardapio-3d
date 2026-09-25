import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { assertUploadAuthorized } from "@/lib/storage/authorize-upload";
import { parseUploadPathname } from "@/lib/storage/pathnames";

const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;

/**
 * Gera o token de upload direto do navegador pro store PRIVADO do Blob —
 * só fotos de captura hoje (não devem ser públicas, ver plano da Etapa
 * "Vercel Blob"). A Meshy lê essas fotos via URL assinada temporária
 * (`lib/storage/vercel-blob-provider.ts`, `getExternalReadUrl`), não pela
 * URL "crua".
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN_PRIVATE,
      onBeforeGenerateToken: async (pathname) => {
        const parsed = parseUploadPathname(pathname);
        if (!parsed || parsed.kind !== "capture") {
          throw new Error("Caminho de upload inválido.");
        }
        await assertUploadAuthorized(parsed);

        return {
          allowedContentTypes: ["image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_CAPTURE_BYTES,
        };
      },
      onUploadCompleted: async () => {
        // Idem ao store público — o cliente não depende deste callback.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
