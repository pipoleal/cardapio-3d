import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "../globals.css";

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

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Cardápio 3D";

export const metadata: Metadata = {
  title: appName,
  description: "Cardápio virtual com produtos em 3D e AR.",
};

// Root layout para (site) / painel / admin — domínio raiz. A loja
// (subdomínio) tem o próprio root layout em loja/[tenant]/[locale]/layout.tsx
// (precisa de <html lang> dinâmico por tenant/locale, só o root layout
// controla <html>). Ver docs/DECISOES.md.
export default function MainRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
