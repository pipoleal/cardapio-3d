/**
 * Roda a MESMA seed de demo (`scripts/seed.ts`) contra o projeto Firebase
 * apontado pelas env vars atuais — útil pra ter uma loja de demonstração
 * bonita em staging sem esperar a Etapa 6 (cadastro de loja). Sempre pede
 * confirmação no terminal antes de gravar, mostrando o projeto de
 * destino; recusa rodar contra o emulador (pra isso já existe `npm run
 * seed`, sem confirmação nenhuma, de propósito — é local, não tem risco).
 *
 *   npm run seed-real
 */
import { confirm, targetProjectId } from "./confirm";
import { seed } from "./seed";

async function run() {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
    console.error('NEXT_PUBLIC_USE_EMULATORS=true — use "npm run seed" pro emulador, sem confirmação.');
    process.exit(1);
  }

  const projectId = targetProjectId();
  console.log(`Isso vai criar/sobrescrever a loja "demo" com dados de exemplo no projeto Firebase "${projectId}" — PROJETO REAL.`);
  if (!(await confirm("Confirma?"))) {
    console.log("Cancelado.");
    return;
  }

  await seed();
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
