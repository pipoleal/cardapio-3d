import { defineRouting } from "next-intl/routing";

/**
 * Config canônica de i18n (usada pelo `i18n/request.ts` para carregar as
 * mensagens e pelo `proxy.ts`/`resolve-locale.ts` para saber quais locales
 * existem e qual é o padrão — uma única fonte de verdade).
 *
 * `localePrefix: "as-needed"`: o locale padrão (pt) não aparece na URL
 * (`demo.<DOMINIO>/`), os outros aparecem (`demo.<DOMINIO>/en`).
 *
 * Não usamos `createMiddleware(routing)` do next-intl diretamente no
 * `proxy.ts`: essa função assume que o prefixo de locale fica logo no
 * início do pathname, mas o nosso pathname real também carrega o tenant
 * (`/loja/<slug>/<locale>/...`), aninhado sob um host dinâmico. Por isso o
 * `proxy.ts` reimplementa a lógica "as-needed" (ver `resolve-locale.ts`),
 * reaproveitando esta config como fonte de verdade dos locales.
 */
export const routing = defineRouting({
  locales: ["pt", "en", "es"],
  defaultLocale: "pt",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}
