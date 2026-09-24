import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import type { Product } from "@/lib/schemas/product";

type ProductMediaProps = {
  product: Product;
  name: string;
  hasModel: boolean;
  locale: AppLocale;
};

/**
 * Moldura do viewer (mockup 02: 24px de raio, fundo escuro). Por enquanto
 * mostra a foto de capa no lugar do `<model-viewer>` — isso é a Etapa 4.
 * O selo "Modelo 3D" só aparece quando `hasModel` for true; a dica
 * "arraste para girar" fica de fora enquanto não há 3D de verdade (seria
 * enganosa numa foto estática).
 */
export async function ProductMedia({ product, name, hasModel, locale }: ProductMediaProps) {
  // locale explícito: ver o comentário em loja/[tenant]/[locale]/page.tsx.
  const t = await getTranslations({ locale, namespace: "product" });

  return (
    <div className="relative aspect-square overflow-hidden rounded-[24px] bg-bg-panel">
      {product.coverImage && (
        <Image
          src={product.coverImage.url}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, 480px"
          className="object-cover"
          priority
        />
      )}
      {hasModel && (
        <span className="absolute top-3 left-3 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-surface">
          {t("model3dBadge")}
        </span>
      )}
    </div>
  );
}
