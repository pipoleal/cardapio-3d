/**
 * Cria uma loja vazia + usuário dono, direto pelas env vars atuais (não
 * força o emulador) — substituto manual do cadastro de loja (`POST
 * /api/tenants`, Etapa 6, ainda não existe) pra montar staging antes
 * disso. Sempre pede confirmação no terminal antes de gravar, mostrando o
 * projeto Firebase de destino.
 *
 *   npm run create-tenant -- boaconfe "Boa Confeitaria" dona@example.com
 */
import { FieldValue } from "firebase-admin/firestore";
import { confirm, targetProjectId } from "./confirm";
import { adminAuth, adminDb } from "../src/lib/firebase/admin-app";

// Mesma lista documentada em CLAUDE.md (regra 1) — só pra esse cadastro
// manual; a validação de verdade fica em `POST /api/tenants` (Etapa 6).
const RESERVED_SLUGS = new Set(["www", "app", "admin", "api", "painel", "static", "mail"]);
const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

async function run() {
  const [slug, name, email] = process.argv.slice(2);
  if (!slug || !name || !email) {
    console.error('Uso: npm run create-tenant -- <slug> "<nome>" <email-do-dono>');
    process.exit(1);
  }

  if (!SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug) || slug.startsWith("demo")) {
    console.error(`Slug inválido ou reservado: "${slug}".`);
    process.exit(1);
  }

  const existingSlug = await adminDb.collection("slugs").doc(slug).get();
  if (existingSlug.exists) {
    console.error(`Slug "${slug}" já está em uso.`);
    process.exit(1);
  }

  const projectId = targetProjectId();
  const usingEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  console.log(
    `Isso vai criar a loja "${slug}" (${name}) e o dono "${email}" no projeto Firebase "${projectId}"${usingEmulators ? " (emulador)" : " — PROJETO REAL"}.`,
  );
  if (!(await confirm("Confirma?"))) {
    console.log("Cancelado.");
    return;
  }

  let owner;
  try {
    owner = await adminAuth.getUserByEmail(email);
  } catch {
    const tempPassword = crypto.randomUUID();
    owner = await adminAuth.createUser({ email, password: tempPassword, emailVerified: false });
    console.log(`Usuário criado com senha temporária — mande um link de redefinição de senha pra ${email}.`);
  }

  const existingUserDoc = await adminDb.collection("users").doc(owner.uid).get();
  const tenantIds: string[] = existingUserDoc.data()?.tenantIds ?? [];
  await adminDb
    .collection("users")
    .doc(owner.uid)
    .set(
      { email, tenantIds: [...new Set([...tenantIds, slug])], createdAt: existingUserDoc.data()?.createdAt ?? FieldValue.serverTimestamp() },
      { merge: true },
    );

  await adminDb.collection("slugs").doc(slug).set({ tenantId: slug, createdAt: FieldValue.serverTimestamp() });

  await adminDb
    .collection("tenants")
    .doc(slug)
    .set({
      slug,
      name,
      whatsapp: "",
      whatsappMode: "discreet",
      locales: ["pt"],
      defaultLocale: "pt",
      theme: { primary: "#9C3D27" },
      ownerUids: [owner.uid],
      plan: "pilot",
      limits: { modelsPerMonth: 10, products: 50 },
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  console.log(`OK: loja "${slug}" criada, dona: ${email} (${owner.uid}). Preencha o WhatsApp e o resto no painel.`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
