import "server-only";
import { del, head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import type { StorageAccess, StorageProvider, UploadResult } from "./provider";

/**
 * Dois stores Blob (não dá pra misturar público/privado num store só —
 * confirmado na doc: o modo é fixo na criação do store, não muda depois),
 * cada um com o próprio token, gerados ao conectar o store no projeto
 * Vercel (docs/DEPLOY-STAGING.md).
 */
function tokenFor(access: StorageAccess): string {
  const envVar = access === "public" ? "BLOB_READ_WRITE_TOKEN_PUBLIC" : "BLOB_READ_WRITE_TOKEN_PRIVATE";
  const token = process.env[envVar];
  if (!token) throw new Error(`Falta ${envVar} pra usar STORAGE_PROVIDER=vercel-blob.`);
  return token;
}

export class VercelBlobStorageProvider implements StorageProvider {
  name = "vercel-blob" as const;

  async uploadBuffer(
    path: string,
    buffer: Buffer,
    opts: { contentType: string; access: StorageAccess },
  ): Promise<UploadResult> {
    const blob = await put(path, buffer, {
      access: opts.access,
      contentType: opts.contentType,
      addRandomSuffix: true,
      token: tokenFor(opts.access),
    });
    return { url: blob.url, path: blob.pathname };
  }

  async getExternalReadUrl(path: string, opts: { access: StorageAccess; ttlSeconds: number }): Promise<string> {
    const token = tokenFor(opts.access);
    if (opts.access === "public") {
      const metadata = await head(path, { token });
      return metadata.url;
    }
    // Signed URLs (feature nova do Vercel Blob, confirmada na doc em
    // 2026-09) — dá acesso de leitura temporário a um blob PRIVADO pra um
    // serviço externo (a Meshy) buscar direto, sem passar pelos nossos bytes.
    const signedToken = await issueSignedToken({
      pathname: path,
      operations: ["get"],
      validUntil: Date.now() + opts.ttlSeconds * 1000,
      token,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "get",
      pathname: path,
      access: "private",
    });
    return presignedUrl;
  }

  async downloadBuffer(path: string): Promise<Buffer> {
    // Nunca chamado na prática (a Meshy busca direto pela URL — ver
    // getExternalReadUrl), mas implementado por completude/robustez em vez
    // de lançar — evita uma armadilha se algo novo vier a chamar isto.
    const url = await this.getExternalReadUrl(path, { access: "private", ttlSeconds: 60 });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha baixando ${path} do Blob: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(path: string, opts: { access: StorageAccess }): Promise<void> {
    await del(path, { token: tokenFor(opts.access) }).catch(() => {
      // "apagar o que já não existe" não deveria derrubar nada (ex.:
      // produto sem capa anterior) — mesmo espírito do `ignoreNotFound` do
      // provider Firebase.
    });
  }
}
