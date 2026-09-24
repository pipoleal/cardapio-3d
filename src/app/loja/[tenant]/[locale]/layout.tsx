import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isAppLocale } from "@/i18n/routing";
import { getTenantBySlug } from "@/lib/tenant";

export default async function LojaLayout(props: LayoutProps<"/loja/[tenant]/[locale]">) {
  const { tenant: tenantSlug, locale } = await props.params;

  // Locale inválido (alguém batendo direto em /loja/x/xx) ou tenant que não
  // existe/está inativo: 404 com a página em src/app/loja/[tenant]/[locale]/not-found.tsx.
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  return (
    <div
      className="min-h-dvh bg-bg text-ink"
      style={{ "--color-accent": tenant.theme.primary } as CSSProperties}
    >
      {props.children}
    </div>
  );
}
