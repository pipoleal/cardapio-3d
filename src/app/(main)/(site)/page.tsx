import { buildTenantOrigin } from "@/lib/tenant-host";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Cardápio 3D";
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const pathTenantMode = process.env.NEXT_PUBLIC_PATH_TENANT_MODE === "true";

// Landing mínima do domínio raiz — a versão completa (proposta, vídeo do AR,
// preços) é da Etapa 6. Por ora só existe pra dar um destino real pro "/"
// e linkar a loja demo.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        Cardápio virtual em 3D
      </p>
      <h1 className="font-heading text-3xl font-semibold text-ink">{appName}</h1>
      <p className="max-w-md text-muted">
        O cliente vê o produto em 3D e realidade aumentada antes de encomendar. A vitrine
        completa deste site chega numa etapa futura — por enquanto, veja a loja de exemplo:
      </p>
      <a
        href={buildTenantOrigin("demo", rootDomain, pathTenantMode)}
        className="inline-flex min-h-11 items-center justify-center rounded-cta bg-accent px-5 text-sm font-medium text-surface hover:opacity-90"
      >
        Ver loja demo
      </a>
    </main>
  );
}
