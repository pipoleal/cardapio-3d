import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { TranslateStatusRow } from "@/components/painel/TranslateStatusRow";
import { requireTenantOwner } from "@/lib/auth/session";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function TraducoesPage(
  props: PageProps<"/painel/[tenantSlug]/traducoes">,
) {
  const { tenantSlug } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);
  const { categories, products } = await getMenu(tenant.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">Traduções</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Loja</h2>
        <Card className="divide-y divide-border">
          <TranslateStatusRow
            tenantId={tenant.id}
            kind="tenant"
            entityId={tenant.id}
            label={tenant.name}
            status={tenant.i18nStatus}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Categorias</h2>
        <Card className="divide-y divide-border">
          {categories.map((category) => (
            <TranslateStatusRow
              key={category.id}
              tenantId={tenant.id}
              kind="category"
              entityId={category.id}
              label={resolveLocalizedText(category.name, "pt", category.i18nStatus)}
              status={category.i18nStatus}
            />
          ))}
          {categories.length === 0 && <p className="px-5 py-4 text-sm text-muted">Nenhuma categoria.</p>}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Produtos</h2>
        <Card className="divide-y divide-border">
          {products.map((product) => (
            <TranslateStatusRow
              key={product.id}
              tenantId={tenant.id}
              kind="product"
              entityId={product.id}
              label={resolveLocalizedText(product.name, "pt", product.i18nStatus)}
              status={product.i18nStatus}
            />
          ))}
          {products.length === 0 && <p className="px-5 py-4 text-sm text-muted">Nenhum produto.</p>}
        </Card>
      </section>
    </div>
  );
}
