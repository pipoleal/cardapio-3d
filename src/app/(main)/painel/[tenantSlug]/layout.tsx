import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/painel/Sidebar";
import { requireTenantOwner } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Sempre dinâmico (sessão + posse do tenant conferidas a cada request) —
// não tem shell estático que valha a pena, mesmo raciocínio do
// `instant = false` da página de produto pública.
export const instant = false;

export default async function PainelTenantLayout(
  props: LayoutProps<"/painel/[tenantSlug]"> & { children: ReactNode },
) {
  const { tenantSlug } = await props.params;
  const { user, tenant, switcherTenants } = await requireTenantOwner(tenantSlug);

  return (
    <div className="flex min-h-dvh bg-bg-panel">
      <Sidebar
        currentSlug={tenant.slug}
        switcherTenants={switcherTenants.map((item) => ({ slug: item.slug, name: item.name }))}
        userEmail={user.email}
        isSuperadmin={user.isSuperadmin}
      />
      <main className="min-w-0 flex-1 overflow-y-auto p-8">{props.children}</main>
    </div>
  );
}
