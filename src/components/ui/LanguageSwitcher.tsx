"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { buildExternalPath, resolveLocaleForPath } from "@/i18n/resolve-locale";
import { routing, type AppLocale } from "@/i18n/routing";
import { pillClassName } from "./Pill";

const LABELS: Record<AppLocale, string> = { pt: "PT", en: "EN", es: "ES" };

type LanguageSwitcherProps = {
  currentLocale: AppLocale;
  /** `/l/<slug>` no modo por caminho da staging, `""` no modo subdomínio — ver `tenantPathPrefix`. */
  tenantPrefix: string;
  /** "pills": grupo PT/EN/ES lado a lado (mockup 01). "compact": globo + locale atual, abre as opções (mockup 02). */
  variant?: "pills" | "compact";
};

// Troca só o locale, mantém tenant e o resto do path — usa a mesma
// resolução do proxy.ts para não duplicar a regra de onde o prefixo de
// locale aparece na URL. `usePathname()` no modo por caminho devolve o path
// com "/l/<slug>" ainda na frente (é o que o navegador vê de verdade) — por
// isso `tenantPrefix` precisa ser tirado antes de resolver o locale e posto
// de volta ao montar o link novo.
export function LanguageSwitcher({ currentLocale, tenantPrefix, variant = "pills" }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const { pathWithoutLocale } = resolveLocaleForPath(pathname, currentLocale, tenantPrefix);
  const [open, setOpen] = useState(false);
  const t = useTranslations("common");

  const isCompact = variant === "compact";

  const options = routing.locales.map((locale) => (
    <Link
      key={locale}
      href={buildExternalPath(locale, pathWithoutLocale, tenantPrefix)}
      aria-current={locale === currentLocale ? "true" : undefined}
      onClick={() => setOpen(false)}
      className={pillClassName(
        locale === currentLocale,
        isCompact ? "min-h-9 w-full justify-start px-3" : "min-h-9 px-3",
      )}
    >
      {LABELS[locale]}
    </Link>
  ));

  if (isCompact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={t("languageLabel")}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-medium text-ink"
        >
          <GlobeIcon />
          {LABELS[currentLocale]}
        </button>
        {open && (
          <div className="absolute right-0 z-10 mt-2 flex w-28 flex-col gap-1 rounded-2xl border border-border bg-surface p-1 shadow-md">
            {options}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("languageLabel")}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1"
    >
      {options}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
