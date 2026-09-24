import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Evita reconectar aos emuladores a cada hot-reload do Next.js em dev.
const globalForFirebase = globalThis as unknown as { __firebaseEmulatorsConnected?: boolean };

// "127.0.0.1" só funciona no PRÓPRIO computador — no celular (mesma rede),
// 127.0.0.1 é o celular, não o servidor de dev. NEXT_PUBLIC_EMULATOR_HOST
// (ex.: 192.168.1.9, o mesmo IP do NEXT_PUBLIC_DEV_EXTRA_DOMAIN) deixa
// testar auth/firestore/storage do celular — ver README, "Rodando no celular".
const emulatorHost = process.env.NEXT_PUBLIC_EMULATOR_HOST ?? "127.0.0.1";

if (
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" &&
  typeof window !== "undefined" &&
  !globalForFirebase.__firebaseEmulatorsConnected
) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectStorageEmulator(storage, emulatorHost, 9199);
  globalForFirebase.__firebaseEmulatorsConnected = true;
}
