"use client";

import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { setTenantLogo } from "@/lib/actions/tenant";
import { storage } from "@/lib/firebase/client";
import { compressImage } from "@/lib/image-compress";
import { toPublicStorageUrl } from "@/lib/storage-url";

export function TenantLogoUpload({ tenantId, logoUrl }: { tenantId: string; logoUrl: string | undefined }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { blob } = await compressImage(file, { maxSize: 512 });
      const path = `tenants/${tenantId}/branding/logo.webp`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, blob, { contentType: "image/webp" });
      const url = toPublicStorageUrl(await getDownloadURL(fileRef));
      await setTenantLogo(tenantId, url);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-thumb-1"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de upload local
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted">{uploading ? "..." : "Logo"}</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <p className="text-sm text-muted">Logo da loja</p>
    </div>
  );
}
