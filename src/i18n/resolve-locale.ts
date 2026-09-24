import { isAppLocale, routing, type AppLocale } from "./routing";

export type LocaleResolution = {
  locale: AppLocale;
  /** true = a URL externa precisa mudar (redirect) para refletir o locale resolvido. */
  needsRedirect: boolean;
  /** pathname sem o segmento de locale (sempre começa com "/"). */
  pathWithoutLocale: string;
};

/**
 * Reimplementa a semântica `localePrefix: "as-needed"` do next-intl (ver
 * `routing.ts` para o porquê de não usarmos `createMiddleware` direto):
 * locale padrão sem prefixo na URL, os demais com prefixo.
 *
 * `pathname` é o path que o visitante realmente digitou (sem o
 * `/loja/<slug>` — isso não existe do ponto de vista dele, é um detalhe
 * interno do rewrite). `preferredLocale` vem do cookie/Accept-Language.
 */
export function resolveLocaleForPath(
  pathname: string,
  preferredLocale: AppLocale,
): LocaleResolution {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  const restSegments = segments.slice(2);
  const pathWithoutLocale = restSegments.length > 0 ? `/${restSegments.join("/")}` : "/";

  if (isAppLocale(maybeLocale)) {
    const isRedundantDefaultPrefix = maybeLocale === routing.defaultLocale;
    return {
      locale: maybeLocale,
      pathWithoutLocale,
      needsRedirect: isRedundantDefaultPrefix,
    };
  }

  // Sem prefixo de locale na URL.
  return {
    locale: preferredLocale,
    pathWithoutLocale: pathname,
    needsRedirect: preferredLocale !== routing.defaultLocale,
  };
}

/** URL externa (a que o navegador vê) para um locale + path já resolvidos. */
export function buildExternalPath(locale: AppLocale, pathWithoutLocale: string): string {
  if (locale === routing.defaultLocale) return pathWithoutLocale;
  const suffix = pathWithoutLocale === "/" ? "" : pathWithoutLocale;
  return `/${locale}${suffix}`;
}

/** Path interno de rewrite para a loja — sempre carrega o locale explícito. */
export function buildLojaRewritePath(
  slug: string,
  locale: AppLocale,
  pathWithoutLocale: string,
): string {
  const suffix = pathWithoutLocale === "/" ? "" : pathWithoutLocale;
  return `/loja/${slug}/${locale}${suffix}`;
}

/** cookie (NEXT_LOCALE) → Accept-Language → padrão. */
export function detectPreferredLocale(
  cookieLocale: string | undefined | null,
  acceptLanguageHeader: string | undefined | null,
): AppLocale {
  if (isAppLocale(cookieLocale)) return cookieLocale;

  if (acceptLanguageHeader) {
    const candidates = acceptLanguageHeader
      .split(",")
      .map((part) => part.split(";")[0]?.trim().slice(0, 2).toLowerCase());
    for (const candidate of candidates) {
      if (isAppLocale(candidate)) return candidate;
    }
  }

  return routing.defaultLocale;
}
