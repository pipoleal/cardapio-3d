import type { Product } from "@/lib/schemas/product";
import { Model3DStatus } from "./Model3DStatus";

// Status ao vivo do pipeline 3D — a foto de capa saiu daqui pro
// ProductCoverCard, que é sempre visível (independe das flags de 3D/IA).
export function Model3DCard({
  tenantId,
  tenantSlug,
  product,
  isSuperadmin = false,
  fotosIAEnabled,
}: {
  tenantId: string;
  tenantSlug: string;
  product: Product;
  isSuperadmin?: boolean;
  fotosIAEnabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
      <Model3DStatus
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        productId={product.id}
        initialModel={product.model}
        isSuperadmin={isSuperadmin}
        fotosIAEnabled={fotosIAEnabled}
      />
    </div>
  );
}
