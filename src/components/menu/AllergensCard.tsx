import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { AppLocale } from "@/i18n/routing";
import { ALLERGEN_LABELS } from "@/lib/allergens";
import type { Allergen } from "@/lib/schemas/common";

type AllergensCardProps = {
  allergens: Allergen[];
  mayContain?: Allergen[];
  locale: AppLocale;
};

// Card de alergênicos (mockup 02): ícone de alerta + chips + "pode conter traços de…".
export async function AllergensCard({ allergens, mayContain, locale }: AllergensCardProps) {
  if (allergens.length === 0 && (!mayContain || mayContain.length === 0)) return null;

  // locale explícito: ver o comentário em loja/[tenant]/[locale]/page.tsx.
  const t = await getTranslations({ locale, namespace: "product" });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <WarningIcon />
        <p className="font-semibold text-ink">{t("allergensTitle")}</p>
      </div>
      {allergens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allergens.map((allergen) => (
            <Chip key={allergen}>{ALLERGEN_LABELS[allergen][locale]}</Chip>
          ))}
        </div>
      )}
      {mayContain && mayContain.length > 0 && (
        <p className="text-sm text-muted">
          {t("mayContainTraces", {
            list: mayContain.map((allergen) => ALLERGEN_LABELS[allergen][locale]).join(", "),
          })}
        </p>
      )}
    </Card>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 2 20h20L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
