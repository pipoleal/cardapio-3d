"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/cn";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Cardápio 3D";

const NAV_ITEMS = [
  { href: "", label: "Visão geral" },
  { href: "/produtos", label: "Produtos" },
  { href: "/captura", label: "Captura 3D" },
  { href: "/traducoes", label: "Traduções" },
  { href: "/qrcode", label: "QR Code" },
  { href: "/configuracoes", label: "Configurações" },
];

type SwitcherTenant = { slug: string; name: string };

// Sidebar escura 296px (mockup 04): nome do produto, seletor de loja, nav,
// "Conectado como" no rodapé.
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
  const base = `/painel/${currentSlug}`;

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    await signOut(auth);
    router.push("/entrar");
    router.refresh();
  }

  return (
    <aside className="flex h-dvh w-[296px] shrink-0 flex-col justify-between bg-ink px-4 py-6 text-surface">
      <div className="flex flex-col gap-6">
        <p className="font-heading px-2 text-lg font-semibold">{APP_NAME}</p>

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
                className={cn(
                  "rounded-input px-3 py-2 text-sm font-medium transition-colors",
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
  );
}
