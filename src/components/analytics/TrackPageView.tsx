"use client";

import { useEffect } from "react";
import { track, type TrackEvent } from "@/lib/track";

/**
 * Sem UI (mesmo padrão do `ModelJobsPoller`) — dispara `menu_view`/
 * `product_view` uma vez ao montar. Deduplicado por `sessionStorage`: dar
 * "voltar"/recarregar a mesma página na mesma aba não conta de novo (mas
 * abrir de novo depois de fechar a aba, sim — é por sessão, não por
 * sempre). Falha aberta: se `sessionStorage` não estiver disponível
 * (contexto privado/bloqueado), dispara sem deduplicar em vez de travar.
 */
export function TrackPageView({
  event,
  tenantId,
  productId,
  locale,
  origin,
}: {
  event: Extract<TrackEvent, "menu_view" | "product_view">;
  tenantId: string;
  productId?: string;
  locale: string;
  origin: string;
}) {
  useEffect(() => {
    const key = `tracked:${event}:${tenantId}:${productId ?? ""}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage indisponível — segue sem deduplicar.
    }
    track(event, { tenantId, productId, locale, origin });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só dispara na montagem, de propósito
  }, []);

  return null;
}
