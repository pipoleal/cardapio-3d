import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/session";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Troca o ID token do SDK web (obtido no cliente, `/entrar`) por um cookie
 * de sessão httpOnly verificável no servidor — é isso que permite
 * `painel/[tenantSlug]/layout.tsx` conferir a posse do tenant sem confiar
 * em nada vindo do cliente.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const idToken = (body as { idToken?: unknown } | null)?.idToken;

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "idToken obrigatório" } },
      { status: 400 },
    );
  }

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      maxAge: SESSION_MAX_AGE_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_token", message: "Token inválido ou expirado" } },
      { status: 401 },
    );
  }
}
