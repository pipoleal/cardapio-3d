"use client";

import type { ModelViewerElement } from "@google/model-viewer";

/**
 * Fora do `ProductViewer` (como no mockup, não o slot `ar-button` interno)
 * — aciona pelo id estável do `<model-viewer>` (ProductViewer.tsx).
 */
export function ArButton({ label }: { label: string }) {
  function handleClick() {
    const viewer = document.getElementById("product-model-viewer") as ModelViewerElement | null;
    void viewer?.activateAR();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-cta border border-ink text-sm font-medium text-ink"
    >
      <ArIcon />
      {label}
    </button>
  );
}

function ArIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 7.5V16l9 5V12M21 7.5V16l-9 5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
