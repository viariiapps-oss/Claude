import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/utils/format";

/** Signed % change with icon — never color alone. */
export function Delta({ value, className, digits = 1 }: { value: number | null; className?: string; digits?: number }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn("text-xs text-subtle", className)}>—</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-xs font-medium",
        flat ? "text-muted" : up ? "text-success" : "text-danger",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatPercent(value, digits)}
    </span>
  );
}
