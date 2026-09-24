import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

function hostnameOnly(domain: string): string {
  return domain.split(":")[0]!;
}

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const extraDomain = process.env.NEXT_PUBLIC_DEV_EXTRA_DOMAIN;

// Next.js já libera localhost e subdomínios dele para o dev server; só
// precisamos declarar hosts adicionais (ex.: um domínio nip.io pra testar
// no celular — ver README, "Rodando no celular").
const devOrigins = [rootDomain, extraDomain]
  .filter((domain): domain is string => Boolean(domain))
  .map(hostnameOnly)
  .filter((host) => host !== "localhost" && !host.endsWith(".localhost"))
  .flatMap((host) => [host, `*.${host}`]);

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    // Dados públicos por loja (perfil + cardápio): revalidate curto,
    // invalidado on-demand por `revalidateTag(\`tenant:<id>\`, ...)` quando
    // o lojista salva (Etapa 3). Ver docs/ARQUITETURA.md, "Performance".
    tenant: { stale: 60, revalidate: 60, expire: 3600 },
  },
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  images: {
    // Capa de produto/logo (upload no painel, Etapa 3) vem do Storage —
    // sem isso, o next/image recusa o host e QUEBRA a página inteira do
    // cardápio pro cliente final (achado testando o upload de capa).
    // Sem `search`: o token de download (`?alt=media&token=...`) muda a
    // cada arquivo, não dá pra fixar.
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_USE_EMULATORS === "true"
        ? [{ protocol: "http" as const, hostname: "127.0.0.1", port: "9199", pathname: "/v0/b/**" }]
        : []),
      { protocol: "https" as const, hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
    ],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
