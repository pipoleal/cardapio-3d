import { describe, expect, it } from "vitest";
import { resolveProxyRoute, resolveTenantHost } from "./tenant-host";

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
});

describe("resolveProxyRoute", () => {
  it("raiz -> site", () => {
    expect(resolveProxyRoute(ROOT_DEV, "/", ROOT_DEV)).toEqual({ kind: "site" });
  });

  it("subdomínio de loja, path normal -> loja", () => {
    expect(resolveProxyRoute("demo.localhost:3000", "/", ROOT_DEV)).toEqual({
      kind: "loja",
      slug: "demo",
    });
    expect(resolveProxyRoute("demo.localhost:3000", "/en/bolo", ROOT_DEV)).toEqual({
      kind: "loja",
      slug: "demo",
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
    });
  });
});
