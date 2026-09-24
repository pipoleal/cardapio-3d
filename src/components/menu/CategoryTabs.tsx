import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Category } from "@/lib/schemas/category";
import { pillClassName } from "@/components/ui/Pill";

// Pílulas de categoria (mockup 01), sticky no topo ao rolar. Sem
// scroll-spy (destacar a aba conforme a seção visível) nesta etapa — só
// âncoras (#categoria-<id>) + CSS sticky, sem JS.
export async function CategoryTabs({
  categories,
  locale,
}: {
  categories: Category[];
  locale: AppLocale;
}) {
  if (categories.length === 0) return null;

  // locale explícito: ver o comentário em loja/[tenant]/[locale]/page.tsx.
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <nav
      aria-label={t("categoriesNav")}
      className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-bg px-4 py-3"
    >
      {categories.map((category, index) => (
        <a
          key={category.id}
          href={`#categoria-${category.id}`}
          className={pillClassName(index === 0, "shrink-0")}
        >
          {resolveLocalizedText(category.name, locale, category.i18nStatus)}
        </a>
      ))}
    </nav>
  );
}
