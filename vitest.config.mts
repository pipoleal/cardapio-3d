import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    // firebase/*.rules.test.ts precisa do emulador rodando — roda à parte
    // (npm run test:rules, vitest.rules.config.mts), não no `npm run test`
    // normal (rápido, sem dependência externa).
    exclude: [...configDefaults.exclude, "firebase/**"],
  },
});
