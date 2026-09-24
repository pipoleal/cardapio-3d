import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Raio 16px, borda 1px --color-border, sem sombra (docs/REFERENCIAS-VISUAIS.md).
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-card border border-border bg-surface", className)} {...props} />
  );
}
