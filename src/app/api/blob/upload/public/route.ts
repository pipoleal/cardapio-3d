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

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;
// Modelo 3D não tem um número pedido explicitamente — 50 MB é generoso pro
// upload manual de um lojista sem compressão, e bem abaixo do limite de
// cache do Blob (512 MB, ver docs/DECISOES.md) pra abrir rápido no celular.
const MAX_MODEL_BYTES = 50 * 1024 * 1024;

/**
 * Confere o caminho + autorização e devolve as restrições do upload —
 * compartilhado pelos dois modos de autenticação abaixo (token ou
 * storeId/presigned), pra não duplicar a regra de autorização.
 */
async function resolveUploadConstraints(
  pathname: string,
): Promise<{ allowedContentTypes: string[]; maximumSizeInBytes: number }> {
  const parsed = parseUploadPathname(pathname);
  if (!parsed || parsed.kind === "capture") {
    throw new Error("Caminho de upload inválido.");
  }
  await assertUploadAuthorized(parsed);

  if (parsed.kind === "model") {
    return {
      allowedContentTypes: ["model/gltf-binary", "model/vnd.usdz+zip", "application/octet-stream"],
      maximumSizeInBytes: MAX_MODEL_BYTES,
    };
  }
  return {
    allowedContentTypes: ["image/webp"],
    maximumSizeInBytes: parsed.kind === "logo" ? MAX_LOGO_BYTES : MAX_COVER_BYTES,
  };
}

/**
 * Gera o token de upload direto do navegador pro store PÚBLICO do Blob —
 * capa, logo e upload manual de modelo 3D (todos de leitura pública, mesmo
 * padrão do `storage.rules` de hoje). Fotos de captura usam o store
 * privado, `../private/route.ts`.
 *
 * Dois modos de autenticação (`NEXT_PUBLIC_BLOB_UPLOAD_AUTH`, ver
 * `docs/DECISOES.md`): `BLOB_READ_WRITE_TOKEN_PUBLIC` estático (se existir —
 * a Vercel só cria isso automaticamente pra stores criados do zero pelo
 * assistente, não pra stores já existentes conectados via "Connect
 * Project") ou `storeId`/OIDC via `handleUploadPresigned` (padrão desde que
 * a Vercel mudou o modelo em 2026 — nosso caso real hoje). O cliente
 * (`lib/storage/upload-client.ts`) precisa chamar a função correspondente
 * (`upload()` ou `uploadPresigned()`), por isso o modo é decidido em build
 * time, não detectado por requisição.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = process.env.BLOB_READ_WRITE_TOKEN_PUBLIC;

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
            // Não usado pra persistir nada — o cliente já chama a Server
            // Action com a URL assim que o upload resolve.
          },
        })
      : await handleUploadPresigned({
          body: (await request.json()) as HandleUploadPresignedBody,
          request,
          webhookPublicKey: process.env.BLOB_PUBLIC_WEBHOOK_PUBLIC_KEY,
          getSignedToken: async (pathname) => {
            const { allowedContentTypes, maximumSizeInBytes } = await resolveUploadConstraints(pathname);
            const signedToken = await issueSignedToken({
              pathname,
              operations: ["put"],
              allowedContentTypes,
              maximumSizeInBytes,
              validUntil: Date.now() + 60 * 60 * 1000,
              storeId: process.env.BLOB_PUBLIC_STORE_ID,
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
