/**
 * Verifica a detecção de origem (?origem=) e os 3 modos do WhatsApp
 * (lib/origin.ts) num navegador de verdade:
 *   - "prominent": CTA fixo no rodapé (home + produto).
 *   - "discreet": sem CTA fixo, só as dicas discretas (linha no topo do
 *     cardápio + botão pequeno depois dos alergênicos, na página de
 *     produto).
 *   - "off": nada em lugar nenhum.
 *   - Origem presencial (?origem=loja) reduz "prominent" pra "discreet",
 *     mas "off" continua "off".
 *   - Link compartilhado: ?origem= some da URL e persiste em cookie.
 *
 * `getTenantBySlug`/`getMenu` usam `'use cache'` com `cacheLife("tenant")`
 * (revalidate a cada 60s — ver next.config.ts) — mudar `whatsappMode` num
 * tenant que o app já serviu antes ficaria com cache velho até a próxima
 * revalidação, o que tornaria esse script lento e instável. Em vez de
 * mutar a loja "demo" (usada pros testes de origem, que não depende de
 * modo específico), cada MODO ganha seu próprio tenant fixo, criado uma
 * vez aqui — sem mutação depois de criado, sem problema de cache.
 *
 * Precisa dos emuladores + seed rodando + dev (ou build+start) no ar.
 *   npm run check-origin
 */
import { FieldValue } from "firebase-admin/firestore";
import { chromium, type Page } from "playwright";
import { adminDb } from "../src/lib/firebase/admin-app";
import type { WhatsappMode } from "../src/lib/schemas/common";

const ROOT_DOMAIN = process.env.SCREENSHOT_ROOT_DOMAIN ?? "localhost:3000";
const DEMO_BASE_URL = process.env.SCREENSHOT_BASE_URL ?? `http://demo.${ROOT_DOMAIN}`;
const PRODUCT_PATH = "/p/brigadeiro-tradicional";
const MODE_PRODUCT_PATH = "/p/item";
const INSTAGRAM_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 302.0.0.23.114 Mobile/15E148";

const MODE_TENANT_SLUGS: Record<WhatsappMode, string> = {
  prominent: "check-origin-prominent",
  discreet: "check-origin-discreet",
  off: "check-origin-off",
};

let problems = 0;

function check(condition: boolean, description: string) {
  if (condition) {
    console.log(`OK: ${description}`);
  } else {
    console.error(`FALHOU: ${description}`);
    problems += 1;
  }
}

async function ensureModeTenant(mode: WhatsappMode) {
  const slug = MODE_TENANT_SLUGS[mode];

  await adminDb
    .collection("slugs")
    .doc(slug)
    .set({ tenantId: slug, createdAt: FieldValue.serverTimestamp() });

  await adminDb
    .collection("tenants")
    .doc(slug)
    .set({
      slug,
      name: `Fixture ${mode}`,
      whatsapp: "5511999999999",
      whatsappMode: mode,
      locales: ["pt"],
      defaultLocale: "pt",
      theme: { primary: "#9C3D27" },
      ownerUids: [],
      plan: "pilot",
      limits: { modelsPerMonth: 10, products: 50 },
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  await adminDb
    .collection("tenants")
    .doc(slug)
    .collection("categories")
    .doc("categoria")
    .set({ name: { pt: "Categoria" }, order: 0, active: true });

  await adminDb
    .collection("tenants")
    .doc(slug)
    .collection("products")
    .doc("item")
    .set({
      categoryId: "categoria",
      name: { pt: "Item" },
      priceCents: 1000,
      allergens: [],
      model: { status: "none" },
      available: true,
      acceptsOrders: true,
      order: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

async function countTestId(page: Page, testId: string): Promise<number> {
  return page.locator(`[data-testid="${testId}"]`).count();
}

async function run() {
  await Promise.all(
    (Object.keys(MODE_TENANT_SLUGS) as WhatsappMode[]).map((mode) => ensureModeTenant(mode)),
  );

  const browser = await chromium.launch();

  // ---- os 3 modos, origem direto e origem presencial (?origem=loja) ----
  for (const mode of Object.keys(MODE_TENANT_SLUGS) as WhatsappMode[]) {
    const baseUrl = `http://${MODE_TENANT_SLUGS[mode]}.${ROOT_DOMAIN}`;
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === (mode === "prominent" ? 1 : 0),
      `${mode} + direto (home): CTA fixo ${mode === "prominent" ? "aparece" : "some"}`,
    );
    check(
      (await countTestId(page, "whatsapp-hint-counter")) === (mode === "discreet" ? 1 : 0),
      `${mode} + direto (home): linha "fale no balcão" ${mode === "discreet" ? "aparece" : "some"}`,
    );

    await page.goto(`${baseUrl}${MODE_PRODUCT_PATH}`, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === (mode === "prominent" ? 1 : 0),
      `${mode} + direto (produto): CTA fixo ${mode === "prominent" ? "aparece" : "some"}`,
    );
    check(
      (await countTestId(page, "whatsapp-hint-discreet")) === (mode === "discreet" ? 1 : 0),
      `${mode} + direto (produto): botão discreto ${mode === "discreet" ? "aparece" : "some"}`,
    );

    // Origem presencial: prominent -> discreet; discreet continua discreet; off continua off.
    const expectedDiscreetHintOnLoja = mode !== "off";
    await page.goto(`${baseUrl}/?origem=loja`, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === 0,
      `${mode} + loja: CTA fixo sempre some (origem presencial nunca é prominent)`,
    );
    check(
      (await countTestId(page, "whatsapp-hint-counter")) === (expectedDiscreetHintOnLoja ? 1 : 0),
      `${mode} + loja (home): linha "fale no balcão" ${expectedDiscreetHintOnLoja ? "aparece (reduzido a discreet)" : "continua sumida (off não religa)"}`,
    );
    await page.goto(`${baseUrl}${MODE_PRODUCT_PATH}?origem=loja`, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-hint-discreet")) === (expectedDiscreetHintOnLoja ? 1 : 0),
      `${mode} + loja (produto): botão discreto ${expectedDiscreetHintOnLoja ? "aparece" : "continua sumido"}`,
    );

    await context.close();
  }

  // ---- origem (loja "demo", whatsappMode = "prominent" no seed) ----

  // QR do balcão: origem presencial reduz prominent -> discreet.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${DEMO_BASE_URL}/?origem=loja`, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === 0,
      "demo (prominent) + ?origem=loja: CTA fixo some na home",
    );
    await page.goto(`${DEMO_BASE_URL}${PRODUCT_PATH}?origem=loja`, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === 0,
      "demo (prominent) + ?origem=loja: CTA fixo some na página de produto",
    );
    await context.close();
  }

  // Instagram via ?origem= explícito: não é presencial, mantém prominent.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${DEMO_BASE_URL}/?origem=instagram`, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === 1,
      "demo (prominent) + ?origem=instagram: CTA fixo aparece",
    );
    await context.close();
  }

  // Instagram via User-Agent (sem ?origem=): mesma regra, outro caminho.
  {
    const context = await browser.newContext({ userAgent: INSTAGRAM_USER_AGENT });
    const page = await context.newPage();
    await page.goto(DEMO_BASE_URL, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === 1,
      "demo (prominent) + User-Agent do Instagram (sem ?origem=): CTA fixo aparece",
    );
    await context.close();
  }

  // Direto: sem param, sem cookie, UA normal -> mostra (prominent).
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(DEMO_BASE_URL, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === 1,
      "demo (prominent) + sem ?origem=, sem cookie, UA normal: CTA fixo aparece",
    );
    await context.close();
  }

  // Link compartilhado: URL limpa + cookie persiste a origem.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${DEMO_BASE_URL}/?origem=loja`, { waitUntil: "networkidle" });

    const url = new URL(page.url());
    check(!url.searchParams.has("origem"), "?origem= some da URL depois do redirect (link limpo pra compartilhar)");

    const cookies = await context.cookies();
    const originCookie = cookies.find((cookie) => cookie.name === "c3d_origin");
    check(originCookie?.value === "loja", "cookie c3d_origin fica salvo com a origem 'loja'");

    // Segunda visita, já sem o param: o cookie sozinho tem que continuar
    // reduzindo prominent -> discreet (prova que a origem persiste).
    await page.goto(DEMO_BASE_URL, { waitUntil: "networkidle" });
    check(
      (await countTestId(page, "whatsapp-cta-prominent")) === 0,
      "segunda visita sem ?origem=, só com o cookie, continua sem o CTA fixo",
    );
    await context.close();
  }

  await browser.close();

  if (problems > 0) {
    console.error(`\n${problems} problema(s) encontrado(s).`);
    process.exit(1);
  }
  console.log("\nOK: todos os cenários de origem e dos 3 modos do WhatsApp (prominent/discreet/off) se comportaram como esperado.");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
