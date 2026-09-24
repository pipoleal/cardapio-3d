"use client";

import dynamic from "next/dynamic";

// `<model-viewer>` só no cliente, carregado sob demanda (regra 9 do
// CLAUDE.md) — `ssr: false` só é permitido dentro de um Client Component,
// por isso este arquivo existe separado do `ProductViewer` em si.
export const ProductViewerLazy = dynamic(
  () => import("./ProductViewer").then((mod) => mod.ProductViewer),
  { ssr: false },
);
