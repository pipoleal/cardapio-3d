import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { listAllTenants } from "@/lib/tenant";

// Sem `'use cache'`, sem shell estático — cada request de fato lista o
// banco. `instant = false` (precisa estar aqui, na página, não só no
// layout) evita a tentativa de prerender: o Admin SDK usa valor aleatório
// internamente (crypto.randomBytes), que o build recusa embutir num shell.
export const instant = false;

// Lista simples — capa completa do admin (métricas globais etc.) fica pra
// depois; por agora é só um jeito do Felipe entrar no painel de qualquer
// loja pra fazer a captura 3D como serviço (docs/ARQUITETURA.md, fluxo 4).
export default async function AdminPage() {
  const tenants = await listAllTenants();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ink">Todas as lojas</h1>
        <p className="text-muted">{tenants.length} loja(s) cadastrada(s).</p>
      </div>

      <div className="flex flex-col gap-3">
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-ink">{tenant.name}</p>
              <p className="text-sm text-muted">
                {tenant.slug} · {tenant.active ? "Ativa" : "Inativa"}
              </p>
            </div>
            <Link
              href={`/painel/${tenant.slug}`}
              className="rounded-input border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-bg"
            >
              Entrar no painel
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
