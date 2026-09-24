import { NextResponse, type NextRequest } from "next/server";
import {
  buildExternalPath,
  buildLojaRewritePath,
  detectPreferredLocale,
  resolveLocaleForPath,
  shouldSyncLocaleCookie,
} from "@/i18n/resolve-locale";
import { resolveProxyRoute } from "@/lib/tenant-host";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
// Domínio extra pra testar no celular em dev (ex.: nip.io) sem perder o
// demo.localhost — ver README, "Rodando no celular".
const EXTRA_DOMAINS = process.env.NEXT_PUBLIC_DEV_EXTRA_DOMAIN
  ? [process.env.NEXT_PUBLIC_DEV_EXTRA_DOMAIN]
  : [];
const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Multi-tenant (host) + i18n (path) num único proxy, nessa ordem:
 *
 * 1. Resolve o host em `site | painel | loja` (lib/tenant-host.ts, puro,
 *    sem I/O). Não confere se o tenant existe de verdade — isso é feito
 *    depois, na página, via `lib/tenant.ts` (Firestore).
 * 2. Recalcula o header `x-tenant` do zero a partir do host e descarta
 *    qualquer `x-tenant` que tenha vindo do cliente — nunca confiamos nele.
 * 3. Só para rotas de loja (não `/painel`, que não é localizado ainda):
 *    resolve o locale (cookie `NEXT_LOCALE` → Accept-Language → `pt`,
 *    i18n/resolve-locale.ts) e decide entre redirecionar (URL externa
 *    precisa mudar, ex.: faltando o prefixo `/en`) ou reescrever para
 *    `/loja/<slug>/<locale>/...` (o path real das páginas).
 *
 * Por que não `createMiddleware(routing)` do next-intl direto: ver o
 * comentário em `i18n/routing.ts`.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const { pathname, search } = request.nextUrl;

  const route = resolveProxyRoute(host, pathname, ROOT_DOMAIN, EXTRA_DOMAINS);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant");

  if (route.kind === "site") {
    // /loja/* só existe via rewrite (subdomínio de loja). Acesso direto pelo
    // domínio raiz não deve funcionar — rewrite pra um path que não bate com
    // nenhuma rota real, cai no 404 padrão do Next.
    if (pathname === "/loja" || pathname.startsWith("/loja/")) {
      return NextResponse.rewrite(new URL("/__not-found__", request.url), {
        request: { headers: requestHeaders },
      });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  requestHeaders.set("x-tenant", route.slug);

  if (route.kind === "painel") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const preferredLocale = detectPreferredLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  const localeResolution = resolveLocaleForPath(pathname, preferredLocale);

  if (localeResolution.needsRedirect) {
    const externalPath = buildExternalPath(
      localeResolution.locale,
      localeResolution.pathWithoutLocale,
    );
    const response = NextResponse.redirect(new URL(externalPath + search, request.url));
    if (shouldSyncLocaleCookie(request.headers.get("sec-fetch-dest"))) {
      response.cookies.set(LOCALE_COOKIE, localeResolution.locale, { path: "/", sameSite: "lax" });
    }
    return response;
  }

  const rewritePath = buildLojaRewritePath(
    route.slug,
    localeResolution.locale,
    localeResolution.pathWithoutLocale,
  );
  const response = NextResponse.rewrite(new URL(rewritePath + search, request.url), {
    request: { headers: requestHeaders },
  });

  if (
    shouldSyncLocaleCookie(request.headers.get("sec-fetch-dest")) &&
    request.cookies.get(LOCALE_COOKIE)?.value !== localeResolution.locale
  ) {
    response.cookies.set(LOCALE_COOKIE, localeResolution.locale, { path: "/", sameSite: "lax" });
  }

  return response;
}

export const config = {
  // Qualquer path com "." no último segmento é arquivo estático (SVG/PNG de
  // public/, favicon.ico, sitemap.xml, manifest.json...), nunca uma rota da
  // aplicação (essas nunca têm extensão) — exclui todos de uma vez, em vez
  // de manter uma lista fixa que quebra a cada novo asset (bug real:
  // /demo/<produto>.svg pelo subdomínio da loja virava 404 porque a lista
  // antiga só excluía favicon.ico/sitemap.xml/robots.txt).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
