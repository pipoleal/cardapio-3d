import type { Metadata } from "next";
import { QrCodeGenerator } from "@/components/painel/QrCodeGenerator";
import { requireTenantOwner } from "@/lib/auth/session";
import { buildTenantOrigin } from "@/lib/tenant-host";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function QrCodePage(props: PageProps<"/painel/[tenantSlug]/qrcode">) {
  const { tenantSlug } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const origin = buildTenantOrigin(tenant.slug, rootDomain);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">QR Code</h1>
        <p className="text-muted">Pro balcão (impresso) e pro link da bio do Instagram.</p>
      </div>
      <QrCodeGenerator counterUrl={`${origin}/?origem=loja`} instagramUrl={`${origin}/?origem=instagram`} />
    </div>
  );
}
