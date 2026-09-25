"use client";

export type TrackEvent = "menu_view" | "product_view" | "model_open" | "ar_open" | "whatsapp_click";

type TrackParams = {
  tenantId: string;
  productId?: string;
  locale: string;
  origin: string;
};

/**
 * Dispara um evento de analytics pro `POST /api/track` (docs/ARQUITETURA.md,
 * "Analytics (custo zero)") — nunca espera resposta (`sendBeacon`, com
 * fallback pra `fetch(..., {keepalive:true})` em navegadores sem suporte).
 * Sem dado pessoal: só tenant/produto/locale/origem.
 */
export function track(event: TrackEvent, params: TrackParams) {
  const body = JSON.stringify({ event, ...params });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/track", {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  });
}
