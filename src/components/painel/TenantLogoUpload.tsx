"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { removeTenantLogo, setTenantLogo } from "@/lib/actions/tenant";
import { compressImage } from "@/lib/image-compress";
import { uploadFile } from "@/lib/storage/upload-client";

export function TenantLogoUpload({ tenantId, logoUrl }: { tenantId: string; logoUrl: string | undefined }) {
  const router = useRouter();
  const { showError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Preview local (object URL) enquanto sobe — mesmo padrão do ProductCoverCard.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  // Nesta página especificamente, router.refresh() não entrega a prop
  // `logoUrl` atualizada de forma confiável (achado testando esse card —
  // ao contrário do ProductCoverCard, que atualiza normalmente). Em vez de
  // depender disso, "Remover" marca localmente que a logo já foi removida;
  // se a prop algum dia chegar atualizada mesmo assim, o efeito abaixo
  // reconcilia e volta a confiar nela.
  const [removedLocally, setRemovedLocally] = useState(false);
  const [syncedLogoUrl, setSyncedLogoUrl] = useState(logoUrl);
  if (logoUrl !== syncedLogoUrl) {
    setSyncedLogoUrl(logoUrl);
    setRemovedLocally(false);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
  }

  const previewUrl = removedLocally ? undefined : localPreview ?? logoUrl;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);
    try {
      const { blob } = await compressImage(file, { maxSize: 512 });
      const path = `tenants/${tenantId}/branding/logo.webp`;
      const { url, path: savedPath } = await uploadFile(path, blob, { contentType: "image/webp", access: "public" });
      await setTenantLogo(tenantId, { url, path: savedPath });
      router.refresh();
    } catch {
      URL.revokeObjectURL(objectUrl);
      setLocalPreview(null);
      showError("Não foi possível enviar a logo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeTenantLogo(tenantId);
      setRemovedLocally(true);
      router.refresh();
    } catch {
      showError("Não foi possível remover a logo.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-thumb-1"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de upload local
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted">{uploading ? "..." : "Logo"}</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">Logo da loja</p>
        {previewUrl && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" loading={uploading} onClick={() => inputRef.current?.click()}>
              Trocar
            </Button>
            <Button type="button" variant="danger" loading={removing} disabled={uploading} onClick={handleRemove}>
              Remover
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
