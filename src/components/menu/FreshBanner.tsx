import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import type { AppLocale } from "@/i18n/routing";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Product } from "@/lib/schemas/product";

// Faixa "Saiu do forno agora" (mockup 01). `products` já vem filtrado pra
// quem está fresh (ver isFresh em lib/fresh.ts, calculado na página).
export async function FreshBanner({
  products,
  locale,
}: {
  products: Product[];
  locale: AppLocale;
}) {
  if (products.length === 0) return null;

  // locale explícito: ver o comentário em loja/[tenant]/[locale]/page.tsx.
  const t = await getTranslations({ locale, namespace: "menu" });
  const names = products
    .map((product) => resolveLocalizedText(product.name, locale, product.i18nStatus))
    .join(" · ");

  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <div>
        <p className="font-semibold text-ink">{t("freshBannerTitle")}</p>
        <p className="text-sm text-muted">
          {names} · {t("freshBannerSuffix")}
        </p>
      </div>
    </Card>
  );
}
