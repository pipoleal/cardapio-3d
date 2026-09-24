"use client";

import "@google/model-viewer";
import type { ModelViewerElement } from "@google/model-viewer";
import { useEffect, useRef } from "react";

// Eventos pro analytics (docs/PIPELINE-3D.md §5) — `track()` só faz
// console.debug em dev por ora, `/api/track` é Etapa 5, este é o ponto de
// chamada certo pra trocar depois.
function track(event: "model_open" | "ar_open") {
  if (process.env.NODE_ENV !== "production") console.debug("[track]", event);
}

export function ProductViewer({
  glbUrl,
  usdzUrl,
  posterUrl,
  alt,
}: {
  glbUrl: string;
  usdzUrl: string | undefined;
  posterUrl: string | undefined;
  alt: string;
}) {
  const ref = useRef<ModelViewerElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onLoad = () => track("model_open");
    const onArStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status: string }>).detail?.status;
      if (status === "session-started") track("ar_open");
    };

    el.addEventListener("load", onLoad);
    el.addEventListener("ar-status", onArStatus);
    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("ar-status", onArStatus);
    };
  }, []);

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
