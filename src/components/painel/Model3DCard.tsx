import type { Product } from "@/lib/schemas/product";
import { Model3DStatus } from "./Model3DStatus";
import { ProductCoverUpload } from "./ProductCoverUpload";

// Foto de capa (usada como fallback no cardápio enquanto não há modelo 3D,
// e sempre como thumbnail) + status ao vivo do pipeline 3D (Model3DStatus).
export function Model3DCard({
  tenantId,
  tenantSlug,
  product,
}: {
  tenantId: string;
  tenantSlug: string;
  product: Product;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <Model3DStatus
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        productId={product.id}
        initialModel={product.model}
      />

      <ProductCoverUpload tenantId={tenantId} productId={product.id} coverUrl={product.coverImage?.url} />
      <p className="text-xs text-muted">Foto de capa — usada como miniatura e enquanto não há modelo 3D.</p>
    </div>
  );
}
