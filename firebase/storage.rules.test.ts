/**
 * Testa storage.rules contra o emulador de verdade — igual ao
 * firestore.rules.test.ts, mesma matriz dono · outro usuário · anônimo ·
 * superadmin. `storage.rules` consulta o Firestore (`isOwner`), por isso
 * este ambiente de teste também precisa das regras/dados do Firestore.
 *
 *   npm run test:rules
 */
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

// Precisa bater com o projeto que o emulador está rodando (`firebase
// emulators:start --project demo-cardapio`) — `firestore.get()` dentro de
// storage.rules (cross-service) não resolve um projeto isolado por teste
// do jeito que os testes só-Firestore conseguem (bug conhecido da lib:
// github.com/firebase/firebase-js-sdk/issues/6803). Por isso este arquivo
// roda no MESMO projeto dos dados reais (ex.: a loja "demo" do seed) — e
// por isso NUNCA chama `clearFirestore()`: isso apagaria o seed inteiro.
// `TENANT_ID` tem um nome bem específico pra nunca colidir com um slug de
// verdade, e o `afterAll` apaga só o que este arquivo criou.
const PROJECT_ID = "demo-cardapio";
const TENANT_ID = "rules-test-storage-tenant";
const OWNER_UID = "dono-uid";
const OTHER_UID = "outro-uid";

// As regras só olham `size`/`contentType`, nunca o conteúdo — não precisa
// ser um arquivo de imagem de verdade.
const STUB_FILE = new Uint8Array([1, 2, 3, 4]);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firebase/firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readFileSync("firebase/storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    // `storage.rules` faz `firestore.get()` pra checar `isOwner` — essa
    // leitura cruzada é avaliada pelas regras do Firestore também (não é
    // um bypass): sem `active: true`, `tenants/{tenantId}.allow read`
    // negaria até esse `get()` interno, derrubando o `isOwner` inteiro
    // (não só quando não é dono).
    await context
      .firestore()
      .collection("tenants")
      .doc(TENANT_ID)
      .set({ ownerUids: [OWNER_UID], active: true });
  });
});

afterAll(async () => {
  // Roda no projeto real (ver comentário acima) — apaga só o doc que este
  // arquivo criou, nunca `clearFirestore()`.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("tenants").doc(TENANT_ID).delete();
  });
  await testEnv.cleanup();
});

function ownerStorage() {
  return testEnv.authenticatedContext(OWNER_UID).storage();
}
function otherStorage() {
  return testEnv.authenticatedContext(OTHER_UID).storage();
}
function superadminStorage() {
  return testEnv.authenticatedContext("super-uid", { role: "superadmin" }).storage();
}
function anonStorage() {
  return testEnv.unauthenticatedContext().storage();
}

async function seedFile(path: string, contentType?: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), path), STUB_FILE, contentType ? { contentType } : undefined);
  });
}

describe("tenants/{tenantId}/products/{productId}/cover.webp", () => {
  const path = `tenants/${TENANT_ID}/products/prod1/cover.webp`;

  it("leitura pública, mesmo anônimo", async () => {
    await seedFile(path, "image/webp");
    await assertSucceeds(getBytes(ref(anonStorage(), path)));
  });

  it("dono escreve; outro usuário e anônimo não", async () => {
    await assertSucceeds(uploadBytes(ref(ownerStorage(), path), STUB_FILE, { contentType: "image/webp" }));
    await assertFails(uploadBytes(ref(otherStorage(), path), STUB_FILE, { contentType: "image/webp" }));
    await assertFails(uploadBytes(ref(anonStorage(), path), STUB_FILE, { contentType: "image/webp" }));
  });

  it("superadmin escreve mesmo sem ser dono", async () => {
    await assertSucceeds(uploadBytes(ref(superadminStorage(), path), STUB_FILE, { contentType: "image/webp" }));
  });

  it("recusa contentType que não é imagem", async () => {
    await assertFails(uploadBytes(ref(ownerStorage(), path), STUB_FILE, { contentType: "application/pdf" }));
  });
});

describe("tenants/{tenantId}/products/{productId}/captures/{jobId}/{file}", () => {
  const path = `tenants/${TENANT_ID}/products/prod1/captures/job1/foto1.jpg`;

  it("leitura só do dono (não é pública)", async () => {
    await seedFile(path, "image/jpeg");
    await assertSucceeds(getBytes(ref(ownerStorage(), path)));
    await assertFails(getBytes(ref(otherStorage(), path)));
    await assertFails(getBytes(ref(anonStorage(), path)));
  });

  it("dono escreve; outro usuário e anônimo não", async () => {
    await assertSucceeds(uploadBytes(ref(ownerStorage(), path), STUB_FILE, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(otherStorage(), path), STUB_FILE, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(anonStorage(), path), STUB_FILE, { contentType: "image/jpeg" }));
  });
});

describe("tenants/{tenantId}/products/{productId}/models/{file}", () => {
  const path = `tenants/${TENANT_ID}/products/prod1/models/model.glb`;

  it("leitura pública, mesmo anônimo", async () => {
    await seedFile(path);
    await assertSucceeds(getBytes(ref(anonStorage(), path)));
  });

  it("ninguém escreve pelo cliente, nem dono nem superadmin (só o servidor, Admin SDK)", async () => {
    await assertFails(uploadBytes(ref(ownerStorage(), path), STUB_FILE));
    await assertFails(uploadBytes(ref(superadminStorage(), path), STUB_FILE));
  });
});

describe("tenants/{tenantId}/branding/{file}", () => {
  const path = `tenants/${TENANT_ID}/branding/logo.webp`;

  it("leitura pública, mesmo anônimo", async () => {
    await seedFile(path, "image/webp");
    await assertSucceeds(getBytes(ref(anonStorage(), path)));
  });

  it("dono escreve; outro usuário e anônimo não", async () => {
    await assertSucceeds(uploadBytes(ref(ownerStorage(), path), STUB_FILE, { contentType: "image/webp" }));
    await assertFails(uploadBytes(ref(otherStorage(), path), STUB_FILE, { contentType: "image/webp" }));
    await assertFails(uploadBytes(ref(anonStorage(), path), STUB_FILE, { contentType: "image/webp" }));
  });
});
