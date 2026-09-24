import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { adminDb } from "./firebase/admin";
import { toDate } from "./firestore-dates";
import { tenantSchema, type Tenant } from "./schemas/tenant";

/**
 * `slugs/{slug}` guarda só o `tenantId` (reserva de unicidade); os dados
 * reais ficam em `tenants/{tenantId}` — ver docs/MODELO-DE-DADOS.md.
 * Devolve `null` se o slug não existir, o tenant não existir mais, ou
 * `active` for `false` (loja desativada não é servida).
 *
 * `'use cache'` com a tag `tenant:<id>` — a mesma tag que `lib/menu.ts`
 * usa, então a Etapa 3 invalida perfil + cardápio juntos com um
 * `revalidateTag` só quando o lojista salva (docs/ARQUITETURA.md).
 * A tag só pode ser aplicada depois de sabermos o `tenantId` (não temos
 * antes de ler `slugs/{slug}`) — por isso fica no meio da função, não no
 * topo (padrão "Creating tags from external data" da doc do cacheTag).
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  "use cache";
  cacheLife("tenant");

  const slugDoc = await adminDb.collection("slugs").doc(slug).get();
  if (!slugDoc.exists) return null;

  const { tenantId } = slugDoc.data() as { tenantId: string };
  cacheTag(`tenant:${tenantId}`);

  const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
  if (!tenantDoc.exists) return null;

  const data = tenantDoc.data()!;
  const parsed = tenantSchema.safeParse({
    id: tenantDoc.id,
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  });
  if (!parsed.success || !parsed.data.active) return null;

  return parsed.data;
}
