import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Classe visual da pílula, exportada à parte para o `LanguageSwitcher`
 * (que precisa de `<Link>`, não `<button>`) reaproveitar sem duplicar
 * componente.
 */
export function pillClassName(active: boolean, className?: string): string {
  return cn(
    "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors",
    active ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink hover:bg-bg",
    className,
  );
}

type PillProps = ComponentProps<"button"> & {
  active?: boolean;
};

// Categorias do cardápio, chips de estado etc. (mockup 01: "raio total").
export function Pill({ active = false, className, type = "button", ...props }: PillProps) {
  return <button type={type} className={pillClassName(active, className)} {...props} />;
}
