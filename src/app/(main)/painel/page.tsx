import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOwnedTenants, getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

// Sem `[tenantSlug]`: resolve pra loja do usuário (a primeira que ele tem
// acesso) e redireciona — é o destino padrão depois do login e o "não tem
// permissão nesta loja" de `requireTenantOwner`.
export default async function PainelIndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/painel");

  const ownedTenants = await getOwnedTenants(user.uid);
  if (ownedTenants[0]) redirect(`/painel/${ownedTenants[0].slug}`);
  if (user.isSuperadmin) redirect("/admin");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ink">Nenhuma loja por aqui ainda</h1>
      <p className="text-muted">Peça pro Felipe te adicionar como dono de uma loja.</p>
    </main>
  );
}
