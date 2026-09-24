import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/admin";
import { getTenantBySlug, listAllTenants } from "@/lib/tenant";
import type { Tenant } from "@/lib/schemas/tenant";
import { getUserDoc } from "@/lib/user";

export const SESSION_COOKIE = "c3d_session";
// Teto do createSessionCookie do Admin SDK é 2 semanas; 5 dias equilibra
// não pedir login toda hora com não manter uma sessão administrativa válida
// por tempo demais.
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  uid: string;
  email: string | undefined;
  isSuperadmin: boolean;
};

/** `null` = deslogado (sem cookie, ou cookie expirado/inválido/revogado). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      isSuperadmin: decoded.role === "superadmin",
    };
  } catch {
    return null;
  }
}

/**
 * `users/{uid}.tenantIds` guarda o `tenantId` de cada loja — que neste app
 * é sempre igual ao `slug` (mesma convenção do seed: `TENANT_ID = "demo"`
 * serve tanto de doc id quanto de slug), por isso dá pra passar direto pra
 * `getTenantBySlug`.
 */
export async function getOwnedTenants(uid: string): Promise<Tenant[]> {
  const userDoc = await getUserDoc(uid);
  const tenantIds = userDoc?.tenantIds ?? [];
  const tenants = await Promise.all(tenantIds.map((id) => getTenantBySlug(id)));
  return tenants.filter((tenant): tenant is Tenant => tenant !== null);
}

export type TenantAccess = {
  user: SessionUser;
  tenant: Tenant;
  /** Lojas pro seletor da sidebar: as do usuário, ou todas se for superadmin. */
  switcherTenants: Tenant[];
};

/**
 * Chamado no topo de `painel/[tenantSlug]/layout.tsx` — não é o root layout
 * (`(main)/layout.tsx` controla o `<html>`), então `redirect()`/`notFound()`
 * aqui não esbarra no bug de PPR do docs/DECISOES.md #15 (confirmado com
 * build + Playwright, não só por analogia).
 */
export async function requireTenantOwner(tenantSlug: string): Promise<TenantAccess> {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/painel/${tenantSlug}`)}`);

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  if (user.isSuperadmin) {
    return { user, tenant, switcherTenants: await listAllTenants() };
  }

  const ownedTenants = await getOwnedTenants(user.uid);
  const isOwner = ownedTenants.some((owned) => owned.id === tenant.id);
  // Autenticado mas não é dono desta loja: manda pro índice do painel, que
  // resolve pra uma loja que ele TEM acesso (ou mostra o estado vazio) —
  // melhor do que devolver pro /entrar (ele já está logado) ou um 404
  // genérico (a loja existe, ele só não pode vê-la).
  if (!isOwner) redirect("/painel");

  return { user, tenant, switcherTenants: ownedTenants };
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/admin");
  if (!user.isSuperadmin) redirect("/painel");
  return user;
}
