"use server";

import { FieldValue } from "firebase-admin/firestore";
import { updateTag } from "next/cache";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { localeSchema, mediaUrlSchema, whatsappModeSchema } from "@/lib/schemas/common";
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

/** Chamado depois do upload direto pro Storage (SDK web) — só persiste a URL. */
export async function setTenantLogo(tenantId: string, url: string): Promise<void> {
  const { tenant } = await assertTenantOwner(tenantId);
  const parsedUrl = mediaUrlSchema.parse(url);

  await adminDb
    .collection("tenants")
    .doc(tenant.id)
    .update({ logoUrl: parsedUrl, updatedAt: FieldValue.serverTimestamp() });

  updateTag(`tenant:${tenant.id}`);
}
