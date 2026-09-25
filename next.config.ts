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
    // Capa de produto/logo/modelo vem do storage (Firebase em dev, Vercel
    // Blob em produção/staging — `lib/storage/`) — sem isso, o next/image
    // recusa o host e QUEBRA a página inteira do cardápio pro cliente
    // final (achado testando o upload de capa, decisão nº 18). Os 3 hosts
    // ficam sempre presentes, sem depender de env var — `STORAGE_PROVIDER`
    // pode mudar em runtime (é lido em Server Actions/Route Handlers, não
    // só no build), então o build precisa liberar os dois de qualquer
    // jeito, ajuste explícito da Etapa "Vercel Blob". Sem `search` nos
    // dois primeiros: o token de download (`?alt=media&token=...`) muda a
    // cada arquivo, não dá pra fixar. Em dev com Firebase, as URLs já vêm
    // reescritas pra `/__storage/...` (mesma origem — ver rewrites() e
    // lib/storage-url.ts), então o remotePattern de 127.0.0.1 é só um
    // reforço pra qualquer URL que escape desse helper.
    remotePatterns: [
      { protocol: "http" as const, hostname: "127.0.0.1", port: "9199", pathname: "/v0/b/**" },
      { protocol: "https" as const, hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
      { protocol: "https" as const, hostname: "*.public.blob.vercel-storage.com" },
    ],
    // Next 16: caminho local com query string exige `localPatterns` (senão
    // o next/image responde 400 e DERRUBA a página inteira do cardápio,
    // mesmo risco da decisão nº 18) — cobre as URLs de Storage já
    // reescritas pra `/__storage/...` (mesma origem, ver rewrites() acima).
    // Sem `search` pelo mesmo motivo do remotePattern: o token muda por arquivo.
    ...(process.env.NEXT_PUBLIC_USE_EMULATORS === "true"
      ? { localPatterns: [{ pathname: "/__storage/**" }] }
      : {}),
  },
  async rewrites() {
    // Só em dev com emuladores: serve os arquivos do Storage emulator pela
    // MESMA origem do Next, pra não ter mixed content no HTTPS do celular
    // nem URL com "127.0.0.1"/IP que só o computador de dev alcança — ver
    // lib/storage-url.ts e docs/DECISOES.md.
    if (process.env.NEXT_PUBLIC_USE_EMULATORS !== "true") return [];
    return [{ source: "/__storage/:path*", destination: "http://127.0.0.1:9199/:path*" }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
