import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaptureFlow } from "@/components/capture/CaptureFlow";
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

  const { tenant } = await requireTenantOwner(tenantSlug);
  const { products } = await getMenu(tenant.id);
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();

  return (
    <CaptureFlow
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
      productId={product.id}
      productName={resolveLocalizedText(product.name, "pt", product.i18nStatus)}
    />
  );
}
