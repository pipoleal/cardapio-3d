import { originSchema, type Origin, type WhatsappMode } from "./schemas/common";

export const ORIGIN_COOKIE = "c3d_origin";

/**
 * Origens presenciais: o cliente já está na loja/mesa/vitrine, então força
 * modo discreto no WhatsApp (esconde o CTA) não importa o que a loja
 * configurou em `tenant.whatsappMode` — quem já está lá pode simplesmente
 * pedir no balcão. Configurável aqui: cobre qualquer tela nova (totem,
 * cardápio físico etc.) sem mexer no resto da lógica.
 */
export const PRESENCIAL_ORIGINS: readonly Origin[] = ["loja", "mesa", "vitrine"];

/** Fallbacks quando não há `?origem=` nem cookie — ver resolveOrigin. */
export const ORIGIN_INSTAGRAM = "instagram";
export const ORIGIN_DIRECT = "direto";

export function isValidOrigin(value: string | null | undefined): value is Origin {
  if (!value) return false;
  return originSchema.safeParse(value).success;
}

export function isPresencialOrigin(origin: string): boolean {
  return PRESENCIAL_ORIGINS.includes(origin);
}

/**
 * Navegador interno do Instagram inclui "Instagram" no User-Agent (ex.:
 * "Instagram 302.0.0.23.114 ..."). Não é 100% à prova de falhas (é
 * heurística), mas cobre o caso comum de alguém abrir o link da bio sem
 * ter vindo com `?origem=instagram` explícito.
 */
export function isInstagramUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /Instagram/i.test(userAgent);
}

/**
 * Resolve a origem da visita, nessa ordem: `?origem=` válido → cookie
 * `c3d_origin` existente → heurística de User-Agent (Instagram in-app
 * browser) → "direto". Só o primeiro caso (`?origem=` explícito) é
 * persistido em cookie (ver proxy.ts) — os fallbacks são recalculados a
 * cada request, de propósito (não "prende" alguém em "instagram" pra
 * sempre só porque a primeira visita foi pelo app).
 */
export function resolveOrigin(params: {
  queryParam: string | null | undefined;
  cookieValue: string | null | undefined;
  userAgent: string | null | undefined;
}): Origin {
  if (isValidOrigin(params.queryParam)) return params.queryParam;
  if (isValidOrigin(params.cookieValue)) return params.cookieValue;
  if (isInstagramUserAgent(params.userAgent)) return ORIGIN_INSTAGRAM;
  return ORIGIN_DIRECT;
}

/**
 * Presencial reduz "prominent" pra "discreet" (quem já está lá pode simplesmente
 * pedir no balcão, não precisa do CTA chamativo) — mas "off" continua "off",
 * a loja que desligou o WhatsApp não liga ele de novo só por causa da origem.
 */
export function resolveWhatsappMode(origin: string, tenantWhatsappMode: WhatsappMode): WhatsappMode {
  if (!isPresencialOrigin(origin)) return tenantWhatsappMode;
  return tenantWhatsappMode === "off" ? "off" : "discreet";
}

/** "prominent" = CTA fixo e chamativo (rodapé). */
export function shouldShowProminentWhatsappCta(origin: string, tenantWhatsappMode: WhatsappMode): boolean {
  return resolveWhatsappMode(origin, tenantWhatsappMode) === "prominent";
}

/** "discreet" = sem CTA fixo, só as dicas discretas (linha no topo do cardápio, botão pequeno no produto). */
export function shouldShowDiscreetWhatsappHint(origin: string, tenantWhatsappMode: WhatsappMode): boolean {
  return resolveWhatsappMode(origin, tenantWhatsappMode) === "discreet";
}
