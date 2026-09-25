import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Núcleo do Admin SDK, sem `import "server-only"` — usado por `admin.ts`
 * (app Next.js, com o guard) e por `scripts/seed.ts` (script Node/tsx
 * fora do bundler do Next, onde `server-only` lançaria erro por resolver
 * a export condition "default" em vez de "react-server").
 */
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

if (useEmulators) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:9199";
  // Sem credencial real, o google-auth-library tenta descobrir se está
  // rodando num ambiente Google Cloud (fetch pro metadata server) — em dev
  // isso sempre falha (ETIMEDOUT/ENOTFOUND) e emite um MetadataLookupWarning
  // que o Next (Turbopack, modo dev) mostra como erro de tela cheia pro
  // usuário, mesmo não afetando nada (os emuladores nunca pedem credencial
  // de verdade). "none" pula essa checagem de vez.
  process.env.METADATA_SERVER_DETECTION ??= "none";
}

function createAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (useEmulators) {
    // Nos emuladores não é preciso credencial real, só o projectId.
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return initializeApp({ projectId, storageBucket });
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltam variáveis do Firebase Admin em .env.local: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
}

const adminApp = createAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
