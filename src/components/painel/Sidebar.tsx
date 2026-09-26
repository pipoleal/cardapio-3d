"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/cn";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Cardápio 3D";

const NAV_ITEMS = [
  { href: "", label: "Visão geral" },
  { href: "/categorias", label: "Categorias" },
  { href: "/produtos", label: "Produtos" },
  { href: "/captura", label: "Captura 3D" },
  { href: "/traducoes", label: "Traduções" },
  { href: "/qrcode", label: "QR Code" },
  { href: "/configuracoes", label: "Configurações" },
];

type SwitcherTenant = { slug: string; name: string };

// Sidebar escura 296px (mockup 04): nome do produto, seletor de loja, nav,
// "Conectado como" no rodapé. No celular (< lg) vira gaveta: escondida por
// padrão, uma barra no topo com botão de menu abre por cima do conteúdo.
export function Sidebar({
  currentSlug,
  switcherTenants,
  userEmail,
  isSuperadmin,
}: {
  currentSlug: string;
  switcherTenants: SwitcherTenant[];
  userEmail: string | undefined;
  isSuperadmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const base = `/painel/${currentSlug}`;

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    await signOut(auth);
    router.push("/entrar");
    router.refresh();
  }

  return (
    <>
      {/* Barra do celular: só existe abaixo de lg, fica no fluxo normal
          (não fixa) — o conteúdo da página rola por baixo dela. */}
      <header className="flex items-center justify-between border-b border-border bg-ink px-4 py-3 text-surface lg:hidden">
        <p className="font-heading text-lg font-semibold">{APP_NAME}</p>
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-input hover:bg-white/10"
        >
          <MenuIcon />
        </button>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[296px] shrink-0 -translate-x-full flex-col justify-between bg-ink px-4 py-6 text-surface transition-transform duration-200 lg:static lg:z-auto lg:h-dvh lg:translate-x-0",
          mobileOpen && "translate-x-0",
        )}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="font-heading px-2 text-lg font-semibold">{APP_NAME}</p>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-input hover:bg-white/10 lg:hidden"
            >
              <CloseIcon />
            </button>
          </div>

          {switcherTenants.length > 0 && (
            <select
              aria-label="Loja"
              value={currentSlug}
              onChange={(event) => router.push(`/painel/${event.target.value}`)}
              className="w-full rounded-input border border-white/20 bg-transparent px-3 py-2 text-sm"
            >
              {switcherTenants.map((tenant) => (
                <option key={tenant.slug} value={tenant.slug} className="text-ink">
                  {tenant.name}
                </option>
              ))}
            </select>
          )}

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const href = `${base}${item.href}`;
              const active = item.href === "" ? pathname === base : pathname.startsWith(href);
              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "min-h-11 rounded-input px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-surface text-ink" : "text-surface/80 hover:bg-white/10",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-2 rounded-input bg-white/5 px-3 py-3 text-xs">
          <p className="text-surface/60">Conectado como</p>
          <p className="truncate font-medium">
            {userEmail ?? "—"}
            {isSuperadmin ? " · Admin" : ""}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-left text-surface/70 underline hover:text-surface"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
