import type { Metadata } from "next";
import { TenantLogoUpload } from "@/components/painel/TenantLogoUpload";
import { TenantSettingsForm } from "@/components/painel/TenantSettingsForm";
import { requireTenantOwner } from "@/lib/auth/session";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Locale } from "@/lib/schemas/common";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function ConfiguracoesPage(
  props: PageProps<"/painel/[tenantSlug]/configuracoes">,
) {
  const { tenantSlug } = await props.params;
  const { tenant } = await requireTenantOwner(tenantSlug);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">Configurações</h1>

      <TenantLogoUpload tenantId={tenant.id} logoUrl={tenant.logoUrl} />

      <TenantSettingsForm
        tenantId={tenant.id}
        initial={{
          name: tenant.name,
          whatsapp: tenant.whatsapp,
          whatsappMode: tenant.whatsappMode,
          whatsappTemplate: tenant.whatsappTemplate
            ? resolveLocalizedText(tenant.whatsappTemplate, "pt", tenant.i18nStatus)
            : undefined,
          extraLocales: tenant.locales.filter((locale): locale is Exclude<Locale, "pt"> => locale !== "pt"),
          themePrimary: tenant.theme.primary,
        }}
      />
    </div>
  );
}
