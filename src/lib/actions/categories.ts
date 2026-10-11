"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { assertTenantOwner } from "./guard";
import { autoTranslateEntity } from "./translate";
import { textFieldsChanged } from "./translate-helpers";

const nameInputSchema = z.string().min(1).max(60);

async function nextCategoryOrder(tenantId: string): Promise<number> {
  const snap = await adminDb
    .collection("tenants")
    .doc(tenantId)
    .collection("categories")
    .orderBy("order", "desc")
    .limit(1)
    .get();
  const last = snap.docs[0]?.data() as { order?: number } | undefined;
  return (last?.order ?? -1) + 1;
}

export async function createCategory(
  tenantId: string,
  name: string,
): Promise<{ id: string; translationFailed: boolean }> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsedName = nameInputSchema.parse(name);

  const ref = adminDb.collection("tenants").doc(tenant.id).collection("categories").doc();
  await ref.set({
    name: { pt: parsedName },
    order: await nextCategoryOrder(tenant.id),
    active: true,
  });

  updateTag(`tenant:${tenant.id}`);

  const result = await autoTranslateEntity(tenant, "category", ref.id);
  return { id: ref.id, translationFailed: result.attempted && !result.ok };
}

export async function updateCategoryName(
  tenantId: string,
  categoryId: string,
  name: string,
): Promise<{ translationFailed: boolean }> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsedName = nameInputSchema.parse(name);

  const ref = adminDb.collection("tenants").doc(tenant.id).collection("categories").doc(categoryId);
  const previousSnap = await ref.get();
  const previousName = (previousSnap.data() as { name?: { pt?: string } } | undefined)?.name?.pt;

  await ref.update({ "name.pt": parsedName });
  updateTag(`tenant:${tenant.id}`);

  if (!textFieldsChanged({ name: previousName }, { name: parsedName })) {
    return { translationFailed: false };
  }

  const result = await autoTranslateEntity(tenant, "category", categoryId);
  return { translationFailed: result.attempted && !result.ok };
}

export async function deleteCategory(tenantId: string, categoryId: string): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);

  await adminDb.collection("tenants").doc(tenant.id).collection("categories").doc(categoryId).delete();

  updateTag(`tenant:${tenant.id}`);
}

/** Arrastar pra reordenar (mockup 04/05, tela de categorias): `orderedIds` já vem na ordem final desejada. */
export async function reorderCategories(tenantId: string, orderedIds: string[]): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);

  const batch = adminDb.batch();
  const collection = adminDb.collection("tenants").doc(tenant.id).collection("categories");
  orderedIds.forEach((categoryId, index) => {
    batch.update(collection.doc(categoryId), { order: index });
  });
  await batch.commit();

  updateTag(`tenant:${tenant.id}`);
}
