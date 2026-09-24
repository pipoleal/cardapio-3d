/**
 * Verifica a detecção de origem (?origem=) e a regra de exibição do CTA
 * do WhatsApp (lib/origin.ts) num navegador de verdade — cobre:
 *   1. QR do balcão (?origem=loja) esconde o CTA (origem presencial).
 *   2. Instagram via ?origem=instagram mostra o CTA (tenant demo = "direct").
 *   3. Instagram via User-Agent (sem param) também mostra o CTA.
 *   4. Direto (sem param, sem cookie, UA normal) mostra o CTA.
 *   5. Link compartilhado: ?origem=loja limpa da URL e persiste em cookie
 *      (uma segunda visita sem o param continua escondendo o CTA).
 *
 * Precisa dos emuladores + seed + dev (ou build+start) rodando.
 *   npm run check-origin
 */
import { chromium } from "playwright";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://demo.localhost:3000";
const WHATSAPP_CTA_SELECTOR = 'a[href*="wa.me"]';
const INSTAGRAM_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 302.0.0.23.114 Mobile/15E148";

let problems = 0;

function check(condition: boolean, description: string) {
  if (condition) {
    console.log(`OK: ${description}`);
  } else {
    console.error(`FALHOU: ${description}`);
    problems += 1;
  }
}

async function run() {
  const browser = await chromium.launch();

  // 1. QR do balcão: esconde o CTA, na home e na página de produto.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?origem=loja`, { waitUntil: "networkidle" });
    check(
      (await page.locator(WHATSAPP_CTA_SELECTOR).count()) === 0,
      "?origem=loja esconde o CTA do WhatsApp na home",
    );

    await page.goto(`${BASE_URL}/p/brigadeiro-tradicional?origem=loja`, { waitUntil: "networkidle" });
    check(
      (await page.locator(WHATSAPP_CTA_SELECTOR).count()) === 0,
      "?origem=loja esconde o CTA do WhatsApp na página de produto",
    );
    await context.close();
  }

  // 2. Instagram via ?origem= explícito: mostra (tenant demo = "direct").
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?origem=instagram`, { waitUntil: "networkidle" });
    check(
      (await page.locator(WHATSAPP_CTA_SELECTOR).count()) === 1,
      "?origem=instagram mostra o CTA do WhatsApp (tenant demo = direct)",
    );
    await context.close();
  }

  // 3. Instagram via User-Agent (sem ?origem=): mesma regra, outro caminho.
  {
    const context = await browser.newContext({ userAgent: INSTAGRAM_USER_AGENT });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    check(
      (await page.locator(WHATSAPP_CTA_SELECTOR).count()) === 1,
      "User-Agent do Instagram (sem ?origem=) mostra o CTA do WhatsApp",
    );
    await context.close();
  }

  // 4. Direto: sem param, sem cookie, UA normal -> mostra.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    check(
      (await page.locator(WHATSAPP_CTA_SELECTOR).count()) === 1,
      "sem ?origem=, sem cookie, UA normal -> origem direto mostra o CTA",
    );
    await context.close();
  }

  // 5. Link compartilhado: URL limpa + cookie persiste a origem.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?origem=loja`, { waitUntil: "networkidle" });

    const url = new URL(page.url());
    check(!url.searchParams.has("origem"), "?origem= some da URL depois do redirect (link limpo pra compartilhar)");

    const cookies = await context.cookies();
    const originCookie = cookies.find((cookie) => cookie.name === "c3d_origin");
    check(originCookie?.value === "loja", "cookie c3d_origin fica salvo com a origem 'loja'");

    // Segunda visita, já sem o param: o cookie sozinho tem que continuar
    // escondendo o CTA (prova que a origem persiste na sessão).
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    check(
      (await page.locator(WHATSAPP_CTA_SELECTOR).count()) === 0,
      "segunda visita sem ?origem=, só com o cookie, continua escondendo o CTA",
    );
    await context.close();
  }

  await browser.close();

  if (problems > 0) {
    console.error(`\n${problems} problema(s) encontrado(s).`);
    process.exit(1);
  }
  console.log("\nOK: todos os cenários de origem/whatsappMode se comportaram como esperado.");
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
