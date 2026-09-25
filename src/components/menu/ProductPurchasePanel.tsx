"use client";

import { useMemo, useState } from "react";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatPriceCents } from "@/lib/price";
import { buildProductWhatsappUrl } from "@/lib/whatsapp";
import { WhatsAppCta } from "./WhatsAppCta";

type Variant = { id: string; name: string; nameInStoreLocale: string; priceCents: number };

type ProductPurchasePanelProps = {
  locale: AppLocale;
  /** `tenant.defaultLocale` — pra mensagem híbrida (ver lib/whatsapp.ts). */
  storeDefaultLocale: AppLocale;
  basePriceCents: number;
  variants: Variant[];
  sizeLabel: string;
  servesLabel?: string;
  phone: string;
  /** Já resolvido no locale do cliente (tenant.whatsappTemplate ou o padrão traduzido). */
  whatsappTemplate: string;
  productName: string;
  /** Nome do produto no locale padrão da loja — só usado quando o cliente está em outro idioma. */
  productNameInStoreLocale: string;
  productUrl: string;
  whatsappCtaLabel: string;
  whatsappCaption?: string;
  /** Já combina `product.acceptsOrders` com a origem/whatsappMode (ver lib/origin.ts) — a página decide, o painel só mostra ou não. */
  showProminentCta: boolean;
  tenantId: string;
  productId: string;
  origin: string;
};

/**
 * Preço + seletor de tamanho + CTA do WhatsApp num componente só: os três
 * dependem do mesmo estado (a variante escolhida) — precisa ser client e
 * precisa ficar junto, senão dava pra separar em componentes menores.
 */
export function ProductPurchasePanel({
  locale,
  storeDefaultLocale,
  basePriceCents,
  variants,
  sizeLabel,
  servesLabel,
  phone,
  whatsappTemplate,
  productName,
  productNameInStoreLocale,
  productUrl,
  whatsappCtaLabel,
  whatsappCaption,
  showProminentCta,
  tenantId,
  productId,
  origin,
}: ProductPurchasePanelProps) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selectedVariant = variants.find((variant) => variant.id === selectedId);
  const priceCents = selectedVariant?.priceCents ?? basePriceCents;

  const whatsappUrl = useMemo(
    () =>
      buildProductWhatsappUrl({
        phone,
        template: whatsappTemplate,
        clientLocale: locale,
        storeDefaultLocale,
        productName,
        productNameInStoreLocale,
        variantName: selectedVariant?.name,
        variantNameInStoreLocale: selectedVariant?.nameInStoreLocale,
        productUrl,
      }),
    [
      phone,
      whatsappTemplate,
      locale,
      storeDefaultLocale,
      productName,
      productNameInStoreLocale,
      selectedVariant,
      productUrl,
    ],
  );

  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-2xl font-semibold text-ink">
          {formatPriceCents(priceCents, locale)}
        </span>
        {servesLabel && <span className="text-sm text-muted">{servesLabel}</span>}
      </div>

      {variants.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted">{sizeLabel}</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedId(variant.id)}
                className={cn(
                  "min-h-11 rounded-input border px-4 text-sm font-medium text-ink transition-colors",
                  variant.id === selectedId ? "border-2 border-ink" : "border-border",
                )}
              >
                {variant.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showProminentCta && (
        <WhatsAppCta
          href={whatsappUrl}
          label={whatsappCtaLabel}
          caption={whatsappCaption}
          tenantId={tenantId}
          productId={productId}
          locale={locale}
          origin={origin}
        />
      )}
    </>
  );
}
