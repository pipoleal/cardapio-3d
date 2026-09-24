/**
 * Abre a loja demo em /en e /es (cardápio + 3 produtos, cobrindo variação,
 * "serve N pessoas", alergênicos e "saiu do forno") e procura por texto em
 * português que devia ter sido traduzido. Não é um detector de idioma
 * genérico, é uma lista de textos que sabemos que têm tradução própria em
 * en/es — cobre as strings que este fix corrigiu.
 *
 * Precisa dos emuladores + seed + dev (ou build+start) rodando.
 *   npm run check-translations
 */
import { chromium } from "playwright";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://demo.localhost:3000";

const PAGES = ["/", "/p/brigadeiro-tradicional", "/p/bolo-de-chocolate", "/p/croissant-doce-chocolate"];

// Strings que só existem na versão pt (a tradução en/es é bem diferente) —
// se aparecerem na página /en ou /es, é sinal de i18nStatus não aplicado
// ou de string solta no código sem passar por next-intl/resolveLocalizedText.
// Propositalmente NÃO tem "Brigadeiro" aqui: é mantido igual em pt/en/es
// (pedido do Felipe — ver scripts/seed.ts), então não serve como marcador.
const PT_ONLY_MARKERS = [
  "Contém",
  "Pode conter",
  "Saiu do forno",
  "Esgotado hoje",
  "Voltar",
  "Tamanho",
  "Alergênicos",
  "Encomendar pelo WhatsApp",
  "Ver na sua mesa",
  "Categorias",
  "pessoas",
  "Quero encomendar",
  "quentinho",
  "não",
  "então",
  "Bolos",
  "Torta de limão",
  "Torta de morango",
  "Bolo de chocolate",
  "Bolo de cenoura",
  "Croissant doce de chocolate",
  "Caixa com",
];

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let problems = 0;

  for (const locale of ["en", "es"] as const) {
    for (const pagePath of PAGES) {
      const url = `${BASE_URL}/${locale}${pagePath === "/" ? "" : pagePath}`;
      await page.goto(url, { waitUntil: "networkidle" });

      // innerText (não page.content()): só o que está de fato visível na
      // tela. O HTML bruto/payload RSC embute conteúdo de fallback (ex.: o
      // not-found.tsx da loja, sempre presente como opção de streaming)
      // que nunca chega a aparecer pro usuário — checar isso dava falso
      // positivo. aria-label não é texto visível, então checa à parte.
      const visibleText = await page.evaluate(() => document.body.innerText);
      const ariaLabels = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[aria-label]")).map((el) =>
          el.getAttribute("aria-label"),
        ),
      );
      const haystack = `${visibleText}\n${ariaLabels.join("\n")}`;

      for (const marker of PT_ONLY_MARKERS) {
        if (haystack.includes(marker)) {
          console.error(`[${locale}] ${url} -> encontrado texto em pt: "${marker}"`);
          problems += 1;
        }
      }
    }
  }

  await browser.close();

  if (problems > 0) {
    console.error(`\n${problems} ocorrência(s) de texto em pt encontradas em /en ou /es.`);
    process.exit(1);
  }
  console.log(`OK: nenhum texto em pt encontrado em /en ou /es (${PAGES.length} páginas x 2 locales).`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
