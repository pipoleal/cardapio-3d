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
  tenantPrefix = "",
): LocaleResolution {
  const strippedPathname =
    tenantPrefix && pathname.startsWith(tenantPrefix)
      ? pathname.slice(tenantPrefix.length) || "/"
      : pathname;
  const segments = strippedPathname.split("/");
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
    pathWithoutLocale: strippedPathname,
    needsRedirect: preferredLocale !== routing.defaultLocale,
  };
}

/**
 * URL externa (a que o navegador vê) para um locale + path já resolvidos.
 * `tenantPrefix` (`/l/<slug>` no modo por caminho da staging, `""` no modo
 * subdomínio — ver `tenantPathPrefix`) entra ANTES do locale, sempre.
 */
export function buildExternalPath(
  locale: AppLocale,
  pathWithoutLocale: string,
  tenantPrefix = "",
): string {
  const suffix = pathWithoutLocale === "/" ? "" : pathWithoutLocale;
  if (locale === routing.defaultLocale) return tenantPrefix + suffix || "/";
  return `${tenantPrefix}/${locale}${suffix}`;
}

/**
 * `/l/<slug>` quando `pathTenantMode` (staging sem DNS curinga, ver
 * `docs/DECISOES.md`), `""` no modo subdomínio normal — usado em toda URL
 * (interna ou absoluta) que precisa continuar apontando pra loja certa.
 */
export function tenantPathPrefix(pathTenantMode: boolean, tenantSlug: string): string {
  return pathTenantMode ? `/l/${tenantSlug}` : "";
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
