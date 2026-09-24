/**
 * Dá (ou tira) a custom claim `role: "superadmin"` de um usuário do
 * Firebase Auth, pelo e-mail. Funciona contra o emulador (dev) ou um
 * projeto real, dependendo do que `.env.local` apontar.
 *
 *   npm run set-superadmin -- felipe@example.com
 *   npm run set-superadmin -- felipe@example.com --remove
 */
import { adminAuth } from "../src/lib/firebase/admin-app";

async function run() {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error("Uso: npm run set-superadmin -- <email> [--remove]");
    process.exit(1);
  }

  const user = await adminAuth.getUserByEmail(email);
  const makeSuperadmin = flag !== "--remove";
  await adminAuth.setCustomUserClaims(user.uid, makeSuperadmin ? { role: "superadmin" } : {});

  console.log(
    makeSuperadmin
      ? `OK: ${email} (${user.uid}) agora é superadmin.`
      : `OK: ${email} (${user.uid}) não é mais superadmin.`,
  );
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
