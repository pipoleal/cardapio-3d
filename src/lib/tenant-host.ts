/**
 * Resolução pura de tenant a partir do host + path — sem I/O, sem Next.js,
 * sem Firestore. Usada pelo `proxy.ts` (rápida, roda em toda requisição) e
 * testada isoladamente em `tenant-host.test.ts`.
 *
 * Importante: isto NÃO confere se o slug existe de fato — só interpreta o
 * host. A existência (e `active: true`) é responsabilidade de
 * `getTenantBySlug` (lib/tenant.ts), chamada depois, na página.
 *
 * A lista de subdomínios reservados (www, app, admin, api, painel, static,
 * mail, demo*) só vale para o CADASTRO de loja nova (`POST /api/tenants`,
 * Etapa 6) — por isso essa lista não aparece aqui: o proxy tenta resolver
 * qualquer subdomínio como tenant, inclusive "demo" (a loja do seed) e
 * qualquer um dos nomes reservados (que simplesmente não vão existir no
 * Firestore e cairão em 404 na página, não no proxy).
 */

export type HostResolution = { kind: "root" } | { kind: "tenant"; slug: string };

export type ProxyRoute =
  | { kind: "site" }
  | { kind: "painel"; slug: string }
  | { kind: "loja"; slug: string };

function stripPort(host: string): string {
  const colonIndex = host.indexOf(":");
  return colonIndex === -1 ? host : host.slice(0, colonIndex);
}

/**
 * `host` e `rootDomain` podem trazer porta (dev: "demo.localhost:3000" /
 * "localhost:3000"); em produção não trazem. Comparamos sem porta — a
 * porta do host de um request sempre bate com a do env var de qualquer
 * forma (é o mesmo servidor), então ignorá-la simplifica sem perder nada.
 */
export function resolveTenantHost(rawHost: string, rootDomain: string): HostResolution {
  const host = stripPort(rawHost.trim().toLowerCase());
  const root = stripPort(rootDomain.trim().toLowerCase());

  if (!host || !root) return { kind: "root" };
  if (host === root || host === `www.${root}`) return { kind: "root" };

  const suffix = `.${root}`;
  if (host.endsWith(suffix) && host.length > suffix.length) {
    const slug = host.slice(0, -suffix.length);
    if (slug && slug !== "www") return { kind: "tenant", slug };
  }

  // Host que não bate com o domínio raiz nem com nenhum subdomínio dele
  // (ex.: acesso direto por IP, domínio da Vercel antes do custom domain
  // estar configurado). Cai para o site em vez de quebrar.
  return { kind: "root" };
}

export function resolveProxyRoute(
  rawHost: string,
  pathname: string,
  rootDomain: string,
): ProxyRoute {
  const hostResolution = resolveTenantHost(rawHost, rootDomain);
  if (hostResolution.kind === "root") return { kind: "site" };

  const isPainel = pathname === "/painel" || pathname.startsWith("/painel/");
  return isPainel
    ? { kind: "painel", slug: hostResolution.slug }
    : { kind: "loja", slug: hostResolution.slug };
}
