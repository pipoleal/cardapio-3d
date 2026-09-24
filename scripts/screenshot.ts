/**
 * Verificação visual manual (não é teste automatizado): abre o cardápio e
 * a página de produto da loja demo em 390px e salva screenshots pra
 * comparar com docs/referencias-visuais/01-*.png e 02-*.png.
 *
 * Precisa dos emuladores + seed + `npm run dev` rodando (porta 3000).
 *   npx playwright install chromium   (uma vez só)
 *   npm run screenshot
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://demo.localhost:3000";
const OUT_DIR = path.join(process.cwd(), "screenshots");

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  // Os mockups são em pt, mas o Chromium headless deste ambiente manda
  // Accept-Language: es por padrão — sem isso, a primeira visita (sem
  // cookie ainda) abriria em espanhol. Seta o cookie antes de navegar.
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "pt",
      domain: "demo.localhost",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  console.log(`Cardápio: ${BASE_URL}/`);
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, "01-cardapio.png"), fullPage: true });

  console.log(`Produto: ${BASE_URL}/p/brigadeiro-tradicional`);
  await page.goto(`${BASE_URL}/p/brigadeiro-tradicional`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, "02-produto.png"), fullPage: true });

  await browser.close();
  console.log(`Screenshots salvos em ${OUT_DIR}`);
}

run().catch((error: unknown) => {
  console.error("Screenshot falhou:", error);
  process.exit(1);
});
