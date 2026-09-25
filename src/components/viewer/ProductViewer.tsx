"use client";

import "@google/model-viewer";
import type { ModelViewerElement } from "@google/model-viewer";
import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

export function ProductViewer({
  glbUrl,
  usdzUrl,
  posterUrl,
  alt,
  tenantId,
  productId,
  locale,
  origin,
}: {
  glbUrl: string;
  usdzUrl: string | undefined;
  posterUrl: string | undefined;
  alt: string;
  tenantId: string;
  productId: string;
  locale: string;
  origin: string;
}) {
  const ref = useRef<ModelViewerElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Eventos pro analytics (docs/PIPELINE-3D.md §5).
    const onLoad = () => track("model_open", { tenantId, productId, locale, origin });
    const onArStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status: string }>).detail?.status;
      if (status === "session-started") track("ar_open", { tenantId, productId, locale, origin });
    };

    el.addEventListener("load", onLoad);
    el.addEventListener("ar-status", onArStatus);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("ar-status", onArStatus);
    };
  }, [tenantId, productId, locale, origin]);

  return (
    <model-viewer
      // id estável: o botão "Ver na sua mesa (AR)" fica fora deste
      // componente (como no mockup) e o acha por aqui — ver ArButton.tsx.
      id="product-model-viewer"
      ref={ref}
      src={glbUrl}
      ios-src={usdzUrl}
      poster={posterUrl}
      alt={alt}
      camera-controls
      touch-action="pan-y"
      auto-rotate
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="fixed"
      shadow-intensity="1"
      environment-image="neutral"
      loading="lazy"
      className="h-full w-full"
    />
  );
}
