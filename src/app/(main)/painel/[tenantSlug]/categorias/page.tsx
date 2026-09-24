import type { Metadata } from "next";
import { CategoryManager } from "@/components/painel/CategoryManager";
import { requireTenantOwner } from "@/lib/auth/session";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function CategoriasPage(
  props: PageProps<"/painel/[tenantSlug]/categorias">,
) {
  const { tenantSlug } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);
  const { categories } = await getMenu(tenant.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Categorias</h1>
        <p className="text-muted">Use as setas pra reordenar como aparecem no cardápio.</p>
      </div>
      <CategoryManager
        tenantId={tenant.id}
        categories={categories.map((category) => ({
          id: category.id,
          name: resolveLocalizedText(category.name, "pt", category.i18nStatus),
        }))}
      />
    </div>
  );
}
