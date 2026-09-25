import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { dateKeyInTimezone, DEFAULT_TIMEZONE } from "@/lib/date-key";
import { adminDb } from "@/lib/firebase/admin";
import { getMenu } from "@/lib/menu";
import { trackBodySchema } from "@/lib/schemas/stats";
import { getTenantById } from "@/lib/tenant";

const BOT_USER_AGENT = /bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegrambot|python-requests|curl|wget|axios|postman|headlesschrome/i;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
// Em memória do processo — cada instância serverless da Vercel tem o seu
// próprio mapa (não é um rate limit global entre instâncias). Proteção
// básica contra abuso de um cliente único numa instância quente, não
// anti-DDoS — ver docs/DECISOES.md.
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Sem sessão, chamado por `sendBeacon` do cardápio público (lib/track.ts)
 * — por isso nunca devolve erro visível pra quem chamou (sempre `202`,
 * mesmo rejeitando silenciosamente um bot/limite/tenant inválido): não dá
 * sinal útil pra quem estiver tentando abusar, e `sendBeacon` não lê a
 * resposta mesmo. `/api/*` não passa pelo `proxy.ts` (ver `config.matcher`
 * em `src/proxy.ts`), então `x-origin`/`x-tenant` não existem aqui — a
 * página já resolve isso e manda no corpo (ver docs/ARQUITETURA.md).
 */
export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT_USER_AGENT.test(userAgent)) return new NextResponse(null, { status: 202 });

  if (isRateLimited(clientIp(request))) return new NextResponse(null, { status: 202 });

  const rawBody: unknown = await request.json().catch(() => null);
  const parsed = trackBodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: { code: "invalid_body", message: "Corpo inválido." } }, { status: 400 });

  const { tenantId, event, productId, locale, origin } = parsed.data;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return new NextResponse(null, { status: 202 });

  if (productId) {
    const { products } = await getMenu(tenantId);
    if (!products.some((product) => product.id === productId)) {
      return new NextResponse(null, { status: 202 });
    }
  }

  const today = dateKeyInTimezone(new Date(), DEFAULT_TIMEZONE);
  const statsRef = adminDb.collection("tenants").doc(tenantId).collection("stats").doc(today);

  // Objeto aninhado de verdade, não chave com "." (tipo `{"origin.x": ...}`)
  // — `.set(..., {merge:true})` só funde caminho aninhado quando o dado É
  // aninhado; uma chave com ponto vira um campo literal novo com ponto no
  // nome, não mescla no mapa `origin` existente (achado testando com curl
  // e conferindo o doc no Firestore Emulator UI). `.update()` interpretaria
  // o ponto como caminho, mas falha se o doc do dia ainda não existir.
  const update: Record<string, FieldValue | Record<string, FieldValue>> = {
    locale: { [locale]: FieldValue.increment(1) },
    origin: { [origin]: FieldValue.increment(1) },
  };
  if (event === "menu_view") {
    update.menu_view = FieldValue.increment(1);
  } else if (event === "whatsapp_click") {
    update.whatsapp_click = { [productId ?? "_geral"]: FieldValue.increment(1) };
  } else {
    // product_view / model_open / ar_open — productId já garantido pelo schema.
    update[event] = { [productId!]: FieldValue.increment(1) };
  }

  await statsRef.set(update, { merge: true });

  return new NextResponse(null, { status: 202 });
}
