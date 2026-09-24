"use server";

import { FieldValue } from "firebase-admin/firestore";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { allergenSchema } from "@/lib/schemas/common";
import { assertTenantOwner } from "./guard";

// Espelha os campos do mockup 05 (Informações): nome, categoria, preço,
// descrição, alergênicos, "pode conter", e os 3 interruptores. Variações
// não aparecem no mockup — ficam de fora desta etapa (editáveis só pelo
// seed, por ora).
const productInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().nonnegative(),
  servings: z.number().int().positive().optional(),
  allergens: z.array(allergenSchema),
  mayContain: z.array(allergenSchema).optional(),
  available: z.boolean(),
  acceptsOrders: z.boolean(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

async function nextProductOrder(tenantId: string): Promise<number> {
  const snap = await adminDb
    .collection("tenants")
    .doc(tenantId)
    .collection("products")
    .orderBy("order", "desc")
    .limit(1)
    .get();
  const last = snap.docs[0]?.data() as { order?: number } | undefined;
  return (last?.order ?? -1) + 1;
}

export async function createProduct(tenantId: string, input: ProductInput): Promise<string> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsed = productInputSchema.parse(input);

  const ref = adminDb.collection("tenants").doc(tenant.id).collection("products").doc();
  await ref.set({
    categoryId: parsed.categoryId,
    name: { pt: parsed.name },
    ...(parsed.description ? { description: { pt: parsed.description } } : {}),
    priceCents: parsed.priceCents,
    ...(parsed.servings ? { servings: parsed.servings } : {}),
    allergens: parsed.allergens,
    ...(parsed.mayContain ? { mayContain: parsed.mayContain } : {}),
    model: { status: "none" },
    available: parsed.available,
    freshFromOvenAt: null,
    acceptsOrders: parsed.acceptsOrders,
    order: await nextProductOrder(tenant.id),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  updateTag(`tenant:${tenant.id}`);
  return ref.id;
}

/**
 * Edita os campos "de negócio" do produto — nunca `model`/`sliceModel`
 * (controlados só pelo pipeline 3D, Etapa 4) nem `variants` (fora do
 * mockup 05, ver comentário acima).
 */
export async function updateProduct(
  tenantId: string,
  productId: string,
  input: ProductInput,
): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsed = productInputSchema.parse(input);

  // "description.pt" (dot-path) quando existe, pra não apagar
  // description.en/es junto — mas se o pt for limpo, precisa apagar o
  // campo `description` inteiro: um LocalizedText sem `.pt` (obrigatório
  // no schema) falha o parse e o produto some do cardápio inteiro (ver
  // productSchema/getMenu) — um `{}` "vazio" não é um estado válido.
  const descriptionUpdate = parsed.description
    ? { "description.pt": parsed.description }
    : { description: FieldValue.delete() };

  await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("products")
    .doc(productId)
    .update({
      categoryId: parsed.categoryId,
      "name.pt": parsed.name,
      ...descriptionUpdate,
      priceCents: parsed.priceCents,
      servings: parsed.servings ?? FieldValue.delete(),
      allergens: parsed.allergens,
      mayContain: parsed.mayContain ?? FieldValue.delete(),
      available: parsed.available,
      acceptsOrders: parsed.acceptsOrders,
      updatedAt: FieldValue.serverTimestamp(),
    });

  updateTag(`tenant:${tenant.id}`);
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);

  await adminDb.collection("tenants").doc(tenant.id).collection("products").doc(productId).delete();

  updateTag(`tenant:${tenant.id}`);
}

/**
 * "Marcar 'saiu do forno'" (botão da visão geral, mockup 04) e o
 * interruptor "Saiu do forno" (mockup 05) chamam a mesma action — ligar
 * grava `serverTimestamp()` (some sozinho depois de `FRESH_HOURS`, ver
 * `lib/fresh.ts`), desligar limpa o campo na hora.
 */
export async function setProductFresh(tenantId: string, productId: string, fresh: boolean): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);

  await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("products")
    .doc(productId)
    .update({
      freshFromOvenAt: fresh ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

  updateTag(`tenant:${tenant.id}`);
}

const coverInputSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

/** Chamado depois do upload direto pro Storage (SDK web) — só persiste a referência no Firestore. */
export async function setProductCover(
  tenantId: string,
  productId: string,
  cover: z.infer<typeof coverInputSchema>,
): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsed = coverInputSchema.parse(cover);

  await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .collection("products")
    .doc(productId)
    .update({ coverImage: parsed, updatedAt: FieldValue.serverTimestamp() });

  updateTag(`tenant:${tenant.id}`);
}
