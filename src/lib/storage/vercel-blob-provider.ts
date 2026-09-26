import "server-only";
import { del, head, issueSignedToken, presignUrl, put } from "@vercel/blob";
import type { StorageAccess, StorageProvider, UploadResult } from "./provider";

type BlobAuth = { token: string } | { storeId: string };

/**
 * Dois stores Blob (não dá pra misturar público/privado num store só —
 * confirmado na doc: o modo é fixo na criação do store, não muda depois).
 * A Vercel mudou o modelo padrão pra OIDC em 2026: conectar um store JÁ
 * EXISTENTE ao projeto (Storage → Connect Project) só cria
 * `BLOB_<PREFIXO>_STORE_ID`/`BLOB_<PREFIXO>_WEBHOOK_PUBLIC_KEY`, sem token —
 * o `BLOB_READ_WRITE_TOKEN` estático só nasce automaticamente quando o
 * store é criado do zero pelo assistente "Create Storage" (confirmado
 * testando de verdade, 2026-09-26). `put`/`del`/`issueSignedToken` aceitam
 * `token` OU `storeId` (com o `VERCEL_OIDC_TOKEN`, que a Vercel injeta e
 * roda sozinho) — se algum dia um token estático existir (ex.: outro
 * projeto, ou alguém gerar um manualmente), ele tem prioridade.
 */
function authFor(access: StorageAccess): BlobAuth {
  const suffix = access === "public" ? "PUBLIC" : "PRIVATE";
  const token = process.env[`BLOB_READ_WRITE_TOKEN_${suffix}`];
  if (token) return { token };
  const storeId = process.env[`BLOB_${suffix}_STORE_ID`];
  if (storeId) return { storeId };
  throw new Error(
    `Falta BLOB_READ_WRITE_TOKEN_${suffix} ou BLOB_${suffix}_STORE_ID pra usar STORAGE_PROVIDER=vercel-blob.`,
  );
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
      ...authFor(opts.access),
    });
    return { url: blob.url, path: blob.pathname };
  }

  async getExternalReadUrl(path: string, opts: { access: StorageAccess; ttlSeconds: number }): Promise<string> {
    const auth = authFor(opts.access);
    if (opts.access === "public") {
      const metadata = await head(path, auth);
      return metadata.url;
    }
    // Signed URLs — dá acesso de leitura temporário a um blob PRIVADO pra um
    // serviço externo (a Meshy) buscar direto, sem passar pelos nossos bytes.
    const signedToken = await issueSignedToken({
      pathname: path,
      operations: ["get"],
      validUntil: Date.now() + opts.ttlSeconds * 1000,
      ...auth,
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
    await del(path, authFor(opts.access)).catch(() => {
      // "apagar o que já não existe" não deveria derrubar nada (ex.:
      // produto sem capa anterior) — mesmo espírito do `ignoreNotFound` do
      // provider Firebase.
    });
  }
}
