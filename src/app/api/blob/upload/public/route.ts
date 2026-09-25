import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
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
 * Gera o token de upload direto do navegador pro store PÚBLICO do Blob —
 * capa, logo e upload manual de modelo 3D (todos de leitura pública, mesmo
 * padrão do `storage.rules` de hoje). Fotos de captura usam o store
 * privado, `../private/route.ts`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN_PUBLIC,
      onBeforeGenerateToken: async (pathname) => {
        const parsed = parseUploadPathname(pathname);
        if (!parsed || parsed.kind === "capture") {
          throw new Error("Caminho de upload inválido.");
        }
        await assertUploadAuthorized(parsed);

        if (parsed.kind === "model") {
          return {
            allowedContentTypes: ["model/gltf-binary", "model/vnd.usdz+zip", "application/octet-stream"],
            addRandomSuffix: true,
            maximumSizeInBytes: MAX_MODEL_BYTES,
          };
        }
        return {
          allowedContentTypes: ["image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: parsed.kind === "logo" ? MAX_LOGO_BYTES : MAX_COVER_BYTES,
        };
      },
      onUploadCompleted: async () => {
        // Não usado pra persistir nada — o cliente já chama a Server Action
        // com a URL assim que `upload()` resolve (não depende deste
        // callback, que não alcança localhost — ver README).
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
