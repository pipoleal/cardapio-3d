import { createInterface } from "node:readline/promises";

/**
 * Confirmação no terminal antes de gravar num projeto Firebase de verdade
 * — usado pelos scripts que podem apontar pra um projeto real
 * (create-tenant.ts, seed-real.ts). Resposta diferente de "s"/"sim" (em
 * qualquer caixa) cancela.
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${message} (s/N) `);
    return ["s", "sim"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

/** Projeto Firebase que as env vars atuais apontam — pra mostrar na confirmação. */
export function targetProjectId(): string {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "(desconhecido)"
  );
}
