/**
 * Verifica o painel do lojista de ponta a ponta, pelo fluxo de verdade
 * (login real em /entrar, não atalho): cria os usuários de teste no
 * emulador de Auth, depois exercita CRUD de categoria/produto, upload de
 * capa, tradução, QR code, configurações, logout e as barreiras de acesso
 * (sem sessão, outro usuário sem posse, superadmin).
 *
 * Precisa dos emuladores + seed rodando + dev (ou build+start) no ar.
 *   npm run check-painel
 */
import { FieldValue } from "firebase-admin/firestore";
import { chromium, type Page } from "playwright";
import { adminAuth, adminDb } from "../src/lib/firebase/admin-app";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const TENANT_SLUG = "demo";

const OWNER_EMAIL = "dono-teste@example.com";
const OWNER_PASSWORD = "senha123456";
const OTHER_EMAIL = "outro-teste@example.com";
const OTHER_PASSWORD = "senha123456";
const SUPERADMIN_EMAIL = "admin-teste@example.com";
const SUPERADMIN_PASSWORD = "senha123456";

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
  // A navegação pós-login é client-side (router.push); o redirect() de
  // /painel pra /painel/<slug> nem sempre termina de propagar pra
  // page.url() a tempo, mesmo com networkidle. Recarrega de verdade
  // (round-trip HTTP completo) pra pegar o destino final sem ambiguidade.
  await page.goto(`${BASE_URL}/painel`, { waitUntil: "networkidle" });
}

async function run() {
  const ownerUid = await ensureUser(OWNER_EMAIL, OWNER_PASSWORD);
  const otherUid = await ensureUser(OTHER_EMAIL, OTHER_PASSWORD);
  const superadminUid = await ensureUser(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  await adminAuth.setCustomUserClaims(superadminUid, { role: "superadmin" });

  // createdAt é obrigatório no userSchema — sem ele, getUserDoc() falha a
  // validação zod silenciosamente e devolve null (achado depurando este
  // script: getOwnedTenants ficava sempre vazio mesmo com ownerUids certo).
  await adminDb
    .collection("users")
    .doc(ownerUid)
    .set({ email: OWNER_EMAIL, tenantIds: [TENANT_SLUG], createdAt: FieldValue.serverTimestamp() });
  await adminDb
    .collection("users")
    .doc(otherUid)
    .set({ email: OTHER_EMAIL, tenantIds: [], createdAt: FieldValue.serverTimestamp() });
  await adminDb
    .collection("users")
    .doc(superadminUid)
    .set({ email: SUPERADMIN_EMAIL, tenantIds: [], createdAt: FieldValue.serverTimestamp() });
  await adminDb.collection("tenants").doc(TENANT_SLUG).update({ ownerUids: [ownerUid] });

  const browser = await chromium.launch();

  // ---- dono: login, sidebar, CRUD de categoria/produto, upload, tradução ----
  {
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page, OWNER_EMAIL, OWNER_PASSWORD);
    check(
      page.url() === `${BASE_URL}/painel/${TENANT_SLUG}`,
      `dono loga e cai em /painel/${TENANT_SLUG} (achado: ${page.url()})`,
    );
    check((await page.getByRole("heading", { name: "Visão geral" }).count()) === 1, "Visão geral aparece");
    check((await page.locator("aside").getByText(OWNER_EMAIL).count()) === 1, "sidebar mostra o e-mail conectado");

    // categoria
    await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}/categorias`, { waitUntil: "networkidle" });
    // Nome com timestamp: rodar o script várias vezes (como aconteceu
    // depurando) não deve fazer duas categorias "Categoria E2E" ambíguas
    // pra esta checagem — cada execução cria (e conta) a sua própria.
    const categoryName = `Categoria E2E ${Date.now()}`;
    await page.getByPlaceholder("Nova categoria").fill(categoryName);
    await page.getByRole("button", { name: "Adicionar" }).click();
    await page.getByText(categoryName).waitFor({ timeout: 10000 }).catch(() => null);
    check((await page.getByText(categoryName).count()) === 1, "categoria criada aparece na lista");

    // produto novo
    await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}/produtos/novo`, { waitUntil: "networkidle" });
    await page.getByLabel("Nome").fill("Produto E2E");
    await page.getByLabel("Preço (R$)").fill("42.50");
    await page.getByLabel("Descrição").fill("Descrição de teste E2E.");
    // "Glúten" aparece 2x (Alergênicos e Pode conter traços de) — a
    // primeira é a seção Alergênicos.
    await page.getByRole("checkbox", { name: "Glúten" }).first().check();
    await page.getByRole("button", { name: "Criar produto" }).click();
    // (?!novo$): /produtos/novo (a própria página atual) também bate com
    // /produtos/[^/]+$ — precisa excluir explicitamente, senão o wait
    // resolve na hora, antes do redirect de verdade acontecer.
    await page.waitForURL(/\/produtos\/(?!novo$)[^/]+$/, { timeout: 10000 });
    const productUrl = page.url();
    check(/\/produtos\/(?!novo$)[^/]+$/.test(productUrl), `produto criado, URL vira a de edição (achado: ${productUrl})`);
    check((await page.getByRole("heading", { name: "Produto E2E" }).count()) === 1, "página de edição mostra o nome salvo");

    // upload de capa (arquivo PNG mínimo gerado em memória)
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await page.setInputFiles('input[type="file"]', { name: "capa.png", mimeType: "image/png", buffer: pngBuffer });
    await page.waitForSelector('img[alt=""]', { timeout: 10000 }).catch(() => null);
    check((await page.locator('img[alt=""]').count()) >= 1, "capa aparece como preview depois do upload");

    // toggles
    await page.getByRole("switch", { name: "Esgotado hoje" }).click();
    await page.getByRole("switch", { name: "Saiu do forno" }).click();
    await page.waitForFunction(
      () => document.querySelector('[aria-label="Saiu do forno"]')?.getAttribute("aria-checked") === "true",
      { timeout: 10000 },
    );
    check(
      (await page.getByRole("switch", { name: "Saiu do forno" }).getAttribute("aria-checked")) === "true",
      "toggle 'Saiu do forno' liga e persiste (aria-checked=true)",
    );

    // tradução ("EN" sem exact bate também com "Enviar foto", que começa com "En")
    await page.getByRole("button", { name: "EN", exact: true }).click();
    check((await page.getByText("Ainda não traduzido").count()) === 1, "EN começa 'Ainda não traduzido'");
    await page.getByRole("button", { name: "Traduzir de novo" }).click();
    await page.getByText("Traduzido automaticamente").waitFor({ timeout: 10000 }).catch(() => null);
    check((await page.getByText("Traduzido automaticamente").count()) === 1, "depois de traduzir, status vira 'auto'");
    await page.getByRole("button", { name: "Aprovar tradução" }).click();
    await page.getByText("Aprovado", { exact: true }).waitFor({ timeout: 10000 }).catch(() => null);
    check((await page.getByText("Aprovado", { exact: true }).count()) === 1, "depois de aprovar, status vira 'Aprovado'");

    // QR code
    await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}/qrcode`, { waitUntil: "networkidle" });
    await page.waitForSelector('img[alt="QR code pro cardápio"]', { timeout: 10000 }).catch(() => null);
    check((await page.locator('img[alt="QR code pro cardápio"]').count()) === 1, "QR code renderizado");
    check(
      (await page.locator(`input[value*="origem=instagram"]`).count()) === 1,
      "link da bio (?origem=instagram) aparece",
    );

    // configurações
    await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}/configuracoes`, { waitUntil: "networkidle" });
    await page.getByLabel("Modo do botão do WhatsApp").selectOption("discreet");
    await page.getByRole("button", { name: "Salvar" }).click();
    await page.getByText("Salvo!").waitFor({ timeout: 10000 }).catch(() => null);
    check((await page.getByText("Salvo!").count()) === 1, "configurações salvam e mostram confirmação");

    // sign out
    await page.getByRole("button", { name: "Sair" }).click();
    await page.waitForURL((url) => url.pathname === "/entrar", { timeout: 10000 });
    check(page.url() === `${BASE_URL}/entrar`, "sair volta pra /entrar");

    await context.close();
  }

  // ---- barreiras de acesso ----
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}`, { waitUntil: "networkidle" });
    check(page.url().startsWith(`${BASE_URL}/entrar`), "sem sessão, /painel/<slug> redireciona pra /entrar");
    await context.close();
  }

  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, OTHER_EMAIL, OTHER_PASSWORD);
    await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}`, { waitUntil: "networkidle" });
    check(
      !page.url().includes(`/painel/${TENANT_SLUG}`),
      `usuário sem posse da loja não entra em /painel/${TENANT_SLUG} (achado: ${page.url()})`,
    );
    await context.close();
  }

  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await page.goto(`${BASE_URL}/painel/${TENANT_SLUG}`, { waitUntil: "networkidle" });
    check(page.url() === `${BASE_URL}/painel/${TENANT_SLUG}`, "superadmin entra em /painel/<slug> mesmo sem ser dono");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    check((await page.getByRole("heading", { name: "Todas as lojas" }).count()) === 1, "superadmin acessa /admin");
    check((await page.getByText(TENANT_SLUG).count()) >= 1, "/admin lista a loja demo");
    await context.close();
  }

  // ---- /painel no subdomínio redireciona pro domínio raiz ----
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://${TENANT_SLUG}.localhost:3000/painel`, { waitUntil: "networkidle" });
    check(
      page.url().startsWith(`${BASE_URL}/painel/${TENANT_SLUG}`) || page.url().startsWith(`${BASE_URL}/entrar`),
      `/painel no subdomínio redireciona pro domínio raiz (achado: ${page.url()})`,
    );
    await context.close();
  }

  await browser.close();

  if (problems > 0) {
    console.error(`\n${problems} problema(s) encontrado(s).`);
    process.exit(1);
  }
  console.log("\nOK: painel completo (auth, CRUD, upload, tradução, QR, configurações, barreiras) se comportou como esperado.");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
