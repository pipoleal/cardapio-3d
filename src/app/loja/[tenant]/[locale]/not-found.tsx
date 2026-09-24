import { getTranslations } from "next-intl/server";

export default async function LojaNotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ink">{t("title")}</h1>
      <p className="text-muted">{t("description")}</p>
    </div>
  );
}
