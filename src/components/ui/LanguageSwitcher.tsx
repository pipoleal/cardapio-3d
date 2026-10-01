"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { buildExternalPath } from "@/i18n/resolve-locale";
import { routing, type AppLocale } from "@/i18n/routing";
import { pillClassName } from "./Pill";

const LABELS: Record<AppLocale, string> = { pt: "PT", en: "EN", es: "ES" };

type LanguageSwitcherProps = {
  currentLocale: AppLocale;
  /** `/l/<slug>` no modo por caminho da staging, `""` no modo subdomínio — ver `tenantPathPrefix`. */
  tenantPrefix: string;
  /**
   * Path relativo ao tenant+locale atual, sem o prefixo de locale nem o de
   * tenant (ex.: `"/"` na home da loja, `"/p/<id>"` na página do produto) —
   * sempre calculado pelo Server Component que já sabe exatamente qual
   * página está servindo, nunca por `usePathname()` aqui dentro. Bug real,
   * reproduzido só em build de produção (`next build && next start`, nunca
   * em `next dev`): sob Partial Prerendering, este componente faz parte do
   * shell ESTÁTICO da página — `usePathname()` resolvia pro path INTERNO
   * do rewrite (`/loja/<slug>/<locale>`, o que o proxy.ts usa por baixo dos
   * panos), não pro path externo que o navegador realmente mostra, gerando
   * link duplicado tipo `/l/boaconfe/en/loja/boaconfe/pt`. Ver docs/DECISOES.md.
   */
  pathWithoutLocale: string;
  /** "pills": grupo PT/EN/ES lado a lado (mockup 01). "compact": globo + locale atual, abre as opções (mockup 02). */
  variant?: "pills" | "compact";
};

export function LanguageSwitcher({
  currentLocale,
  tenantPrefix,
  pathWithoutLocale,
  variant = "pills",
}: LanguageSwitcherProps) {
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
