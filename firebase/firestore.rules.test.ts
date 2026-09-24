/**
 * Testa firestore.rules contra o emulador de verdade (não é vitest "puro"
 * — precisa de `firebase emulators:start`). Matriz dono · outro usuário ·
 * anônimo · superadmin, por coleção (CLAUDE.md, "Mudanças nas regras do
 * Firestore/Storage precisam de teste no emulador").
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
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-cardapio-firestore-rules-test";
const TENANT_ID = "loja-teste";
const OWNER_UID = "dono-uid";
const OTHER_UID = "outro-uid";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firebase/firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Popula direto, sem regras — como se o servidor (Admin SDK) já tivesse
  // criado tudo antes do teste rodar.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.collection("slugs").doc(TENANT_ID).set({ tenantId: TENANT_ID });
    await db
      .collection("tenants")
      .doc(TENANT_ID)
      .set({
        slug: TENANT_ID,
        name: "Loja Teste",
        whatsapp: "5511999999999",
        whatsappMode: "prominent",
        locales: ["pt"],
        defaultLocale: "pt",
        theme: { primary: "#9C3D27" },
        ownerUids: [OWNER_UID],
        plan: "pilot",
        limits: { modelsPerMonth: 10, products: 50 },
        active: true,
      });
    await db.collection("tenants").doc(TENANT_ID).collection("categories").doc("cat1").set({
      name: { pt: "Bolos" },
      order: 0,
      active: true,
    });
    await db
      .collection("tenants")
      .doc(TENANT_ID)
      .collection("products")
      .doc("prod1")
      .set({
        categoryId: "cat1",
        name: { pt: "Bolo" },
        priceCents: 1000,
        allergens: [],
        model: { status: "none" },
        available: true,
        acceptsOrders: true,
        order: 0,
      });
    await db.collection("tenants").doc(TENANT_ID).collection("modelJobs").doc("job1").set({
      productId: "prod1",
      status: "queued",
    });
    await db.collection("tenants").doc(TENANT_ID).collection("stats").doc("2026-01-01").set({
      menu_view: 1,
    });
    await db.collection("users").doc(OWNER_UID).set({
      email: "dono@teste.com",
      tenantIds: [TENANT_ID],
    });
  });
});

function ownerDb() {
  return testEnv.authenticatedContext(OWNER_UID).firestore();
}
function otherDb() {
  return testEnv.authenticatedContext(OTHER_UID).firestore();
}
function superadminDb() {
  return testEnv.authenticatedContext("super-uid", { role: "superadmin" }).firestore();
}
function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

describe("tenants/{tenantId}", () => {
  it("leitura pública (active=true), mesmo anônimo", async () => {
    await assertSucceeds(anonDb().collection("tenants").doc(TENANT_ID).get());
  });

  it("dono edita campos de negócio", async () => {
    await assertSucceeds(ownerDb().collection("tenants").doc(TENANT_ID).update({ name: "Novo nome" }));
  });

  it("outro usuário e anônimo não editam", async () => {
    await assertFails(otherDb().collection("tenants").doc(TENANT_ID).update({ name: "Hackeado" }));
    await assertFails(anonDb().collection("tenants").doc(TENANT_ID).update({ name: "Hackeado" }));
  });

  it("superadmin edita mesmo sem estar em ownerUids", async () => {
    await assertSucceeds(superadminDb().collection("tenants").doc(TENANT_ID).update({ name: "Editado pelo admin" }));
  });

  it("dono não pode mudar campos protegidos (ownerUids/plan/limits/active)", async () => {
    await assertFails(ownerDb().collection("tenants").doc(TENANT_ID).update({ plan: "pro" }));
    await assertFails(ownerDb().collection("tenants").doc(TENANT_ID).update({ active: false }));
  });

  it("superadmin PODE mudar campos protegidos", async () => {
    await assertSucceeds(superadminDb().collection("tenants").doc(TENANT_ID).update({ plan: "pro" }));
  });

  it("ninguém cria ou apaga tenant direto (só via POST /api/tenants, servidor)", async () => {
    await assertFails(ownerDb().collection("tenants").doc("novo").set({ slug: "novo" }));
    await assertFails(superadminDb().collection("tenants").doc(TENANT_ID).delete());
  });
});

describe("tenants/{tenantId}/categories/{categoryId}", () => {
  it("leitura pública, mesmo anônimo", async () => {
    await assertSucceeds(
      anonDb().collection("tenants").doc(TENANT_ID).collection("categories").doc("cat1").get(),
    );
  });

  it("dono escreve; outro usuário e anônimo não", async () => {
    const category = { name: { pt: "Nova" }, order: 1, active: true };
    await assertSucceeds(
      ownerDb().collection("tenants").doc(TENANT_ID).collection("categories").doc("cat2").set(category),
    );
    await assertFails(
      otherDb().collection("tenants").doc(TENANT_ID).collection("categories").doc("cat3").set(category),
    );
    await assertFails(
      anonDb().collection("tenants").doc(TENANT_ID).collection("categories").doc("cat4").set(category),
    );
  });

  it("superadmin escreve mesmo sem ser dono", async () => {
    await assertSucceeds(
      superadminDb()
        .collection("tenants")
        .doc(TENANT_ID)
        .collection("categories")
        .doc("cat5")
        .set({ name: { pt: "Admin" }, order: 4, active: true }),
    );
  });
});

describe("tenants/{tenantId}/products/{productId}", () => {
  const baseProduct = {
    categoryId: "cat1",
    name: { pt: "Novo" },
    priceCents: 500,
    allergens: [],
    available: true,
    acceptsOrders: true,
    order: 1,
  };

  it("leitura pública, mesmo anônimo", async () => {
    await assertSucceeds(anonDb().collection("tenants").doc(TENANT_ID).collection("products").doc("prod1").get());
  });

  it("dono cria produto com model.status='none'", async () => {
    await assertSucceeds(
      ownerDb()
        .collection("tenants")
        .doc(TENANT_ID)
        .collection("products")
        .doc("prod2")
        .set({ ...baseProduct, model: { status: "none" } }),
    );
  });

  it("dono NÃO cria produto com model.status != 'none' (só o servidor controla isso)", async () => {
    await assertFails(
      ownerDb()
        .collection("tenants")
        .doc(TENANT_ID)
        .collection("products")
        .doc("prod3")
        .set({ ...baseProduct, model: { status: "ready" } }),
    );
  });

  it("dono edita campos de negócio, mas não `model`", async () => {
    await assertSucceeds(
      ownerDb().collection("tenants").doc(TENANT_ID).collection("products").doc("prod1").update({ priceCents: 2000 }),
    );
    await assertFails(
      ownerDb()
        .collection("tenants")
        .doc(TENANT_ID)
        .collection("products")
        .doc("prod1")
        .update({ model: { status: "ready" } }),
    );
  });

  it("outro usuário e anônimo não escrevem", async () => {
    await assertFails(
      otherDb().collection("tenants").doc(TENANT_ID).collection("products").doc("prod1").update({ priceCents: 1 }),
    );
    await assertFails(
      anonDb().collection("tenants").doc(TENANT_ID).collection("products").doc("prod1").update({ priceCents: 1 }),
    );
  });

  it("dono apaga; outro usuário não", async () => {
    await assertFails(otherDb().collection("tenants").doc(TENANT_ID).collection("products").doc("prod1").delete());
    await assertSucceeds(ownerDb().collection("tenants").doc(TENANT_ID).collection("products").doc("prod1").delete());
  });
});

describe("tenants/{tenantId}/modelJobs/{jobId}", () => {
  it("dono lê; outro usuário e anônimo não", async () => {
    await assertSucceeds(ownerDb().collection("tenants").doc(TENANT_ID).collection("modelJobs").doc("job1").get());
    await assertFails(otherDb().collection("tenants").doc(TENANT_ID).collection("modelJobs").doc("job1").get());
    await assertFails(anonDb().collection("tenants").doc(TENANT_ID).collection("modelJobs").doc("job1").get());
  });

  it("ninguém escreve pelo cliente, nem dono nem superadmin (só o servidor, Admin SDK)", async () => {
    await assertFails(
      ownerDb().collection("tenants").doc(TENANT_ID).collection("modelJobs").doc("job2").set({ status: "queued" }),
    );
    await assertFails(
      superadminDb()
        .collection("tenants")
        .doc(TENANT_ID)
        .collection("modelJobs")
        .doc("job2")
        .set({ status: "queued" }),
    );
  });
});

describe("tenants/{tenantId}/stats/{day}", () => {
  it("dono lê; outro usuário e anônimo não", async () => {
    await assertSucceeds(ownerDb().collection("tenants").doc(TENANT_ID).collection("stats").doc("2026-01-01").get());
    await assertFails(otherDb().collection("tenants").doc(TENANT_ID).collection("stats").doc("2026-01-01").get());
    await assertFails(anonDb().collection("tenants").doc(TENANT_ID).collection("stats").doc("2026-01-01").get());
  });

  it("ninguém escreve pelo cliente, nem o dono", async () => {
    await assertFails(
      ownerDb().collection("tenants").doc(TENANT_ID).collection("stats").doc("2026-01-02").set({ menu_view: 1 }),
    );
  });
});

describe("slugs/{slug}", () => {
  it("leitura pública (checar disponibilidade)", async () => {
    await assertSucceeds(anonDb().collection("slugs").doc(TENANT_ID).get());
  });

  it("ninguém escreve direto (só via POST /api/tenants, servidor)", async () => {
    await assertFails(ownerDb().collection("slugs").doc("outraloja").set({ tenantId: "outraloja" }));
  });
});

describe("users/{uid}", () => {
  it("o próprio usuário lê seu doc", async () => {
    await assertSucceeds(ownerDb().collection("users").doc(OWNER_UID).get());
  });

  it("outro usuário e anônimo não leem o doc alheio", async () => {
    await assertFails(otherDb().collection("users").doc(OWNER_UID).get());
    await assertFails(anonDb().collection("users").doc(OWNER_UID).get());
  });

  it("superadmin lê o doc de qualquer usuário", async () => {
    await assertSucceeds(superadminDb().collection("users").doc(OWNER_UID).get());
  });

  it("ninguém escreve direto (só o servidor, Admin SDK)", async () => {
    await assertFails(ownerDb().collection("users").doc(OWNER_UID).update({ tenantIds: ["outraloja"] }));
  });
});
