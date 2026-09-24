/**
 * Redimensiona (≤ maxSize) e comprime pra WebP no navegador antes do
 * upload — Canvas API, sem biblioteca nova (docs/ARQUITETURA.md,
 * "Segurança": compressão no cliente, ≈2048px, qualidade 0,85).
 */
export async function compressImage(
  // Blob, não só File — a captura ao vivo (canvas.toBlob) produz um Blob
  // puro, sem nome/data de arquivo, mas createImageBitmap aceita os dois.
  file: Blob,
  { maxSize = 2048, quality = 0.85 }: { maxSize?: number; quality?: number } = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não suportado neste navegador.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Não foi possível comprimir a imagem.");

  return { blob, width, height };
}
