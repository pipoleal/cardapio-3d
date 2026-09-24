"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildExternalPath, resolveLocaleForPath } from "@/i18n/resolve-locale";
import { routing, type AppLocale } from "@/i18n/routing";
import { pillClassName } from "./Pill";

const LABELS: Record<AppLocale, string> = { pt: "PT", en: "EN", es: "ES" };

// Seletor PT / EN / ES em pílula (mockup 01/02). Troca só o locale, mantém
// tenant (host) e o resto do path — usa a mesma resolução do proxy.ts para
// não duplicar a regra de onde o prefixo de locale aparece na URL.
export function LanguageSwitcher({ currentLocale }: { currentLocale: AppLocale }) {
  const pathname = usePathname();
  const { pathWithoutLocale } = resolveLocaleForPath(pathname, currentLocale);

  return (
    <div
      role="group"
      aria-label="Idioma"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1"
    >
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={buildExternalPath(locale, pathWithoutLocale)}
          aria-current={locale === currentLocale ? "true" : undefined}
          className={pillClassName(locale === currentLocale, "min-h-9 px-3")}
        >
          {LABELS[locale]}
        </Link>
      ))}
    </div>
  );
}
