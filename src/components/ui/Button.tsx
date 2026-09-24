import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "accent" | "outline" | "ghost";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  accent: "bg-accent text-surface hover:opacity-90",
  outline: "border border-ink bg-transparent text-ink hover:bg-surface",
  ghost: "bg-transparent text-ink hover:bg-surface",
};

// Alvo de toque >= 44px (CLAUDE.md, regra 10). O CTA fixo do WhatsApp usa
// altura própria de 52px via className (ver docs/REFERENCIAS-VISUAIS.md).
export function Button({ variant = "accent", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-cta px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
