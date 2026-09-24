import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "./firebase/admin";
import { toDate } from "./firestore-dates";
import { categorySchema, type Category } from "./schemas/category";
import { productSchema, type Product } from "./schemas/product";

export type Menu = {
  categories: Category[];
  products: Product[];
};

function mapProductDoc(doc: QueryDocumentSnapshot): unknown {
  const data = doc.data();
  const model = data.model as Record<string, unknown> | undefined;
  const sliceModel = data.sliceModel as Record<string, unknown> | undefined;

  return {
    id: doc.id,
    ...data,
    freshFromOvenAt: data.freshFromOvenAt === null ? null : toDate(data.freshFromOvenAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    model: model ? { ...model, updatedAt: toDate(model.updatedAt) } : model,
    sliceModel: sliceModel ? { ...sliceModel, updatedAt: toDate(sliceModel.updatedAt) } : undefined,
  };
}

/**
 * Categorias + produtos crus (sem calcular "saiu do forno"/"esgotado" —
 * isso depende de `Date.now()` e tem que rodar fora do `'use cache'`, na
 * renderização, senão o selo fica preso no cache; ver lib/fresh.ts e o
 * componente que consome isto).
 *
 * Mesma tag `tenant:<id>` de `getTenantBySlug` — um `revalidateTag` só
 * (Etapa 3) invalida perfil + cardápio juntos.
 */
export async function getMenu(tenantId: string): Promise<Menu> {
  "use cache";
  cacheTag(`tenant:${tenantId}`);
  cacheLife("tenant");

  const tenantRef = adminDb.collection("tenants").doc(tenantId);

  // Sem `.where("active", ...)` de propósito: evita depender de um índice
  // composto (categories: active + order) que não existe em
  // firebase/firestore.indexes.json. Poucas categorias por loja — filtrar
  // em memória é mais simples que criar o índice.
  const [categoriesSnap, productsSnap] = await Promise.all([
    tenantRef.collection("categories").orderBy("order", "asc").get(),
    tenantRef.collection("products").orderBy("order", "asc").get(),
  ]);

  const categories = categoriesSnap.docs
    .map((doc) => categorySchema.safeParse({ id: doc.id, ...doc.data() }))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter((category) => category.active);

  const products = productsSnap.docs
    .map((doc) => productSchema.safeParse(mapProductDoc(doc)))
    .filter((result) => result.success)
    .map((result) => result.data);

  return { categories, products };
}
