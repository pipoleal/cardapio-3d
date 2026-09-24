import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type ChipTone = "default" | "warning";

type ChipProps = ComponentProps<"span"> & {
  tone?: ChipTone;
};

const TONE_CLASSES: Record<ChipTone, string> = {
  default: "border-border bg-bg-panel text-muted",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

// Chips de alergênico (mockup 02/05: "Contém: …" / "Pode conter: …").
export function Chip({ tone = "default", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
