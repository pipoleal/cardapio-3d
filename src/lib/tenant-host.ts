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
  // `pathname`: path efetivo da loja, já sem prefixo de tenant — igual ao
  // `pathname` original no modo subdomínio; sem o `/l/<slug>` no modo por
  // caminho (`pathTenantMode`, staging sem DNS curinga).
  // `tenantPrefix`: decidido AQUI, por requisição — nunca só pela flag
  // global `pathTenantMode` (bug real encontrado testando: com a flag
  // ligada, uma requisição por SUBDOMÍNIO também acabava ganhando o prefixo
  // `/l/<slug>` nos redirects, porque a decisão dependia só da flag, não de
  // como a requisição chegou de verdade). `""` no modo subdomínio, sempre —
  // só a rota casada pelo padrão `/l/<slug>` carrega o prefixo.
  | { kind: "loja"; slug: string; pathname: string; tenantPrefix: string };

// Match de "/l/<slug>" ou "/l/<slug>/resto/do/path" — usado só quando
// `pathTenantMode` está ligado (ver `resolveProxyRoute`).
const PATH_TENANT_PATTERN = /^\/l\/([^/]+)(\/.*)?$/;

function stripPort(host: string): string {
  const colonIndex = host.indexOf(":");
  return colonIndex === -1 ? host : host.slice(0, colonIndex);
}

/**
 * `host` e os domínios podem trazer porta (dev: "demo.localhost:3000" /
 * "localhost:3000"); em produção não trazem. Comparamos sem porta — a
 * porta do host de um request sempre bate com a do env var de qualquer
 * forma (é o mesmo servidor), então ignorá-la simplifica sem perder nada.
 *
 * `extraDomains` existe pro teste no celular em dev (ver README, "Rodando
 * no celular"): `NEXT_PUBLIC_DEV_EXTRA_DOMAIN` deixa um domínio nip.io
 * funcionando ao mesmo tempo que `demo.localhost`, sem precisar trocar o
 * `NEXT_PUBLIC_ROOT_DOMAIN` principal.
 */
export function resolveTenantHost(
  rawHost: string,
  rootDomain: string,
  extraDomains: readonly string[] = [],
): HostResolution {
  const host = stripPort(rawHost.trim().toLowerCase());
  if (!host) return { kind: "root" };

  const roots = [rootDomain, ...extraDomains]
    .map((domain) => stripPort(domain.trim().toLowerCase()))
    .filter(Boolean);

  for (const root of roots) {
    if (host === root || host === `www.${root}`) return { kind: "root" };

    const suffix = `.${root}`;
    if (host.endsWith(suffix) && host.length > suffix.length) {
      const slug = host.slice(0, -suffix.length);
      if (slug && slug !== "www") return { kind: "tenant", slug };
    }
  }

  // Host que não bate com nenhum dos domínios conhecidos (ex.: acesso
  // direto por IP, domínio da Vercel antes do custom domain estar
  // configurado). Cai para o site em vez de quebrar.
  return { kind: "root" };
}

/**
 * Origin público de uma loja (ex.: "https://demo.cardapio3d.com.br" ou
 * "http://demo.localhost:3000" em dev). Porta no `rootDomain` = sinal de
 * dev/local (http); sem porta = produção (https). Usado pra montar links
 * absolutos (landing → loja demo, mensagem do WhatsApp → link do produto).
 *
 * `pathTenantMode`: staging sem DNS curinga (ver `docs/DECISOES.md`) — usa
 * `<rootDomain>/l/<slug>` em vez de `<slug>.<rootDomain>`. Produção de
 * verdade (subdomínio) nunca passa `true` aqui.
 */
export function buildTenantOrigin(
  tenantSlug: string,
  rootDomain: string,
  pathTenantMode = false,
): string {
  const protocol = rootDomain.includes(":") ? "http" : "https";
  if (pathTenantMode) return `${protocol}://${rootDomain}/l/${tenantSlug}`;
  return `${protocol}://${tenantSlug}.${rootDomain}`;
}

export function resolveProxyRoute(
  rawHost: string,
  pathname: string,
  rootDomain: string,
  extraDomains: readonly string[] = [],
  pathTenantMode = false,
): ProxyRoute {
  const hostResolution = resolveTenantHost(rawHost, rootDomain, extraDomains);
  if (hostResolution.kind === "tenant") {
    const isPainel = pathname === "/painel" || pathname.startsWith("/painel/");
    return isPainel
      ? { kind: "painel", slug: hostResolution.slug }
      : { kind: "loja", slug: hostResolution.slug, pathname, tenantPrefix: "" };
  }

  if (pathTenantMode) {
    const match = pathname.match(PATH_TENANT_PATTERN);
    if (match) {
      const [, slug, rest] = match;
      return { kind: "loja", slug: slug!, pathname: rest || "/", tenantPrefix: `/l/${slug}` };
    }
  }

  return { kind: "site" };
}
