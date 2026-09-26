import { issueSignedToken } from "@vercel/blob";
import {
  handleUpload,
  handleUploadPresigned,
  type HandleUploadBody,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { assertUploadAuthorized } from "@/lib/storage/authorize-upload";
import { parseUploadPathname } from "@/lib/storage/pathnames";

const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;

async function resolveUploadConstraints(
  pathname: string,
): Promise<{ allowedContentTypes: string[]; maximumSizeInBytes: number }> {
  const parsed = parseUploadPathname(pathname);
  if (!parsed || parsed.kind !== "capture") {
    throw new Error("Caminho de upload inválido.");
  }
  await assertUploadAuthorized(parsed);
  return { allowedContentTypes: ["image/webp"], maximumSizeInBytes: MAX_CAPTURE_BYTES };
}

/**
 * Gera o token de upload direto do navegador pro store PRIVADO do Blob —
 * só fotos de captura hoje (não devem ser públicas). A Meshy lê essas fotos
 * via URL assinada temporária (`lib/storage/vercel-blob-provider.ts`,
 * `getExternalReadUrl`), não pela URL "crua".
 *
 * Mesmos dois modos de autenticação do store público — ver o comentário em
 * `../public/route.ts`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = process.env.BLOB_READ_WRITE_TOKEN_PRIVATE;

  try {
    const jsonResponse = token
      ? await handleUpload({
          body: (await request.json()) as HandleUploadBody,
          request,
          token,
          onBeforeGenerateToken: async (pathname) => {
            const { allowedContentTypes, maximumSizeInBytes } = await resolveUploadConstraints(pathname);
            return { allowedContentTypes, addRandomSuffix: true, maximumSizeInBytes };
          },
          onUploadCompleted: async () => {
            // Idem ao store público — o cliente não depende deste callback.
          },
        })
      : await handleUploadPresigned({
          body: (await request.json()) as HandleUploadPresignedBody,
          request,
          webhookPublicKey: process.env.BLOB_PRIVATE_WEBHOOK_PUBLIC_KEY,
          getSignedToken: async (pathname) => {
            const { allowedContentTypes, maximumSizeInBytes } = await resolveUploadConstraints(pathname);
            const signedToken = await issueSignedToken({
              pathname,
              operations: ["put"],
              allowedContentTypes,
              maximumSizeInBytes,
              validUntil: Date.now() + 60 * 60 * 1000,
              storeId: process.env.BLOB_PRIVATE_STORE_ID,
            });
            return {
              token: signedToken,
              urlOptions: { allowedContentTypes, maximumSizeInBytes, addRandomSuffix: true },
            };
          },
          onUploadCompleted: async () => {},
        });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
