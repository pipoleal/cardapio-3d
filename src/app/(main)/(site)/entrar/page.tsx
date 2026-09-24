import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

// Lê searchParams (?next=) direto, sem Suspense — sem shell estático que
// valha a pena numa tela de login.
export const instant = false;

function safeNextPath(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  // Só path relativo, começando com uma única "/" — bloqueia redirect
  // aberto (ex.: "//evil.com" é lido pelo navegador como URL absoluta).
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/painel";
}

export default async function EntrarPage(props: PageProps<"/entrar">) {
  const { next } = await props.searchParams;
  const nextPath = safeNextPath(next);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <h1 className="font-heading text-2xl font-semibold text-ink">Entrar</h1>
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
