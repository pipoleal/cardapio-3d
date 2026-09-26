import { describe, expect, it } from "vitest";
import { buildTenantOrigin, resolveProxyRoute, resolveTenantHost } from "./tenant-host";

const ROOT_DEV = "localhost:3000";
const ROOT_PROD = "cardapio3d.com.br";

describe("resolveTenantHost", () => {
  it("raiz, com porta (dev)", () => {
    expect(resolveTenantHost("localhost:3000", ROOT_DEV)).toEqual({ kind: "root" });
  });

  it("raiz, sem porta (produção)", () => {
    expect(resolveTenantHost("cardapio3d.com.br", ROOT_PROD)).toEqual({ kind: "root" });
  });

  it("www, com e sem porta", () => {
    expect(resolveTenantHost("www.localhost:3000", ROOT_DEV)).toEqual({ kind: "root" });
    expect(resolveTenantHost("www.cardapio3d.com.br", ROOT_PROD)).toEqual({ kind: "root" });
  });

  it("loja demo, com porta (dev)", () => {
    expect(resolveTenantHost("demo.localhost:3000", ROOT_DEV)).toEqual({
      kind: "tenant",
      slug: "demo",
    });
  });

  it("loja demo, sem porta (produção)", () => {
    expect(resolveTenantHost("demo.cardapio3d.com.br", ROOT_PROD)).toEqual({
      kind: "tenant",
      slug: "demo",
    });
  });

  it("slug normal", () => {
    expect(resolveTenantHost("boaconfe.localhost:3000", ROOT_DEV)).toEqual({
      kind: "tenant",
      slug: "boaconfe",
    });
  });

  it("slug 'reservado' resolve normalmente como tenant (a reserva só vale no cadastro, POST /api/tenants)", () => {
    expect(resolveTenantHost("admin.localhost:3000", ROOT_DEV)).toEqual({
      kind: "tenant",
      slug: "admin",
    });
    expect(resolveTenantHost("painel.localhost:3000", ROOT_DEV)).toEqual({
      kind: "tenant",
      slug: "painel",
    });
  });

  it("host que não bate com o root domain cai para 'root' em vez de quebrar", () => {
    expect(resolveTenantHost("192.168.0.1:3000", ROOT_DEV)).toEqual({ kind: "root" });
    expect(resolveTenantHost("outro-dominio.com", ROOT_PROD)).toEqual({ kind: "root" });
  });

  it("é case-insensitive", () => {
    expect(resolveTenantHost("Demo.LocalHost:3000", ROOT_DEV)).toEqual({
      kind: "tenant",
      slug: "demo",
    });
  });

  it("domínio extra (nip.io) funciona junto com o principal, pro teste no celular", () => {
    const NIP_IO = "192.168.1.9.nip.io:3000";
    expect(resolveTenantHost(NIP_IO, ROOT_DEV, [NIP_IO])).toEqual({ kind: "root" });
    expect(resolveTenantHost(`demo.${NIP_IO}`, ROOT_DEV, [NIP_IO])).toEqual({
      kind: "tenant",
      slug: "demo",
    });
    // o domínio principal continua funcionando mesmo com o extra configurado
    expect(resolveTenantHost("demo.localhost:3000", ROOT_DEV, [NIP_IO])).toEqual({
      kind: "tenant",
      slug: "demo",
    });
    // e um host que não bate com nenhum dos dois ainda cai pra root
    expect(resolveTenantHost("demo.outro.nip.io:3000", ROOT_DEV, [NIP_IO])).toEqual({
      kind: "root",
    });
  });
});

describe("resolveProxyRoute", () => {
  it("raiz -> site", () => {
    expect(resolveProxyRoute(ROOT_DEV, "/", ROOT_DEV)).toEqual({ kind: "site" });
  });

  it("subdomínio de loja, path normal -> loja", () => {
    expect(resolveProxyRoute("demo.localhost:3000", "/", ROOT_DEV)).toEqual({
      kind: "loja",
      slug: "demo",
      pathname: "/",
      tenantPrefix: "",
    });
    expect(resolveProxyRoute("demo.localhost:3000", "/en/bolo", ROOT_DEV)).toEqual({
      kind: "loja",
      slug: "demo",
      pathname: "/en/bolo",
      tenantPrefix: "",
    });
  });

  it("BUG REAL evitado: subdomínio de loja com pathTenantMode ligado NÃO ganha o prefixo /l/<slug> (achado testando check-origin com a flag ligada — redirects de origem/locale estavam vazando o prefixo pra requisições por subdomínio)", () => {
    expect(resolveProxyRoute("demo.localhost:3000", "/", ROOT_DEV, [], true)).toEqual({
      kind: "loja",
      slug: "demo",
      pathname: "/",
      tenantPrefix: "",
    });
  });

  it("/painel e /painel/... -> painel, preservando o slug", () => {
    expect(resolveProxyRoute("demo.localhost:3000", "/painel", ROOT_DEV)).toEqual({
      kind: "painel",
      slug: "demo",
    });
    expect(resolveProxyRoute("demo.localhost:3000", "/painel/produtos", ROOT_DEV)).toEqual({
      kind: "painel",
      slug: "demo",
    });
  });

  it("path que só começa parecido com /painel não conta como painel", () => {
    expect(resolveProxyRoute("demo.localhost:3000", "/painel-antigo", ROOT_DEV)).toEqual({
      kind: "loja",
      slug: "demo",
      pathname: "/painel-antigo",
      tenantPrefix: "",
    });
  });

  it("modo por caminho desligado (padrão): /l/<slug> no domínio raiz cai pra site, não pra loja", () => {
    expect(resolveProxyRoute(ROOT_DEV, "/l/boaconfe", ROOT_DEV)).toEqual({ kind: "site" });
  });

  it("modo por caminho ligado: /l/<slug> no domínio raiz -> loja, com o prefixo já tirado do pathname e disponível em tenantPrefix", () => {
    expect(resolveProxyRoute(ROOT_DEV, "/l/boaconfe", ROOT_DEV, [], true)).toEqual({
      kind: "loja",
      slug: "boaconfe",
      pathname: "/",
      tenantPrefix: "/l/boaconfe",
    });
    expect(resolveProxyRoute(ROOT_DEV, "/l/boaconfe/en/bolo", ROOT_DEV, [], true)).toEqual({
      kind: "loja",
      slug: "boaconfe",
      pathname: "/en/bolo",
      tenantPrefix: "/l/boaconfe",
    });
  });

  it("modo por caminho ligado: /l sozinho (sem slug) cai pra site", () => {
    expect(resolveProxyRoute(ROOT_DEV, "/l", ROOT_DEV, [], true)).toEqual({ kind: "site" });
    expect(resolveProxyRoute(ROOT_DEV, "/l/", ROOT_DEV, [], true)).toEqual({ kind: "site" });
  });

  it("modo por caminho ligado: /loja/* direto no domínio raiz continua site (bloqueio existente não muda)", () => {
    expect(resolveProxyRoute(ROOT_DEV, "/loja/demo/pt", ROOT_DEV, [], true)).toEqual({
      kind: "site",
    });
  });
});

describe("buildTenantOrigin", () => {
  it("modo subdomínio (padrão)", () => {
    expect(buildTenantOrigin("demo", ROOT_PROD)).toBe("https://demo.cardapio3d.com.br");
    expect(buildTenantOrigin("demo", ROOT_DEV)).toBe("http://demo.localhost:3000");
  });

  it("modo por caminho: <rootDomain>/l/<slug>, sem subdomínio", () => {
    expect(buildTenantOrigin("boaconfe", "cardapio-3d.vercel.app", true)).toBe(
      "https://cardapio-3d.vercel.app/l/boaconfe",
    );
  });
});
