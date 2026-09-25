import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
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

/**
 * Igual a `getTenantBySlug`, mas pulando o passo `slugs/{slug}` — usado
 * onde já se tem o `tenantId` de verdade (ex.: `POST /api/track`, que não
 * passa pelo `proxy.ts` e por isso não recebe `x-tenant`/`slug` — só o
 * `tenantId` que a página já resolveu). Mesma tag/`cacheLife` de
 * `getTenantBySlug`, então uma mudança no tenant invalida os dois juntos.
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  "use cache";
  cacheTag(`tenant:${tenantId}`);
  cacheLife("tenant");

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

/**
 * Todas as lojas (ativas ou não) — só pro `/admin` do superadmin e pro
 * seletor de loja do painel quando é superadmin (mockup 04: "ou todas, se
 * for superadmin"). Sem `'use cache'`: é uma lista de navegação, não
 * dado crítico de segurança, e o piloto tem poucas lojas — não vale a
 * pena inventar mais uma tag de cache só pra isso.
 */
export async function listAllTenants(): Promise<Tenant[]> {
  // Chamada de `/admin/page.tsx`, que (ao contrário das páginas do painel)
  // não lê `cookies()` diretamente — sem isso, o build tenta prerenderizar
  // e falha no valor aleatório que o Admin SDK usa por baixo dos panos
  // (crypto.randomBytes). `connection()` força "isso é por request", igual
  // ao padrão de driver de banco síncrono da doc do Next.
  await connection();
  const snap = await adminDb.collection("tenants").orderBy("name", "asc").get();

  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return tenantSchema.safeParse({
        id: doc.id,
        ...data,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      });
    })
    .filter((result) => result.success)
    .map((result) => result.data);
}
