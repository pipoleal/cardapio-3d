"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;
const SUCCESS_MS = 3000;
const ERROR_MS = 6000; // erro fica mais tempo — é o que mais importa ler.

/**
 * Monta uma vez no layout do painel (`painel/[tenantSlug]/layout.tsx`).
 * Sem lib nova: só Context + um `<div>` fixo no rodapé da tela, animação via
 * `@keyframes toast-in` em `globals.css`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? ERROR_MS : SUCCESS_MS);
    },
    [dismiss],
  );

  const value: ToastContextValue = {
    showSuccess: (message) => push("success", message),
    showError: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            onClick={() => dismiss(toast.id)}
            className={cn(
              "animate-toast-in pointer-events-auto w-full max-w-sm cursor-pointer rounded-input px-4 py-3 text-center text-sm font-medium shadow-lg",
              toast.kind === "success" ? "bg-ink text-surface" : "bg-rec text-surface",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `showSuccess`/`showError` — chame depois de qualquer ação do painel (salvar, apagar, traduzir...). */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider> (painel/[tenantSlug]/layout.tsx).");
  return ctx;
}
