import { Analytics } from "@vercel/analytics/next";

// Layout aninhado — não redeclara <html>/<body> (isso é do root layout em
// (main)/layout.tsx). Vercel Web Analytics só no site do produto: /painel
// e /admin ficam de fora de propósito (uso interno, não é o público que a
// métrica "visitas no site" quer medir); a loja (subdomínio) tem root
// layout próprio e nem entra nessa discussão.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <Analytics />
    </>
  );
}
