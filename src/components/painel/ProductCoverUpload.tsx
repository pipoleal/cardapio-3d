"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { setProductCover } from "@/lib/actions/products";
import { compressImage } from "@/lib/image-compress";
import { uploadFile } from "@/lib/storage/upload-client";

export function ProductCoverUpload({
  tenantId,
  productId,
  coverUrl,
}: {
  tenantId: string;
  productId: string;
  coverUrl: string | undefined;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const { blob, width, height } = await compressImage(file);
      // Caminho "canônico" — no provider Firebase é fixo (sobrescreve
      // sempre a mesma foto); no Vercel Blob ganha um sufixo aleatório e o
      // arquivo anterior é apagado depois (ver setProductCover).
      const path = `tenants/${tenantId}/products/${productId}/cover.webp`;
      const { url, path: savedPath } = await uploadFile(path, blob, { contentType: "image/webp", access: "public" });
      await setProductCover(tenantId, productId, { url, path: savedPath, w: width, h: height });
      router.refresh();
    } catch {
      setError("Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-thumb border border-border bg-thumb-1"
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de upload local, não é conteúdo do cardápio (que já usa next/image)
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-muted">{uploading ? "Enviando..." : "Enviar foto"}</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <p className="text-xs text-rec">{error}</p>}
    </div>
  );
}
