"use client";

import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";

async function createSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw new Error("session");
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Depois do signIn (Google ou e-mail), o SDK web já tem o usuário —
  // troca o ID token pelo cookie de sessão (única fonte que o servidor
  // confia) e só então navega.
  async function afterSignIn() {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("no-id-token");
    await createSession(idToken);
    router.push(nextPath);
    router.refresh();
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await afterSignIn();
    } catch {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      await afterSignIn();
    } catch {
      setError("Não foi possível entrar com o Google.");
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={loading}>
        Entrar com Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="E-mail"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 rounded-input border border-border bg-surface px-4 text-sm text-ink"
        />
        <input
          type="password"
          required
          placeholder="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 rounded-input border border-border bg-surface px-4 text-sm text-ink"
        />
        {/* --color-rec (vermelho de gravação) é o único tom "de alerta forte" do
            design system — reaproveitado aqui por falta de um token dedicado a erro. */}
        {error && <p className="text-sm text-rec">{error}</p>}
        <Button type="submit" disabled={loading}>
          Entrar
        </Button>
      </form>
    </div>
  );
}
