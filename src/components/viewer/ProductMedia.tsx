import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import type { Product } from "@/lib/schemas/product";
import { ProductViewerLazy } from "./ProductViewerLazy";

type ProductMediaProps = {
  product: Product;
  name: string;
  hasModel: boolean;
  locale: AppLocale;
};

/**
 * Moldura do viewer (mockup 02: 24px de raio, fundo escuro). Mostra o
 * `<model-viewer>` quando há modelo pronto (`hasModel`); senão, cai pra
 * foto de capa. O selo "Modelo 3D" só aparece com modelo de verdade.
 */
export async function ProductMedia({ product, name, hasModel, locale }: ProductMediaProps) {
  // locale explícito: ver o comentário em loja/[tenant]/[locale]/page.tsx.
  const t = await getTranslations({ locale, namespace: "product" });

  return (
    <div className="relative aspect-square overflow-hidden rounded-[24px] bg-bg-panel">
      {hasModel && product.model.glbUrl ? (
        <ProductViewerLazy
          glbUrl={product.model.glbUrl}
          usdzUrl={product.model.usdzUrl}
          posterUrl={product.model.posterUrl}
          alt={name}
        />
      ) : (
        product.coverImage && (
          <Image
            src={product.coverImage.url}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover"
            priority
          />
        )
      )}
      {hasModel && (
        <span className="absolute top-3 left-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-surface">
          {t("model3dBadge")}
        </span>
      )}
    </div>
  );
}
