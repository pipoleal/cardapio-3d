import Link from "next/link";
import type { Product } from "@/lib/schemas/product";
import { ProductCoverUpload } from "./ProductCoverUpload";

const STATUS_LABEL: Record<string, string> = {
  none: "Sem captura",
  processing: "Processando",
  ready: "Pronto",
  failed: "Falhou",
};

// A captura 3D de verdade (fotos → IA, Meshy) é a Etapa 4 — por ora este
// card só mostra o status (sempre "Sem captura" pra produtos novos) e
// deixa enviar a foto de capa, que é o que o cardápio público usa até lá.
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
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">Modelo 3D</h2>
        <span className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-muted">
          {STATUS_LABEL[product.model.status]}
        </span>
      </div>

      <ProductCoverUpload tenantId={tenantId} productId={product.id} coverUrl={product.coverImage?.url} />

      <p className="text-xs text-muted">
        A captura 3D por fotos (IA) chega na Etapa 4 — por ora, esta é só a foto de capa do produto.
      </p>

      <Link
        href={`/painel/${tenantSlug}/captura?produto=${product.id}`}
        className="inline-flex min-h-11 items-center justify-center rounded-input border border-border text-sm font-medium text-ink hover:bg-bg"
      >
        Ir pra Captura 3D
      </Link>
    </div>
  );
}
