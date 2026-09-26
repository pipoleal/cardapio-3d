/**
 * Verifica que o modo por caminho (`NEXT_PUBLIC_PATH_TENANT_MODE=true`,
 * decisão nº 26 em `docs/DECISOES.md`) preserva o prefixo `/l/<slug>` em
 * toda navegação dentro da loja: abrir, clicar num produto, trocar de
 * idioma, voltar — a URL nunca deveria perder o prefixo em nenhum passo.
 *
 * Precisa do servidor de dev rodando com o modo LIGADO (diferente dos
 * outros scripts `check-*`, que usam o modo subdomínio padrão):
 *   NEXT_PUBLIC_PATH_TENANT_MODE=true npm run dev
 * (emuladores + seed também rodando, como os demais).
 *   npm run check-path-tenant
 */
import { chromium } from "playwright";

const ROOT_DOMAIN = process.env.SCREENSHOT_ROOT_DOMAIN ?? "localhost:3000";
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? `http://${ROOT_DOMAIN}`;
const TENANT_SLUG = "demo";
const PREFIX = `/l/${TENANT_SLUG}`;

let problems = 0;

function check(condition: boolean, description: string) {
  if (condition) {
    console.log(`OK: ${description}`);
  } else {
    console.error(`FALHOU: ${description}`);
    problems += 1;
  }
}

function pathnameOf(url: string): string {
  return new URL(url).pathname;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}${PREFIX}`, { waitUntil: "networkidle" });
  check(
    pathnameOf(page.url()) === PREFIX,
    `abre ${PREFIX} e serve a loja direto (sem redirect) — achado: ${pathnameOf(page.url())}`,
  );
  check(
    (await page.locator('a[href^="/l/demo/p/"]').count()) > 0,
    "cards de produto já saem com o prefixo /l/demo no href (sem precisar clicar)",
  );

  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith(`${PREFIX}/p/`)),
    page.locator('a[href^="/l/demo/p/"]').first().click(),
  ]);
  check(
    pathnameOf(page.url()).startsWith(`${PREFIX}/p/`),
    `clicar num produto mantém o prefixo ${PREFIX} — achado: ${pathnameOf(page.url())}`,
  );

  // Variant "compact" na página de produto: precisa abrir o dropdown antes.
  await page.getByRole("button", { name: "Idioma" }).click();
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith(`${PREFIX}/en/p/`)),
    page.getByRole("link", { name: "EN", exact: true }).click(),
  ]);
  check(
    pathnameOf(page.url()).startsWith(`${PREFIX}/en/p/`),
    `trocar pra EN mantém o prefixo ${PREFIX} (e adiciona /en) — achado: ${pathnameOf(page.url())}`,
  );

  await Promise.all([
    page.waitForURL((url) => url.pathname === `${PREFIX}/en`),
    // Página já está em EN (trocamos no passo anterior) — o aria-label do
    // botão voltar segue o locale atual ("Back", não "Voltar").
    page.getByRole("link", { name: "Back" }).click(),
  ]);
  check(
    pathnameOf(page.url()) === `${PREFIX}/en`,
    `"voltar" a partir do EN mantém o prefixo ${PREFIX} e o locale — achado: ${pathnameOf(page.url())}`,
  );

  // Trocar de volta pra PT (variant "pills" na home, sem dropdown) e conferir
  // que o redirect de limpeza (prefixo redundante /pt) também preserva o /l/demo.
  await Promise.all([
    page.waitForURL((url) => url.pathname === PREFIX),
    page.getByRole("link", { name: "PT", exact: true }).click(),
  ]);
  check(
    pathnameOf(page.url()) === PREFIX,
    `trocar de volta pra PT (locale padrão) volta pro prefixo puro, sem "/pt" — achado: ${pathnameOf(page.url())}`,
  );

  await browser.close();

  if (problems > 0) {
    console.error(`\n${problems} problema(s) encontrado(s).`);
    process.exit(1);
  }
  console.log(
    "\nOK: navegação completa no modo por caminho manteve /l/demo em todos os passos (abrir, clicar em produto, trocar idioma, voltar).",
  );
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
