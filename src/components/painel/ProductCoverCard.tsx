"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { removeProductCover, setProductCover } from "@/lib/actions/products";
import { compressImage } from "@/lib/image-compress";
import { uploadFile } from "@/lib/storage/upload-client";

// Card sempre visível (independe das flags de 3D/IA) — era antes um pedaço
// do Model3DCard, mas a capa é usada pelo cardápio inteiro (miniatura,
// fallback sem modelo 3D), não só pelo pipeline de IA.
export function ProductCoverCard({
  tenantId,
  productId,
  coverUrl,
}: {
  tenantId: string;
  productId: string;
  coverUrl: string | undefined;
}) {
  const router = useRouter();
  const { showError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Preview local (object URL) enquanto sobe — sem esperar o
  // router.refresh() pra ver a foto escolhida.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  // Só limpa o preview local depois que a capa de verdade (prop vinda do
  // servidor, via router.refresh()) chegar — limpar antes causava um
  // flash voltando pro placeholder "Enviar foto" entre o upload acabar e o
  // refresh terminar. Ajuste durante a renderização (não um efeito): é o
  // padrão recomendado pra "resetar estado quando uma prop muda".
  const [syncedCoverUrl, setSyncedCoverUrl] = useState(coverUrl);
  if (coverUrl !== syncedCoverUrl) {
    setSyncedCoverUrl(coverUrl);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
  }

  const previewUrl = localPreview ?? coverUrl;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);
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
      URL.revokeObjectURL(objectUrl);
      setLocalPreview(null);
      showError("Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeProductCover(tenantId, productId);
      router.refresh();
    } catch {
      showError("Não foi possível remover a foto.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="font-heading text-lg font-semibold text-ink">Foto de capa</h2>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-thumb border border-border bg-thumb-1"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de upload local, não é conteúdo do cardápio (que já usa next/image)
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-muted">{uploading ? "Enviando..." : "Enviar foto"}</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {previewUrl && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={uploading} onClick={() => inputRef.current?.click()}>
            Trocar foto
          </Button>
          <Button type="button" variant="danger" loading={removing} disabled={uploading} onClick={handleRemove}>
            Remover
          </Button>
        </div>
      )}

      <p className="text-xs text-muted">Usada como miniatura e enquanto não há modelo 3D.</p>
    </Card>
  );
}
