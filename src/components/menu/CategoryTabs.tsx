import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Category } from "@/lib/schemas/category";
import { CategoryTabsNav } from "./CategoryTabsNav";

// Pílulas de categoria (mockup 01), sticky no topo ao rolar, com a aba ativa
// destacada conforme a seção visível (CategoryTabsNav, client, via
// IntersectionObserver — precisa do DOM, por isso fica num componente à
// parte). Aqui só resolve os textos no servidor (i18n).
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

  const items = categories.map((category) => ({
    id: category.id,
    label: resolveLocalizedText(category.name, locale, category.i18nStatus),
  }));

  return <CategoryTabsNav items={items} navLabel={t("categoriesNav")} />;
}
