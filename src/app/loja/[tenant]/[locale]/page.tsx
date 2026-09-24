import { Suspense, type CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { FreshBanner } from "@/components/menu/FreshBanner";
import { ProductCard } from "@/components/menu/ProductCard";
import { WhatsAppCta } from "@/components/menu/WhatsAppCta";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import type { AppLocale } from "@/i18n/routing";
import { isFresh } from "@/lib/fresh";
import { resolveLocalizedText } from "@/lib/localized-text";
import { getMenu } from "@/lib/menu";
import type { Category } from "@/lib/schemas/category";
import type { Product } from "@/lib/schemas/product";
import { getTenantBySlug } from "@/lib/tenant";
import { buildWhatsappUrl } from "@/lib/whatsapp";

const FRESH_HOURS = Number(process.env.FRESH_HOURS ?? 3);

export async function generateMetadata(
  props: PageProps<"/loja/[tenant]/[locale]">,
): Promise<Metadata> {
  const { tenant: tenantSlug, locale } = await props.params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return {};

  const description = tenant.description
    ? resolveLocalizedText(tenant.description, locale as AppLocale)
    : undefined;

  return {
    title: tenant.name,
    description,
    openGraph: {
      title: tenant.name,
      description,
      images: tenant.coverUrl ? [{ url: tenant.coverUrl }] : undefined,
      locale,
    },
  };
}

export default async function LojaPage(props: PageProps<"/loja/[tenant]/[locale]">) {
  const { tenant: tenantSlug, locale } = await props.params;
  const localeTyped = locale as AppLocale;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [{ categories, products }, t] = await Promise.all([
    getMenu(tenant.id),
    getTranslations("menu"),
  ]);

  const generalWhatsappUrl = buildWhatsappUrl(
    tenant.whatsapp,
    t("whatsappGeneralMessage", { name: tenant.name }),
  );

  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6 pb-28"
      style={{ "--color-accent": tenant.theme.primary } as CSSProperties}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-heading text-2xl font-semibold text-ink">{tenant.name}</h1>
        </div>
        <LanguageSwitcher currentLocale={localeTyped} />
      </header>

      <CategoryTabs categories={categories} locale={localeTyped} />

      {categories.length === 0 || products.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t("empty")}</p>
      ) : (
        <Suspense fallback={<MenuSkeleton />}>
          <MenuSections categories={categories} products={products} locale={localeTyped} />
        </Suspense>
      )}

      {tenant.whatsapp && (
        <WhatsAppCta href={generalWhatsappUrl} label={t("whatsappCta")} />
      )}
    </div>
  );
}

/**
 * "Saiu do forno" depende de `Date.now()` — com `cacheComponents`, isso
 * tem que rodar depois de `connection()` (força o request de verdade) e
 * dentro de `<Suspense>`, senão o build falha tentando decidir se isso é
 * estático (ver node_modules/next/dist/docs/.../08-caching.md, "Random
 * values and timestamps"). Por isso essa parte fica separada da parte
 * estática da página (cabeçalho, abas de categoria).
 */
async function MenuSections({
  categories,
  products,
  locale,
}: {
  categories: Category[];
  products: Product[];
  locale: AppLocale;
}) {
  await connection();
  // Date.now() depois de connection() é o padrão documentado do Next 16
  // pra valores por requisição sob Cache Components; a regra do React
  // Compiler ainda não reconhece connection() como ponto de corte de
  // pureza, por isso o disable a seguir.
  // eslint-disable-next-line -- ver comentário acima (react-hooks/purity)
  const now = Date.now();
  const freshProducts = products.filter((product) => isFresh(product.freshFromOvenAt, FRESH_HOURS, now));

  return (
    <>
      <FreshBanner products={freshProducts} locale={locale} />

      {categories.map((category) => {
        const categoryProducts = products.filter((product) => product.categoryId === category.id);
        if (categoryProducts.length === 0) return null;

        return (
          <section key={category.id} id={`categoria-${category.id}`} className="scroll-mt-16">
            <h2 className="font-heading mb-3 text-xl font-semibold text-ink">
              {resolveLocalizedText(category.name, locale)}
            </h2>
            <div className="flex flex-col gap-3">
              {categoryProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  fresh={isFresh(product.freshFromOvenAt, FRESH_HOURS, now)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function MenuSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-28 animate-pulse rounded-card bg-bg-panel" />
      ))}
    </div>
  );
}
