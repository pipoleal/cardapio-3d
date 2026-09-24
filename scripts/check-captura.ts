/**
 * Verifica o pipeline 3D de ponta a ponta com o provider fake (sem gastar
 * crédito Meshy): cria um produto, passa pelo assistente de captura
 * (fallback de arquivo — sem permissão de câmera, cai automaticamente
 * nesse caminho, igual um celular sem contexto seguro), espera o job
 * "processar" e virar "Pronto", e confere o selo 3D no cardápio público.
 *
 * Precisa dos emuladores + seed rodando + dev (ou build+start) no ar, com
 * MODEL_PROVIDER=fake (padrão em .env.local).
 *   npm run check-captura
 */
import { FieldValue } from "firebase-admin/firestore";
import { chromium, type Page } from "playwright";
import { adminAuth, adminDb } from "../src/lib/firebase/admin-app";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const ROOT_DOMAIN = process.env.SCREENSHOT_ROOT_DOMAIN ?? "localhost:3000";
const DEMO_BASE_URL = process.env.SCREENSHOT_DEMO_URL ?? `http://demo.${ROOT_DOMAIN}`;
const TENANT_SLUG = "demo";

// Mesmo dono do check-painel.ts (não um usuário novo): `getTenantBySlug`
// usa `'use cache'` + `cacheTag('tenant:<id>')` (lib/tenant.ts) — um
// `ownerUids` escrito direto pelo Admin SDK aqui (fora de uma Server
// Action) não invalida essa tag, então um dono novo pode não "aparecer"
// pro servidor de dev se ele já tiver servido alguma página da loja antes
// (cache ainda quente de uma execução anterior de outro script, por
// exemplo). Reusar o dono já existente evita essa escrita.
const OWNER_EMAIL = "dono-teste@example.com";
const OWNER_PASSWORD = "senha123456";

// PNG 1x1 mínimo — só pra exercitar o pipeline, não a qualidade da foto.
const FAKE_PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let problems = 0;
function check(condition: boolean, description: string) {
  if (condition) {
    console.log(`OK: ${description}`);
  } else {
    console.error(`FALHOU: ${description}`);
    problems += 1;
  }
}

async function ensureUser(email: string, password: string): Promise<string> {
  try {
    const existing = await adminAuth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const created = await adminAuth.createUser({ email, password, emailVerified: true });
    return created.uid;
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/entrar`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("E-mail").fill(email);
  await page.getByPlaceholder("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"), { timeout: 15000 });
  await page.goto(`${BASE_URL}/painel`, { waitUntil: "networkidle" });
}

async function run() {
  const ownerUid = await ensureUser(OWNER_EMAIL, OWNER_PASSWORD);
  await adminDb
    .collection("users")
    .doc(ownerUid)
    .set({ email: OWNER_EMAIL, tenantIds: [TENANT_SLUG], createdAt: FieldValue.serverTimestamp() });
  await adminDb.collection("tenants").doc(TENANT_SLUG).update({ ownerUids: [ownerUid] });

  const browser = await chromium.launch();
  // Contexto SEM permissão de câmera concedida: getUserMedia rejeita e o
  // CaptureFlow cai no fallback de arquivo — o mesmo caminho que um
  // celular sem HTTPS usaria (ver README, "Rodando no celular").
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page, OWNER_EMAIL, OWNER_PASSWORD);

  // produto novo, só pra este teste
  await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}/produtos/novo`, { waitUntil: "networkidle" });
  const productName = `Produto Captura E2E ${Date.now()}`;
  await page.getByLabel("Nome").fill(productName);
  await page.getByLabel("Preço (R$)").fill("30.00");
  await page.getByRole("button", { name: "Criar produto" }).click();
  await page.waitForURL(/\/produtos\/(?!novo$)[^/]+$/, { timeout: 10000 });
  const productId = page.url().split("/produtos/")[1];
  check(!!productId, `produto criado, id extraído da URL (achado: ${productId})`);

  check((await page.getByText("Sem captura").count()) === 1, "card do modelo 3D começa em 'Sem captura'");
  await page.getByRole("link", { name: "Gerar por fotos (IA)" }).click();
  await page.waitForURL(/\/captura\?produto=/, { timeout: 10000 });

  // prepare → capture
  await page.getByRole("button", { name: "Começar" }).click();
  check((await page.getByText("1 · Frente").count()) === 1, "assistente começa na pose 'Frente'");

  const poses = ["Frente", "45°", "Lateral", "De cima"];
  for (const pose of poses) {
    // Sem permissão de câmera => cameraFailed => botão "Tirar foto" +
    // <input type=file> escondido (fallback igual ao de um celular sem
    // contexto seguro).
    await page.getByRole("button", { name: "Tirar foto" }).waitFor({ timeout: 10000 });
    await page.setInputFiles('input[type="file"]', {
      name: `${pose}.png`,
      mimeType: "image/png",
      buffer: FAKE_PHOTO,
    });
  }

  await page.getByRole("heading", { name: "Revisar fotos" }).waitFor({ timeout: 5000 }).catch(() => null);
  check((await page.getByRole("heading", { name: "Revisar fotos" }).count()) === 1, "chega na revisão depois das 4 fotos");
  check((await page.getByRole("button", { name: "Refazer" }).count()) === 4, "4 miniaturas com botão 'Refazer'");

  await page.getByRole("button", { name: "Gerar 3D" }).click();
  await page.waitForURL(/\/produtos\/[^/]+$/, { timeout: 15000 });
  check(page.url().endsWith(`/produtos/${productId}`), "envio volta pra edição do produto");

  await page.getByText("Processando").waitFor({ timeout: 10000 }).catch(() => null);
  check((await page.getByText("Processando").count()) === 1, "status vira 'Processando' logo após o envio");

  // Fake provider: ~3s queued + ~8s processing (lib/three-d/fake.ts) — o
  // ModelJobsPoller do layout sonda a cada 5s, dá bastante folga.
  await page.getByText("Pronto", { exact: true }).waitFor({ timeout: 30000 }).catch(() => null);
  check((await page.getByText("Pronto", { exact: true }).count()) === 1, "status vira 'Pronto' depois do processamento");
  check((await page.getByText("Android").count()) >= 1, "AR compatível mostra 'Android' (fake não gera USDZ)");

  // cardápio público: selo 3D no card da lista + na página do produto.
  // `getMenu()` é `'use cache'` com `revalidateTag` no fim do GET que
  // finaliza o job — o `onSnapshot` do painel (Firestore direto) costuma
  // disparar um instante antes dessa invalidação se propagar, então um
  // primeiro `goto` pode ainda pegar a versão em cache; um reload cobre
  // essa janela.
  const productCard = page.locator("a", { hasText: productName });
  let badge3dCount = 0;
  for (let attempt = 0; attempt < 3 && badge3dCount === 0; attempt++) {
    await page.goto(DEMO_BASE_URL, { waitUntil: "networkidle" });
    badge3dCount = await productCard.getByText("3D", { exact: true }).count();
  }
  check(badge3dCount === 1, "selo '3D' aparece no card do cardápio");

  await page.goto(`${DEMO_BASE_URL}/p/${productId}`, { waitUntil: "networkidle" });
  check((await page.getByText("Modelo 3D", { exact: true }).count()) === 1, "selo 'Modelo 3D' aparece na página do produto");
  check(
    (await page.getByRole("button", { name: "Ver na sua mesa (AR)" }).count()) === 1,
    "botão de AR aparece na página do produto",
  );
  check((await page.locator("model-viewer").count()) === 1, "<model-viewer> renderizado na página do produto");

  await context.close();
  await browser.close();

  if (problems > 0) {
    console.error(`\n${problems} problema(s) encontrado(s).`);
    process.exit(1);
  }
  console.log("\nOK: pipeline 3D completo (captura → fake provider → viewer + selo 3D) se comportou como esperado.");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
