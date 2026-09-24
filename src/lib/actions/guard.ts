import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { getTenantBySlug } from "@/lib/tenant";
import type { Tenant } from "@/lib/schemas/tenant";

export class ActionError extends Error {}

/**
 * Mesma checagem de `requireTenantOwner` (lib/auth/session.ts), mas lança
 * em vez de redirecionar: uma Server Action pode ser chamada direto (POST),
 * sem ter passado pela página/layout que já filtra isso — essa é a segunda
 * camada, não a primeira.
 */
export async function assertTenantOwner(tenantId: string): Promise<{ uid: string; tenant: Tenant }> {
  const user = await getSessionUser();
  if (!user) throw new ActionError("Não autenticado.");

  const tenant = await getTenantBySlug(tenantId);
  if (!tenant) throw new ActionError("Loja não encontrada.");

  if (!user.isSuperadmin && !tenant.ownerUids.includes(user.uid)) {
    throw new ActionError("Sem permissão nesta loja.");
  }

  return { uid: user.uid, tenant };
}
