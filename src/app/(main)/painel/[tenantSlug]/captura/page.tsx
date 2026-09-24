import type { Metadata } from "next";
import { requireTenantOwner } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

// O assistente de captura de verdade (fotos → IA, mockup 03) é a Etapa 4 —
// aqui só existe o item de menu + esta tela, pro layout já bater com o
// mockup 04 desde já.
export default async function CapturaPage(props: PageProps<"/painel/[tenantSlug]/captura">) {
  const { tenantSlug } = await props.params;
  await requireTenantOwner(tenantSlug);

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface p-12 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ink">Captura 3D</h1>
      <p className="max-w-sm text-muted">
        A captura guiada por fotos (IA) chega na Etapa 4. Por enquanto, use a capa do produto
        (tela de edição do produto) pra ilustrar o cardápio.
      </p>
    </div>
  );
}
