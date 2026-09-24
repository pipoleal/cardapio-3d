import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireTenantOwner } from "@/lib/auth/session";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";
import { formatPriceCents } from "@/lib/price";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function ProductsListPage(
  props: PageProps<"/painel/[tenantSlug]/produtos">,
) {
  const { tenantSlug } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);
  const { categories, products } = await getMenu(tenant.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-ink">Produtos</h1>
        <Link
          href={`/painel/${tenant.slug}/produtos/novo`}
          className="inline-flex min-h-11 items-center justify-center rounded-cta bg-accent px-5 text-sm font-medium text-surface hover:opacity-90"
        >
          Novo produto
        </Link>
      </div>

      {categories.map((category) => {
        const categoryProducts = products.filter((product) => product.categoryId === category.id);
        if (categoryProducts.length === 0) return null;

        return (
          <div key={category.id}>
            <h2 className="font-heading mb-2 text-lg font-semibold text-ink">
              {resolveLocalizedText(category.name, "pt", category.i18nStatus)}
            </h2>
            <Card className="flex flex-col divide-y divide-border">
              {categoryProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/painel/${tenant.slug}/produtos/${product.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-bg"
                >
                  <span className="text-sm font-medium text-ink">
                    {resolveLocalizedText(product.name, "pt", product.i18nStatus)}
                  </span>
                  <span className="text-sm text-muted">{formatPriceCents(product.priceCents, "pt")}</span>
                </Link>
              ))}
            </Card>
          </div>
        );
      })}

      {products.length === 0 && <p className="text-muted">Nenhum produto ainda.</p>}
    </div>
  );
}
