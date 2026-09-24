import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buildExternalPath } from "@/i18n/resolve-locale";
import type { AppLocale } from "@/i18n/routing";
import { ALLERGEN_LABELS } from "@/lib/allergens";
import { cn } from "@/lib/cn";
import { resolveLocalizedText } from "@/lib/localized-text";
import { formatPriceCents } from "@/lib/price";
import type { Product } from "@/lib/schemas/product";

type ProductCardProps = {
  product: Product;
  locale: AppLocale;
  fresh: boolean;
};

// Card do cardápio (mockup 01): miniatura 96px + selo 3D, nome, descrição
// 2 linhas, "Contém/Pode conter" em texto (não chip — isso é só na página
// do produto), preço ou "Esgotado hoje".
export async function ProductCard({ product, locale, fresh }: ProductCardProps) {
  const t = await getTranslations("menu");
  const name = resolveLocalizedText(product.name, locale, product.i18nStatus);
  const description = product.description
    ? resolveLocalizedText(product.description, locale, product.i18nStatus)
    : undefined;
  const has3d = product.model.status === "ready";

  const allergenNames = product.allergens.map((allergen) => ALLERGEN_LABELS[allergen][locale]);
  const mayContainNames = (product.mayContain ?? []).map(
    (allergen) => ALLERGEN_LABELS[allergen][locale],
  );

  return (
    <Link
      href={buildExternalPath(locale, `/p/${product.id}`)}
      className={cn(
        "flex gap-3 rounded-card border border-border bg-surface p-3 transition-opacity",
        !product.available && "opacity-60",
      )}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-thumb bg-bg-panel">
        {product.coverImage && (
          <Image src={product.coverImage.url} alt={name} fill sizes="96px" className="object-cover" />
        )}
        {has3d && (
          <span className="absolute bottom-1 left-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-surface">
            {t("badge3d")}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold text-ink">{name}</p>
        {description && <p className="line-clamp-2 text-sm text-muted">{description}</p>}
        {allergenNames.length > 0 && (
          <p className="text-xs text-muted">
            {t("contains")}: {allergenNames.join(", ")}
            {mayContainNames.length > 0 && (
              <>
                {" · "}
                {t("mayContain")}: {mayContainNames.join(", ")}
              </>
            )}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          {fresh && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-surface">
              {t("freshBadge")}
            </span>
          )}
          {!product.available ? (
            <span className="text-xs font-medium text-muted">{t("soldOutBadge")}</span>
          ) : (
            <span className="font-semibold text-ink">
              {formatPriceCents(product.priceCents, locale)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
