import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CaptureFlow } from "@/components/capture/CaptureFlow";
import { isFeatureEnabled } from "@/config/features";
import { requireTenantOwner } from "@/lib/auth/session";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Lê searchParams (?produto=) direto — sem shell estático que valha a pena
// numa tela de captura (mesmo raciocínio de /entrar).
export const instant = false;

export default async function CapturaPage(props: PageProps<"/painel/[tenantSlug]/captura">) {
  const { tenantSlug } = await props.params;
  const { produto } = await props.searchParams;
  const productId = Array.isArray(produto) ? produto[0] : produto;
  if (!productId) notFound();

  const { tenant, user } = await requireTenantOwner(tenantSlug);
  // Barreira no servidor, não só esconder o link do menu — alguém podia
  // digitar a URL direto (ver src/config/features.ts).
  if (!isFeatureEnabled(tenant, "fotosIA")) redirect(`/painel/${tenant.slug}/produtos/${productId}`);
  const { products } = await getMenu(tenant.id);
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();

  return (
    <CaptureFlow
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
      productId={product.id}
      productName={resolveLocalizedText(product.name, "pt", product.i18nStatus)}
      isSuperadmin={user.isSuperadmin}
    />
  );
}
