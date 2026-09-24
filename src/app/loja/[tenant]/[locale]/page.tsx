import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import type { AppLocale } from "@/i18n/routing";
import { getTenantBySlug } from "@/lib/tenant";

// Placeholder da Etapa 1: confirma que host -> tenant e locale -> mensagens
// já funcionam de ponta a ponta. O cardápio de verdade (mockup 01) é a Etapa 2.
export default async function LojaPage(props: PageProps<"/loja/[tenant]/[locale]">) {
  const { tenant: tenantSlug, locale } = await props.params;

  const [tenant, t] = await Promise.all([getTenantBySlug(tenantSlug), getTranslations("store")]);
  if (!tenant) notFound();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-heading text-2xl font-semibold text-ink">{tenant.name}</h1>
        </div>
        <LanguageSwitcher currentLocale={locale as AppLocale} />
      </header>

      <Card className="p-4">
        <h2 className="font-heading text-lg font-semibold text-ink">{t("placeholderTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("placeholderBody", { name: tenant.name })}</p>
      </Card>
    </div>
  );
}
