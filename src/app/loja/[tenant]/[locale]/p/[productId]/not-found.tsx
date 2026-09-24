import { getTranslations } from "next-intl/server";

// Mais específico que loja/[tenant]/[locale]/not-found.tsx (que fala de
// loja inexistente) — aqui a loja existe, só o produto que não.
export default async function ProductNotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t("productTitle")}</h1>
      <p className="text-muted">{t("productDescription")}</p>
    </div>
  );
}
