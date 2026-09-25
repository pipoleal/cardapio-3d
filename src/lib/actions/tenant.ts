"use server";

import { FieldValue } from "firebase-admin/firestore";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { localeSchema, mediaUrlSchema, whatsappModeSchema } from "@/lib/schemas/common";
import { getStorageProvider } from "@/lib/storage";
import { assertTenantOwner } from "./guard";

// Espelha "Configurações" (mockup, nav do painel): nome, WhatsApp + modo,
// idiomas ativos, cor. Logo tem a própria action (setTenantLogo) — o
// upload já resolve o Storage antes de chamar.
const settingsInputSchema = z.object({
  name: z.string().min(1).max(80),
  whatsapp: z.string().min(8).max(20),
  whatsappMode: whatsappModeSchema,
  whatsappTemplate: z.string().min(1).max(300).optional(),
  // pt é sempre implícito — isto é só en/es habilitados pra loja.
  extraLocales: z.array(localeSchema.exclude(["pt"])),
  themePrimary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "cor precisa ser hex de 6 dígitos, ex.: #9C3D27"),
});

export type TenantSettingsInput = z.infer<typeof settingsInputSchema>;

export async function updateTenantSettings(tenantId: string, input: TenantSettingsInput): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsed = settingsInputSchema.parse(input);

  // Mesmo cuidado do products.ts: dot-path preserva template.en/es; sem
  // valor, apaga o campo whatsappTemplate inteiro (LocalizedText exige
  // `.pt`, um `{}` vazio quebra o parse do tenant inteiro).
  const templateUpdate = parsed.whatsappTemplate
    ? { "whatsappTemplate.pt": parsed.whatsappTemplate }
    : { whatsappTemplate: FieldValue.delete() };

  await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .update({
      name: parsed.name,
      whatsapp: parsed.whatsapp,
      whatsappMode: parsed.whatsappMode,
      ...templateUpdate,
      locales: ["pt", ...parsed.extraLocales],
      "theme.primary": parsed.themePrimary,
      updatedAt: FieldValue.serverTimestamp(),
    });

  updateTag(`tenant:${tenant.id}`);
}

const logoInputSchema = z.object({ url: mediaUrlSchema, path: z.string().min(1) });

/**
 * Chamado depois do upload direto pro storage (`lib/storage/upload-client.ts`)
 * — só persiste a URL/caminho. Apaga o logo anterior do storage (se
 * houver e for um caminho diferente — no provider Firebase o caminho é
 * sempre fixo, `addRandomSuffix` só existe no Blob, então a troca nunca
 * dispara um delete ali, o upload novo já sobrescreve no lugar).
 */
export async function setTenantLogo(tenantId: string, input: z.infer<typeof logoInputSchema>): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsed = logoInputSchema.parse(input);

  await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .update({ logoUrl: parsed.url, logoPath: parsed.path, updatedAt: FieldValue.serverTimestamp() });

  updateTag(`tenant:${tenant.id}`);

  if (tenant.logoPath && tenant.logoPath !== parsed.path) {
    await getStorageProvider().delete(tenant.logoPath, { access: "public" });
  }
}
