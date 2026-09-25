"use server";

import { FieldValue } from "firebase-admin/firestore";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { allergenSchema, mediaUrlSchema } from "@/lib/schemas/common";
import { getStorageProvider } from "@/lib/storage";
import { deleteOldModelFiles } from "@/lib/three-d/jobs";
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
  url: mediaUrlSchema,
  path: z.string().min(1),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

/**
 * Chamado depois do upload direto pro storage (`lib/storage/upload-client.ts`)
 * — só persiste a referência no Firestore. Apaga a capa anterior do
 * storage (se houver e for um caminho diferente — ver comentário em
 * `setTenantLogo`, `lib/actions/tenant.ts`).
 */
export async function setProductCover(
  tenantId: string,
  productId: string,
  cover: z.infer<typeof coverInputSchema>,
): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsed = coverInputSchema.parse(cover);

  const productRef = adminDb.collection("tenants").doc(tenant.id).collection("products").doc(productId);
  const previousSnap = await productRef.get();
  const previousPath = (previousSnap.data()?.coverImage as { path?: string } | undefined)?.path;

  await productRef.update({ coverImage: parsed, updatedAt: FieldValue.serverTimestamp() });

  updateTag(`tenant:${tenant.id}`);

  if (previousPath && previousPath !== parsed.path) {
    await getStorageProvider().delete(previousPath, { access: "public" });
  }
}

const modelUploadInputSchema = z.object({
  glbUrl: mediaUrlSchema,
  glbPath: z.string().min(1),
  usdzUrl: mediaUrlSchema.optional(),
  usdzPath: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative(),
});

/**
 * "Subir meu modelo" (card Modelo 3D, item d de docs/PIPELINE-3D.md) —
 * chamado depois do upload direto pro storage (mesmo `uploadFile()` da
 * capa/logo, store público). `.usdz` é opcional: sem ele, o Safari do
 * iPhone converte o `.glb` pra USDZ automaticamente no momento do AR
 * (`USDZExporter` do three.js embutido no `<model-viewer>` desde a v4,
 * ver docs/DECISOES.md #25) — enviar um `.usdz` de verdade só dá mais
 * controle sobre o resultado. Substitui `product.model` inteiro (sem
 * `costCents`/`jobId`/`posterUrl` — não fazem sentido pra um upload
 * manual) e apaga os arquivos do modelo anterior.
 */
export async function setProductModelUpload(
  tenantId: string,
  productId: string,
  input: z.infer<typeof modelUploadInputSchema>,
): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsed = modelUploadInputSchema.parse(input);

  const productRef = adminDb.collection("tenants").doc(tenant.id).collection("products").doc(productId);
  const previousSnap = await productRef.get();
  const previousModel = previousSnap.data()?.model as Record<string, unknown> | undefined;

  await productRef.update({
    model: {
      status: "ready",
      glbUrl: parsed.glbUrl,
      glbPath: parsed.glbPath,
      ...(parsed.usdzUrl ? { usdzUrl: parsed.usdzUrl, usdzPath: parsed.usdzPath } : {}),
      route: "upload",
      fileSizeBytes: parsed.fileSizeBytes,
      updatedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  updateTag(`tenant:${tenant.id}`);
  await deleteOldModelFiles(previousModel);
}
