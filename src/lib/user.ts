import "server-only";
import { adminDb } from "./firebase/admin";
import { toDate } from "./firestore-dates";
import { userSchema, type User } from "./schemas/user";

/**
 * Sem `'use cache'` (ao contrário de `getTenantBySlug`): isso decide quem
 * tem acesso a quê (`tenantIds`) — precisa estar sempre fresco, não pode
 * ficar servindo uma lista de lojas desatualizada por até 60s depois de a
 * lojista ganhar acesso a uma loja nova.
 */
export async function getUserDoc(uid: string): Promise<User | null> {
  const doc = await adminDb.collection("users").doc(uid).get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  const parsed = userSchema.safeParse({
    uid: doc.id,
    ...data,
    createdAt: toDate(data.createdAt),
  });
  if (!parsed.success) {
    // Diferente de "doc não existe" (usuário sem loja ainda, esperado):
    // aqui o doc existe mas está mal-formado — sem isso, a lojista
    // simplesmente não vê loja nenhuma no painel, sem nenhum indício do
    // motivo (achado depurando scripts/check-painel.ts).
    console.error(`getUserDoc(${uid}): doc inválido —`, parsed.error.message);
    return null;
  }
  return parsed.data;
}
