import { notFound } from "next/navigation";
import { DM_Sans, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { isAppLocale, routing } from "@/i18n/routing";
import "../../../globals.css";

// Com `cacheComponents`, root params exigem pelo menos um valor aqui
// (senão o build falha — não é opcional). "demo" vira HTML estático de
// verdade; qualquer outro tenant/locale usa o App Shell no primeiro
// acesso e fica com ISR depois (ver docs/next "ISR with Cache Components").
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ tenant: "demo", locale }));
}

// A validação de navegação instantânea (dev) trata o notFound() de tenant
// inexistente como falha de render em vez de deixar o not-found.tsx
// assumir — instant:false desliga só essa validação, o shell estático de
// "demo" (generateStaticParams acima) continua funcionando normalmente.
export const instant = false;

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-fraunces",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans",
});

/**
 * Root layout próprio da loja (subdomínio) — sem `layout.tsx` em `loja/` nem
 * em `loja/[tenant]/`, este é o mais alto da árvore, então `<tenant>` e
 * `<locale>` viram "root parameters" e este arquivo controla `<html>`.
 * Precisa duplicar fontes + import do globals.css (cada root layout precisa
 * dos dois — ver docs/DECISOES.md) para poder setar `<html lang={locale}>`
 * corretamente por requisição, o que o root layout de (main) não consegue
 * fazer (é compartilhado, sempre "pt").
 *
 * De propósito, NÃO busca o tenant aqui (só confere o locale, que tem só 3
 * valores possíveis). `notFound()` disparado dentro do root layout (o que
 * define `<html>`) quebra o modelo de App Shell do PPR quando o tenant não
 * está em `generateStaticParams` — o shell já foi enviado sem `<html>`
 * nenhum pra substituir. Cada página busca o tenant e faz o 404 sozinha
 * (a cor do tema também é aplicada lá, não aqui).
 */
export default async function LojaLayout(props: LayoutProps<"/loja/[tenant]/[locale]">) {
  const { locale } = await props.params;

  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);

  // Só Server Components conseguem `getTranslations`; o LanguageSwitcher é
  // client component (precisa de estado pro dropdown), então precisa do
  // provider pra usar `useTranslations`. Passa `locale` explícito — sem
  // isso, `getMessages()` depende de uma resolução de locale cacheada por
  // `React.cache()` que, nessa árvore (dois root layouts + root params),
  // às vezes resolve antes do `setRequestLocale` acima "grudar", devolvendo
  // pt mesmo com `locale` correto no resto da página (bug real, achado
  // testando /en com Playwright: o provider recebia locale="en" mas
  // messages em pt).
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-ink">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {props.children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
