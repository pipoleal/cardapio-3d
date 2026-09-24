import "server-only";
import { cache } from "react";
import { adminDb } from "./firebase/admin";
import { tenantSchema, type Tenant } from "./schemas/tenant";

/**
 * `slugs/{slug}` guarda só o `tenantId` (reserva de unicidade); os dados
 * reais ficam em `tenants/{tenantId}` — ver docs/MODELO-DE-DADOS.md.
 * Devolve `null` se o slug não existir, o tenant não existir mais, ou
 * `active` for `false` (loja desativada não é servida).
 */
export const getTenantBySlug = cache(async (slug: string): Promise<Tenant | null> => {
  const slugDoc = await adminDb.collection("slugs").doc(slug).get();
  if (!slugDoc.exists) return null;

  const { tenantId } = slugDoc.data() as { tenantId: string };
  const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
  if (!tenantDoc.exists) return null;

  const parsed = tenantSchema.safeParse({ id: tenantDoc.id, ...tenantDoc.data() });
  if (!parsed.success || !parsed.data.active) return null;

  return parsed.data;
});
