import type { Severity } from "@/lib/types";
import { cn } from "@/lib/cn";

// Muted, WCAG-AA legible severity badges: dark text on tinted backgrounds,
// restrained like a government service rather than a neon dashboard.
const STYLES: Record<Severity, string> = {
  critical: "bg-sev-critical-bg text-sev-critical-fg border-sev-critical-fg/30",
  high: "bg-sev-high-bg text-sev-high-fg border-sev-high-fg/30",
  medium: "bg-sev-medium-bg text-sev-medium-fg border-sev-medium-fg/30",
  low: "bg-sev-low-bg text-sev-low-fg border-sev-low-fg/30",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
        STYLES[severity],
      )}
    >
      {severity}
    </span>
  );
}
