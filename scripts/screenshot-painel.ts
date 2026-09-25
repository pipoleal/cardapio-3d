/**
 * Verificação visual manual (não é teste automatizado): loga de verdade
 * (via /entrar) como dona da loja demo e salva screenshots do painel em
 * 1440px (comparar com docs/referencias-visuais/04-*.png e 05-*.png) e em
 * 390px (celular — Etapa 4, produtos/editar produto/captura precisam
 * funcionar nessa largura: lista, card "Modelo 3D" e a gaveta da sidebar).
 *
 * Precisa dos emuladores + seed + `npm run dev` rodando (porta 3000).
 *   npm run screenshot-painel
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { adminAuth, adminDb } from "../src/lib/firebase/admin-app";
import { FieldValue } from "firebase-admin/firestore";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "screenshots");
const TENANT_SLUG = "demo";
const EMAIL = "screenshot-owner@example.com";
const PASSWORD = "senha123456";

async function ensureOwner(): Promise<void> {
  let uid: string;
  try {
    uid = (await adminAuth.getUserByEmail(EMAIL)).uid;
  } catch {
    uid = (await adminAuth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: true })).uid;
  }
  await adminDb
    .collection("users")
    .doc(uid)
    .set({ email: EMAIL, tenantIds: [TENANT_SLUG], createdAt: FieldValue.serverTimestamp() });

  const tenantRef = adminDb.collection("tenants").doc(TENANT_SLUG);
  const tenant = await tenantRef.get();
  const ownerUids: string[] = tenant.data()?.ownerUids ?? [];
  if (!ownerUids.includes(uid)) {
    await tenantRef.update({ ownerUids: [...ownerUids, uid] });
  }
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  await ensureOwner();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`Login: ${BASE_URL}/entrar`);
  await page.goto(`${BASE_URL}/entrar`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("E-mail").fill(EMAIL);
  await page.getByPlaceholder("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"), { timeout: 15000 });

  console.log(`Visão geral: ${BASE_URL}/painel/${TENANT_SLUG}`);
  await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, "04-visao-geral.png"), fullPage: true });

  console.log(`Editar produto: ${BASE_URL}/painel/${TENANT_SLUG}/produtos/brigadeiro-tradicional`);
  // "load", não "networkidle": o card "Modelo 3D" (Model3DStatus) abre um
  // canal de long-polling do Firestore (`onSnapshot`) que nunca fica
  // "ocioso" de verdade — "networkidle" trava até estourar o timeout.
  await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}/produtos/brigadeiro-tradicional`, { waitUntil: "load" });
  await page.getByText("Modelo 3D", { exact: true }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(OUT_DIR, "05-editar-produto.png"), fullPage: true });

  // Celular (390px) — Etapa 4: sidebar vira gaveta, lista de produtos e o
  // card "Modelo 3D" (editar produto) precisam caber sem quebrar.
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/entrar`, { waitUntil: "networkidle" });
  await mobilePage.getByPlaceholder("E-mail").fill(EMAIL);
  await mobilePage.getByPlaceholder("Senha").fill(PASSWORD);
  await mobilePage.getByRole("button", { name: "Entrar", exact: true }).click();
  await mobilePage.waitForURL((url) => !url.pathname.startsWith("/entrar"), { timeout: 15000 });

  console.log(`[390px] Produtos: ${BASE_URL}/painel/${TENANT_SLUG}/produtos`);
  await mobilePage.goto(`${BASE_URL}/painel/${TENANT_SLUG}/produtos`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(OUT_DIR, "mobile-produtos.png"), fullPage: true });

  console.log(`[390px] Editar produto: ${BASE_URL}/painel/${TENANT_SLUG}/produtos/brigadeiro-tradicional`);
  await mobilePage.goto(`${BASE_URL}/painel/${TENANT_SLUG}/produtos/brigadeiro-tradicional`, { waitUntil: "load" });
  await mobilePage.getByText("Modelo 3D", { exact: true }).waitFor({ timeout: 10000 });
  await mobilePage.screenshot({ path: path.join(OUT_DIR, "mobile-editar-produto.png"), fullPage: true });

  console.log(`[390px] Captura: ${BASE_URL}/painel/${TENANT_SLUG}/captura?produto=brigadeiro-tradicional`);
  await mobilePage.goto(`${BASE_URL}/painel/${TENANT_SLUG}/captura?produto=brigadeiro-tradicional`, {
    waitUntil: "load",
  });
  await mobilePage.getByText("Antes de começar", { exact: true }).waitFor({ timeout: 10000 });
  await mobilePage.screenshot({ path: path.join(OUT_DIR, "mobile-captura.png"), fullPage: true });

  await browser.close();
  console.log(`Screenshots salvos em ${OUT_DIR}`);
}

run().catch((error: unknown) => {
  console.error("Screenshot falhou:", error);
  process.exit(1);
});
