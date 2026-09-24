import { defineConfig } from "vitest/config";

// Só firebase/*.rules.test.ts — precisa dos emuladores rodando (Firestore
// + Storage), por isso fica separado do `vitest.config.mts` (rápido, sem
// dependência externa). Ver `npm run test:rules`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["firebase/**/*.rules.test.ts"],
  },
});
