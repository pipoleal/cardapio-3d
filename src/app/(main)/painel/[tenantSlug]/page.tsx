import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MarkFreshForm } from "@/components/painel/MarkFreshForm";
import { requireTenantOwner } from "@/lib/auth/session";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

const MODEL_STATUS_LABEL: Record<string, string> = {
  none: "Sem captura",
  processing: "Processando",
  ready: "Publicado",
  failed: "Falhou",
};

// KPIs/"Produtos mais vistos"/"Idiomas usados" dependem de `stats/{dia}`
// (Etapa 5 — ainda não existe). O layout já bate com o mockup 04; os
// números reais chegam quando o /api/track existir. "Modelos 3D" é real
// (lido direto de `product.model.status`, sem depender de analytics).
export default async function PainelVisaoGeralPage(
  props: PageProps<"/painel/[tenantSlug]">,
) {
  const { tenantSlug } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);
  const { products } = await getMenu(tenant.id);

  const freshCandidates = products.map((product) => ({
    id: product.id,
    name: resolveLocalizedText(product.name, "pt", product.i18nStatus),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Visão geral</h1>
          <p className="text-muted">Como o cardápio está sendo usado</p>
        </div>
        <MarkFreshForm tenantId={tenant.id} products={freshCandidates} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted">Acessos ao cardápio</p>
          <p className="font-heading mt-2 text-3xl font-semibold text-ink">—</p>
          <p className="mt-1 text-xs text-muted">via QR code e Instagram</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Aberturas do 3D</p>
          <p className="font-heading mt-2 text-3xl font-semibold text-ink">—</p>
          <p className="mt-1 text-xs text-muted">giraram algum produto</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Aberturas em AR</p>
          <p className="font-heading mt-2 text-3xl font-semibold text-ink">—</p>
          <p className="mt-1 text-xs text-muted">viram o produto na mesa</p>
        </Card>
        {/* Não usa <Card>: seu `bg-surface` embutido e este `bg-ink` são só
            concatenados (cn() não faz merge de classes Tailwind
            conflitantes) — qual dos dois "ganha" depende da ordem de
            geração do CSS, não da ordem das classes. Resultado real
            (achado comparando o screenshot com o mockup 04): o card saía
            com fundo claro (bg-surface) em vez de escuro. */}
        <div className="rounded-card border border-border bg-ink p-5 text-surface">
          <p className="text-sm text-surface/70">Cliques no WhatsApp</p>
          <p className="font-heading mt-2 text-3xl font-semibold">—</p>
          <p className="mt-1 text-xs text-surface/70">principal conversão</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col gap-5 p-5">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">Produtos mais vistos</h2>
            <p className="mt-1 text-sm text-muted">Disponível a partir da Etapa 5 (analytics).</p>
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">Idiomas usados</h2>
            <p className="mt-1 text-sm text-muted">Disponível a partir da Etapa 5 (analytics).</p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-heading text-lg font-semibold text-ink">Modelos 3D</h2>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-ink">
                  {resolveLocalizedText(product.name, "pt", product.i18nStatus)}
                </p>
                {product.model.status === "none" ? (
                  <Link
                    href={`/painel/${tenant.slug}/captura?produto=${product.id}`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Capturar agora
                  </Link>
                ) : (
                  <span
                    className={
                      product.model.status === "ready"
                        ? "text-sm font-medium text-success"
                        : product.model.status === "failed"
                          ? "text-sm font-medium text-rec"
                          : "text-sm font-medium text-warning"
                    }
                  >
                    {MODEL_STATUS_LABEL[product.model.status]}
                  </span>
                )}
              </div>
            ))}
            {products.length === 0 && <p className="py-3 text-sm text-muted">Nenhum produto ainda.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
