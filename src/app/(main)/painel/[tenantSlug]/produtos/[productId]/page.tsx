import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Model3DCard } from "@/components/painel/Model3DCard";
import { ProductForm } from "@/components/painel/ProductForm";
import { TranslationsCard } from "@/components/painel/TranslationsCard";
import { requireTenantOwner } from "@/lib/auth/session";
import { isFresh } from "@/lib/fresh";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

const FRESH_HOURS = Number(process.env.FRESH_HOURS ?? 3);

export default async function EditProductPage(
  props: PageProps<"/painel/[tenantSlug]/produtos/[productId]">,
) {
  const { tenantSlug, productId } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);
  const { categories, products } = await getMenu(tenant.id);
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();

  const category = categories.find((item) => item.id === product.categoryId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <ProductForm
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        categories={categories.map((item) => ({
          id: item.id,
          name: resolveLocalizedText(item.name, "pt", item.i18nStatus),
        }))}
        categoryName={category ? resolveLocalizedText(category.name, "pt", category.i18nStatus) : ""}
        freshInitially={isFresh(product.freshFromOvenAt, FRESH_HOURS)}
        initial={{
          id: product.id,
          categoryId: product.categoryId,
          name: resolveLocalizedText(product.name, "pt", product.i18nStatus),
          description: product.description ? resolveLocalizedText(product.description, "pt", product.i18nStatus) : "",
          priceCents: product.priceCents,
          servings: product.servings,
          allergens: product.allergens,
          mayContain: product.mayContain ?? [],
          available: product.available,
          acceptsOrders: product.acceptsOrders,
        }}
      />

      <div className="flex flex-col gap-6">
        <Model3DCard tenantId={tenant.id} tenantSlug={tenant.slug} product={product} />
        <TranslationsCard
          tenantId={tenant.id}
          kind="product"
          entityId={product.id}
          name={product.name}
          description={product.description}
          i18nStatus={product.i18nStatus}
        />
      </div>
    </div>
  );
}
