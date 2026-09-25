import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MarkFreshForm } from "@/components/painel/MarkFreshForm";
import { requireTenantOwner } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";
import { getStats } from "@/lib/stats";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

const MODEL_STATUS_LABEL: Record<string, string> = {
  none: "Sem captura",
  processing: "Processando",
  ready: "Publicado",
  failed: "Falhou",
};

const LOCALE_LABEL: Record<string, string> = { pt: "Português", en: "Inglês", es: "Espanhol" };
const LOCALE_COLOR: Record<string, string> = { pt: "bg-ink", en: "bg-accent", es: "bg-border" };
const ORIGIN_LABEL: Record<string, string> = {
  direto: "Direto",
  instagram: "Instagram",
  loja: "Loja",
  mesa: "Mesa",
  vitrine: "Vitrine",
};

function originLabel(origin: string): string {
  return ORIGIN_LABEL[origin] ?? origin.charAt(0).toUpperCase() + origin.slice(1);
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export default async function PainelVisaoGeralPage(
  props: PageProps<"/painel/[tenantSlug]">,
) {
  const { tenantSlug } = await props.params;
  const { dias } = await props.searchParams;
  const days = (Array.isArray(dias) ? dias[0] : dias) === "30" ? 30 : 7;

  const { tenant } = await requireTenantOwner(tenantSlug);
  const [{ products }, stats] = await Promise.all([getMenu(tenant.id), getStats(tenant.id, days)]);

  const freshCandidates = products.map((product) => ({
    id: product.id,
    name: resolveLocalizedText(product.name, "pt", product.i18nStatus),
  }));

  const topProducts = products
    .map((product) => ({
      id: product.id,
      name: resolveLocalizedText(product.name, "pt", product.i18nStatus),
      ...( stats.byProduct[product.id] ?? { views: 0, modelOpens: 0, arOpens: 0, whatsappClicks: 0 }),
    }))
    .filter((product) => product.views > 0)
    .sort((a, b) => b.views - a.views);

  const localeTotal = Object.values(stats.byLocale).reduce((sum, value) => sum + value, 0);
  const localeBreakdown = (["pt", "en", "es"] as const).map((locale) => ({
    locale,
    count: stats.byLocale[locale] ?? 0,
    percent: percent(stats.byLocale[locale] ?? 0, localeTotal),
  }));

  const originTotal = Object.values(stats.byOrigin).reduce((sum, value) => sum + value, 0);
  const originBreakdown = Object.entries(stats.byOrigin)
    .map(([origin, count]) => ({ origin, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const funnelRate = percent(stats.whatsappClicks, stats.modelOpens);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink">Visão geral</h1>
          <p className="text-muted">Como o cardápio está sendo usado</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-border">
            {([7, 30] as const).map((option) => (
              <Link
                key={option}
                href={`?dias=${option}`}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  days === option ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-bg",
                )}
              >
                Últimos {option} dias
              </Link>
            ))}
          </div>
          <MarkFreshForm tenantId={tenant.id} products={freshCandidates} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted">Acessos ao cardápio</p>
          <p className="font-heading mt-2 text-3xl font-semibold text-ink">{stats.menuViews}</p>
          <p className="mt-1 text-xs text-muted">via QR code e Instagram</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Aberturas do 3D</p>
          <p className="font-heading mt-2 text-3xl font-semibold text-ink">{stats.modelOpens}</p>
          <p className="mt-1 text-xs text-muted">giraram algum produto</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Aberturas em AR</p>
          <p className="font-heading mt-2 text-3xl font-semibold text-ink">{stats.arOpens}</p>
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
          <p className="font-heading mt-2 text-3xl font-semibold">{stats.whatsappClicks}</p>
          <p className="mt-1 text-xs text-surface/70">principal conversão</p>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-heading text-lg font-semibold text-ink">Abriu o 3D → clicou no WhatsApp</h2>
        <p className="mt-2 text-sm text-muted">
          {stats.modelOpens} {stats.modelOpens === 1 ? "abertura" : "aberturas"} do 3D → {stats.whatsappClicks}{" "}
          {stats.whatsappClicks === 1 ? "clique" : "cliques"} no WhatsApp
          {stats.modelOpens > 0 && <span className="font-semibold text-ink"> ({funnelRate}%)</span>}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="flex flex-col gap-5 p-5">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">Produtos mais vistos</h2>
            {topProducts.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Ainda sem visitas nesse período.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-2 font-medium">Produto</th>
                      <th className="py-2 font-medium">Viram em 3D</th>
                      <th className="py-2 font-medium">Abriram AR</th>
                      <th className="py-2 font-medium">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="py-2 pr-2 font-medium text-ink">{product.name}</td>
                        <td className="py-2 text-muted">{product.modelOpens}</td>
                        <td className="py-2 text-muted">{product.arOpens}</td>
                        <td className="py-2 text-muted">{product.whatsappClicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">Idiomas usados</h2>
            {localeTotal === 0 ? (
              <p className="mt-2 text-sm text-muted">Ainda sem visitas nesse período.</p>
            ) : (
              <>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                  {localeBreakdown.map(
                    (item) =>
                      item.percent > 0 && (
                        <div
                          key={item.locale}
                          className={LOCALE_COLOR[item.locale]}
                          style={{ width: `${item.percent}%` }}
                        />
                      ),
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {localeBreakdown.map((item) => `${LOCALE_LABEL[item.locale]} ${item.percent}%`).join(" · ")}
                </p>
              </>
            )}
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">Acessos por origem</h2>
            {originBreakdown.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Ainda sem visitas nesse período.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {originBreakdown.map((item) => (
                  <li key={item.origin} className="flex items-center justify-between">
                    <span className="text-ink">{originLabel(item.origin)}</span>
                    <span className="text-muted">
                      {item.count} · {percent(item.count, originTotal)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
