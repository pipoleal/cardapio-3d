"use client";

import { cn } from "@/lib/cn";

type ToggleProps = {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
  className?: string;
  disabled?: boolean;
};

// Interruptores do painel: "Esgotado hoje", "Saiu do forno", "Aceita encomenda" (mockup 05).
export function Toggle({ checked, onCheckedChange, label, className, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border transition-colors",
        checked ? "bg-accent" : "bg-border",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-5 w-5 translate-x-1 transform rounded-full bg-surface shadow transition-transform",
          checked && "translate-x-6",
        )}
      />
    </button>
  );
}
