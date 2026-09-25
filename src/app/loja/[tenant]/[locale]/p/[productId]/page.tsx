import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { AllergensCard } from "@/components/menu/AllergensCard";
import { DiscreetWhatsappLink } from "@/components/menu/DiscreetWhatsappLink";
import { ProductPurchasePanel } from "@/components/menu/ProductPurchasePanel";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ArButton } from "@/components/viewer/ArButton";
import { ProductMedia } from "@/components/viewer/ProductMedia";
import { buildExternalPath } from "@/i18n/resolve-locale";
import type { AppLocale } from "@/i18n/routing";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";
import { ORIGIN_DIRECT, shouldShowDiscreetWhatsappHint, shouldShowProminentWhatsappCta } from "@/lib/origin";
import { getTenantBySlug } from "@/lib/tenant";
import { buildTenantOrigin } from "@/lib/tenant-host";
import { buildProductWhatsappUrl } from "@/lib/whatsapp";

// Sem generateStaticParams aqui (não dá pra listar todo productId possível
// de toda loja) — cada produto é 100% específico, não tem shell estático
// que faça sentido reaproveitar. `instant = false` avisa o Cache
// Components disso, em vez de tentar (e falhar) prerenderizar.
export const instant = false;

async function loadProduct(tenantSlug: string, productId: string) {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;

  const { products } = await getMenu(tenant.id);
  const product = products.find((item) => item.id === productId);
  if (!product) return null;

  return { tenant, product };
}

export async function generateMetadata(
  props: PageProps<"/loja/[tenant]/[locale]/p/[productId]">,
): Promise<Metadata> {
  const { tenant: tenantSlug, locale, productId } = await props.params;
  const result = await loadProduct(tenantSlug, productId);
  if (!result) {
    // Produto inexistente/removido: nunca indexar (URL não é permanente —
    // um productId reciclado ou um link velho não deveria aparecer no Google).
    const tNotFound = await getTranslations({ locale, namespace: "notFound" });
    return {
      title: tNotFound("productTitle"),
      robots: { index: false, follow: false },
    };
  }

  const localeTyped = locale as AppLocale;
  const { product } = result;
  const name = resolveLocalizedText(product.name, localeTyped, product.i18nStatus);
  const description = product.description
    ? resolveLocalizedText(product.description, localeTyped, product.i18nStatus)
    : undefined;

  return {
    title: name,
    description,
    openGraph: {
      title: name,
      description,
      images: product.coverImage ? [{ url: product.coverImage.url }] : undefined,
      locale,
    },
  };
}

export default async function ProductPage(
  props: PageProps<"/loja/[tenant]/[locale]/p/[productId]">,
) {
  const { tenant: tenantSlug, locale, productId } = await props.params;
  const localeTyped = locale as AppLocale;

  const result = await loadProduct(tenantSlug, productId);

  if (!result) {
    // Renderiza direto aqui em vez de `notFound()` + not-found.tsx: esse
    // boundary não recebe `params`, e `next/root-params` + `connection()`
    // pra descobrir o locale lá mostrou um bug real de cache cruzado entre
    // locales nessa rota específica (confirmado em dev E em `next start`,
    // não é só do dev). A página já tem `localeTyped` de sobra e resolvido
    // sem ambiguidade, então é mais simples e mais confiável resolver aqui.
    const tNotFound = await getTranslations({ locale: localeTyped, namespace: "notFound" });
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="font-heading text-2xl font-semibold text-ink">
          {tNotFound("productTitle")}
        </h1>
        <p className="text-muted">{tNotFound("productDescription")}</p>
      </div>
    );
  }

  const { tenant, product } = result;

  // locale explícito: sem isso, getTranslations() às vezes resolve a
  // config errada (corrida de cache do next-intl — achado testando /en e
  // /es com Playwright).
  const [t, tProduct] = await Promise.all([
    getTranslations({ locale: localeTyped, namespace: "menu" }),
    getTranslations({ locale: localeTyped, namespace: "product" }),
  ]);

  const name = resolveLocalizedText(product.name, localeTyped, product.i18nStatus);
  const description = product.description
    ? resolveLocalizedText(product.description, localeTyped, product.i18nStatus)
    : undefined;

  const hasModel =
    product.model.status === "ready" && Boolean(product.model.glbUrl || product.model.usdzUrl);

  // Mesmo i18nStatus do produto — a aprovação é por produto, não por campo.
  const nameInStoreLocale = resolveLocalizedText(product.name, tenant.defaultLocale, product.i18nStatus);

  const variants = (product.variants ?? []).map((variant) => ({
    id: variant.id,
    name: resolveLocalizedText(variant.name, localeTyped, product.i18nStatus),
    nameInStoreLocale: resolveLocalizedText(variant.name, tenant.defaultLocale, product.i18nStatus),
    priceCents: variant.priceCents,
  }));

  const whatsappTemplate = tenant.whatsappTemplate
    ? resolveLocalizedText(tenant.whatsappTemplate, localeTyped, tenant.i18nStatus)
    : tProduct("defaultWhatsappTemplate");

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const productUrl = `${buildTenantOrigin(tenantSlug, rootDomain)}${buildExternalPath(localeTyped, `/p/${product.id}`)}`;

  // headers() direto (sem Suspense extra) só é seguro aqui porque a página
  // já é `instant = false` — não tem shell estático protegido, então não
  // há o que "vazar" pro prerender bloqueando.
  const origin = (await headers()).get("x-origin") ?? ORIGIN_DIRECT;
  const showProminentCta = product.acceptsOrders && shouldShowProminentWhatsappCta(origin, tenant.whatsappMode);
  const showDiscreetHint = product.acceptsOrders && shouldShowDiscreetWhatsappHint(origin, tenant.whatsappMode);

  // Link do botão discreto "encomendar para outro dia": genérico, sem
  // variante específica (não depende do seletor de tamanho, que é estado
  // client-side dentro do ProductPurchasePanel).
  const discreetWhatsappUrl = buildProductWhatsappUrl({
    phone: tenant.whatsapp,
    template: whatsappTemplate,
    clientLocale: localeTyped,
    storeDefaultLocale: tenant.defaultLocale,
    productName: name,
    productNameInStoreLocale: nameInStoreLocale,
    productUrl,
  });

  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-4 pb-32"
      style={{ "--color-accent": tenant.theme.primary } as CSSProperties}
    >
      <header className="flex items-center justify-between gap-4">
        <Link
          href={buildExternalPath(localeTyped, "/")}
          aria-label={tProduct("back")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface"
        >
          <BackIcon />
        </Link>
        <p className="truncate text-sm font-medium text-muted">{tenant.name}</p>
        <LanguageSwitcher currentLocale={localeTyped} variant="compact" />
      </header>

      <TrackPageView event="product_view" tenantId={tenant.id} productId={product.id} locale={localeTyped} origin={origin} />

      <ProductMedia
        product={product}
        name={name}
        hasModel={hasModel}
        locale={localeTyped}
        tenantId={tenant.id}
        origin={origin}
      />

      {/* "Ver na sua mesa (AR)" só existe quando há modelo de verdade — bem
          escondido, não desabilitado (um botão cinza pareceria quebrado). */}
      {hasModel && <ArButton label={tProduct("arButton")} />}

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold text-ink">{name}</h1>
      </div>

      <ProductPurchasePanel
        locale={localeTyped}
        storeDefaultLocale={tenant.defaultLocale}
        basePriceCents={product.priceCents}
        variants={variants}
        sizeLabel={tProduct("sizeLabel")}
        servesLabel={product.servings ? tProduct("servesN", { count: product.servings }) : undefined}
        phone={tenant.whatsapp}
        whatsappTemplate={whatsappTemplate}
        productName={name}
        productNameInStoreLocale={nameInStoreLocale}
        productUrl={productUrl}
        whatsappCtaLabel={t("whatsappCta")}
        whatsappCaption={tProduct("whatsappCaption")}
        showProminentCta={showProminentCta}
        tenantId={tenant.id}
        productId={product.id}
        origin={origin}
      />

      {description && <p className="text-sm text-muted">{description}</p>}

      <AllergensCard allergens={product.allergens} mayContain={product.mayContain} locale={localeTyped} />

      {showDiscreetHint && (
        <DiscreetWhatsappLink
          href={discreetWhatsappUrl}
          label={tProduct("discreetWhatsappHint")}
          tenantId={tenant.id}
          productId={product.id}
          locale={localeTyped}
          origin={origin}
          testId="whatsapp-hint-discreet"
        />
      )}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
