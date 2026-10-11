import type { Metadata } from "next";
import { ProductForm } from "@/components/painel/ProductForm";
import { requireTenantOwner } from "@/lib/auth/session";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function NewProductPage(
  props: PageProps<"/painel/[tenantSlug]/produtos/novo">,
) {
  const { tenantSlug } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);
  const { categories } = await getMenu(tenant.id);

  if (categories.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 text-center text-ink">
        Crie uma categoria antes de adicionar produtos.
      </div>
    );
  }

  const firstCategory = categories[0]!;

  return (
    <ProductForm
      // Mesmo motivo do key em produtos/[productId]/page.tsx: sem isso,
      // revisitar /produtos/novo reaproveitava a instância anterior do
      // formulário com os dados do último produto criado ainda dentro
      // (ver docs/DECISOES.md). randomUUID() garante um valor novo a cada
      // vez que este Server Component roda (a rota é sempre dinâmica);
      // Date.now() aqui é barrado pelo lint (react-hooks/purity).
      key={crypto.randomUUID()}
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
      categories={categories.map((item) => ({
        id: item.id,
        name: resolveLocalizedText(item.name, "pt", item.i18nStatus),
      }))}
      categoryName={resolveLocalizedText(firstCategory.name, "pt", firstCategory.i18nStatus)}
      freshInitially={false}
      initial={{
        categoryId: firstCategory.id,
        name: "",
        description: "",
        priceCents: 0,
        allergens: [],
        mayContain: [],
        available: true,
        acceptsOrders: true,
      }}
    />
  );
}
