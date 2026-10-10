import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "accent" | "outline" | "ghost" | "danger";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  /** Mostra um spinner e desabilita, sem mudar a largura/altura do botão
   * (os `children` continuam ocupando o espaço, só ficam invisíveis). */
  loading?: boolean;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  accent: "bg-accent text-surface hover:opacity-90",
  outline: "border border-ink bg-transparent text-ink hover:bg-surface",
  ghost: "bg-transparent text-ink hover:bg-surface",
  danger: "bg-rec text-surface hover:opacity-90",
};

// Alvo de toque >= 44px (CLAUDE.md, regra 10). O CTA fixo do WhatsApp usa
// altura própria de 52px via className (ver docs/REFERENCIAS-VISUAIS.md).
export function Button({
  variant = "accent",
  className,
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center rounded-cta px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
      {loading && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
        </span>
      )}
    </button>
  );
}
