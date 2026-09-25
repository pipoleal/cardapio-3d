"use client";

import { track } from "@/lib/track";

/**
 * As duas "dicas discretas" do WhatsApp (linha no topo do cardápio não tem
 * link — só texto; o botão pequeno depois dos alergênicos, na página de
 * produto, tem) — mesmo padrão de clique do `WhatsAppCta`, mas sem o
 * estilo de CTA fixo/chamativo.
 */
export function DiscreetWhatsappLink({
  href,
  label,
  tenantId,
  productId,
  locale,
  origin,
  testId,
}: {
  href: string;
  label: string;
  tenantId: string;
  productId?: string;
  locale: string;
  origin: string;
  testId?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      onClick={() => track("whatsapp_click", { tenantId, productId, locale, origin })}
      className="inline-flex min-h-11 w-fit items-center justify-center rounded-cta border border-border px-4 text-sm font-medium text-ink"
    >
      {label}
    </a>
  );
}
