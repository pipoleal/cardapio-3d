export type StorageAccess = "public" | "private";

export type UploadResult = { url: string; path: string };

/**
 * Abstrai onde os arquivos ficam (capa, logo, fotos de captura, GLB/USDZ/
 * poster) — duas implementações, escolhidas por `STORAGE_PROVIDER`
 * (`lib/storage/index.ts`): `firebase` (Storage emulator, sempre em dev) e
 * `vercel-blob` (produção/staging, já que o projeto real não vai ter Cloud
 * Storage — ver docs/DECISOES.md). Um provider nunca sabe o "porquê" de um
 * caminho (isso é regra de negócio de quem chama); só sabe subir, ler e
 * apagar bytes num caminho, público ou privado.
 */
export interface StorageProvider {
  name: "firebase" | "vercel-blob";

  /** Sobe um arquivo a partir do SERVIDOR (ex.: finalize.ts copiando da Meshy, upload manual de GLB). */
  uploadBuffer(
    path: string,
    buffer: Buffer,
    opts: { contentType: string; access: StorageAccess },
  ): Promise<UploadResult>;

  /**
   * URL que um serviço EXTERNO (a Meshy) consegue buscar. Público: a
   * própria URL de sempre. Privado: temporária (curta duração) — nunca a
   * URL "crua" de um arquivo privado.
   */
  getExternalReadUrl(path: string, opts: { access: StorageAccess; ttlSeconds: number }): Promise<string>;

  /** Baixa os bytes no servidor. Só o provider `firebase` usa isso de verdade (emulador, Meshy não alcança 127.0.0.1). */
  downloadBuffer(path: string): Promise<Buffer>;

  /** Apaga um arquivo — usado ao trocar capa/logo/modelo 3D (nunca falha se o arquivo já não existir). */
  delete(path: string, opts: { access: StorageAccess }): Promise<void>;
}
