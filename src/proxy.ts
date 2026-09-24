import { NextResponse, type NextRequest } from "next/server";
import {
  buildExternalPath,
  buildLojaRewritePath,
  detectPreferredLocale,
  resolveLocaleForPath,
} from "@/i18n/resolve-locale";
import { isDocumentNavigation } from "@/lib/http";
import { isValidOrigin, ORIGIN_COOKIE, resolveOrigin } from "@/lib/origin";
import { resolveProxyRoute } from "@/lib/tenant-host";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
// Domínio extra pra testar no celular em dev (ex.: nip.io) sem perder o
// demo.localhost — ver README, "Rodando no celular".
const EXTRA_DOMAINS = process.env.NEXT_PUBLIC_DEV_EXTRA_DOMAIN
  ? [process.env.NEXT_PUBLIC_DEV_EXTRA_DOMAIN]
  : [];
const LOCALE_COOKIE = "NEXT_LOCALE";
const ORIGIN_QUERY_PARAM = "origem";

/**
 * Um `NextResponse.redirect()` normal, emitido aqui no middleware, pra um
 * host DIFERENTE (subdomínio → domínio raiz) vira loop infinito no
 * servidor de dev/self-hosted do Next: `resolve-routes.js` "relativiza"
 * o `Location` comparando contra um `initUrl` construído com o hostname
 * de BIND do servidor (ex.: "localhost"), não o `Host:` de verdade da
 * requisição — então `http://localhost:3000/painel/demo` bate como
 * "mesma origem" mesmo vindo de `demo.localhost:3000`, e o `Location`vira
 * `/painel/demo` (relativo), que o navegador resolve de volta contra
 * `demo.localhost:3000` → cai no mesmo redirect de novo, pra sempre.
 * Devolver a navegação como HTML/JS (status 200, nunca é tratado como
 * redirect por esse pós-processamento) contorna isso de vez, em
 * qualquer ambiente.
 */
function redirectViaHtml(target: string): NextResponse {
  const safeTarget = JSON.stringify(target);
  return new NextResponse(
    `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${target}"></head><body><script>location.replace(${safeTarget})</script></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * Multi-tenant (host) + i18n (path) + origem da visita (query → cookie)
 * num único proxy, nessa ordem:
 *
 * 1. Resolve o host em `site | painel | loja` (lib/tenant-host.ts, puro,
 *    sem I/O). Não confere se o tenant existe de verdade — isso é feito
 *    depois, na página, via `lib/tenant.ts` (Firestore).
 * 2. Recalcula o header `x-tenant` do zero a partir do host e descarta
 *    qualquer `x-tenant` que tenha vindo do cliente — nunca confiamos nele.
 * 3. `/painel` no subdomínio da loja **redireciona** pro painel no domínio
 *    raiz (`ROOT_DOMAIN/painel/<slug>`) — o painel só existe lá (Firebase
 *    Authentication não aceita domínio curinga nos "domínios autorizados";
 *    ver docs/DECISOES.md #16).
 * 4. Só para rotas de loja (não `/painel`, que não é localizada nem tem
 *    origem):
 *    a. Resolve `?origem=` → cookie `c3d_origin` → User-Agent (Instagram)
 *       → "direto" (lib/origin.ts) e recalcula o header `x-origin`, do
 *       zero, do mesmo jeito que `x-tenant` — nunca confia num `x-origin`
 *       vindo do cliente.
 *    b. Resolve o locale (cookie `NEXT_LOCALE` → Accept-Language → `pt`,
 *       i18n/resolve-locale.ts).
 *    c. Se a URL externa precisa mudar (`?origem=` presente — tem que
 *       sumir da URL pra não propagar ao compartilhar — ou faltando/sobrando
 *       o prefixo de locale), redireciona UMA vez só resolvendo os dois
 *       casos juntos; senão reescreve pra `/loja/<slug>/<locale>/...`.
 *
 * Por que não `createMiddleware(routing)` do next-intl direto: ver o
 * comentário em `i18n/routing.ts`.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const { pathname, search, searchParams } = request.nextUrl;

  const route = resolveProxyRoute(host, pathname, ROOT_DOMAIN, EXTRA_DOMAINS);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant");
  requestHeaders.delete("x-origin");

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
    const rootOrigin = `${ROOT_DOMAIN.includes(":") ? "http" : "https"}://${ROOT_DOMAIN}`;
    const restPath = pathname.replace(/^\/painel/, "");
    const target = `${rootOrigin}/painel/${route.slug}${restPath}${search}`;
    return redirectViaHtml(target);
  }

  const isDocNav = isDocumentNavigation(request.headers.get("sec-fetch-dest"));

  // --- origem ---
  const rawOriginParam = searchParams.get(ORIGIN_QUERY_PARAM);
  const origin = resolveOrigin({
    queryParam: rawOriginParam,
    cookieValue: request.cookies.get(ORIGIN_COOKIE)?.value,
    userAgent: request.headers.get("user-agent"),
  });
  requestHeaders.set("x-origin", origin);
  // Só ?origem= explícito vira cookie (ver lib/origin.ts) — e só numa
  // navegação de documento de verdade, mesma razão do cookie de locale.
  const originNeedsCleanup = isDocNav && rawOriginParam !== null;

  // --- locale ---
  const preferredLocale = detectPreferredLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  const localeResolution = resolveLocaleForPath(pathname, preferredLocale);

  if (localeResolution.needsRedirect || originNeedsCleanup) {
    const externalPath = buildExternalPath(
      localeResolution.locale,
      localeResolution.pathWithoutLocale,
    );
    const cleanSearch = new URLSearchParams(search);
    cleanSearch.delete(ORIGIN_QUERY_PARAM);
    const query = cleanSearch.toString();
    const response = NextResponse.redirect(
      new URL(externalPath + (query ? `?${query}` : ""), request.url),
    );
    if (isDocNav) {
      response.cookies.set(LOCALE_COOKIE, localeResolution.locale, { path: "/", sameSite: "lax" });
      if (isValidOrigin(rawOriginParam)) {
        response.cookies.set(ORIGIN_COOKIE, rawOriginParam, { path: "/", sameSite: "lax" });
      }
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
    isDocNav &&
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
