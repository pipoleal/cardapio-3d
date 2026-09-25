import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { getMenu } from "@/lib/menu";
import { getTenantById } from "@/lib/tenant";
import type { ParsedUploadPath } from "./pathnames";

/**
 * Autorização pro upload direto do navegador pro Vercel Blob — sem
 * `storage.rules` declarativas aqui, então isso É a regra de negócio
 * (mesmo padrão de dono-do-tenant-ou-superadmin do resto do painel).
 * Lança se não autorizado; `handleUpload` devolve isso como erro pro
 * cliente e nunca gera o token (upload não acontece).
 */
export async function assertUploadAuthorized(parsed: ParsedUploadPath): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado.");

  const tenant = await getTenantById(parsed.tenantId);
  if (!tenant) throw new Error("Loja não encontrada.");
  if (!user.isSuperadmin && !tenant.ownerUids.includes(user.uid)) {
    throw new Error("Sem permissão nesta loja.");
  }

  if ("productId" in parsed) {
    const { products } = await getMenu(parsed.tenantId);
    if (!products.some((product) => product.id === parsed.productId)) {
      throw new Error("Produto não encontrado nesta loja.");
    }
  }
}
