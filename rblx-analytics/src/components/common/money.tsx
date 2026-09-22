"use client";

import { useCurrency } from "@/hooks/use-currency";
import type { MoneyRange, RevenueEstimate } from "@/types";

/** A USD amount rendered in the viewer's selected currency. */
export function Money({ usd, className }: { usd: number | null | undefined; className?: string }) {
  const { format } = useCurrency();
  return <span className={`tabular ${className ?? ""}`}>{format(usd)}</span>;
}

export function MoneyRangeText({ range, className }: { range: MoneyRange | null | undefined; className?: string }) {
  const { formatRange } = useCurrency();
  return <span className={`tabular ${className ?? ""}`}>{formatRange(range)}</span>;
}

/** Compact monthly estimate cell for tables: range + "est." marker, or unavailable. */
export function RevenueCell({ revenue, period = "monthly" }: { revenue: RevenueEstimate; period?: "daily" | "weekly" | "monthly" | "yearly" }) {
  const { formatRange } = useCurrency();
  if (revenue.status !== "ok") {
    return <span className="text-xs text-subtle" title={revenue.reason}>Insufficient data</span>;
  }
  return (
    <span className="tabular whitespace-nowrap text-sm text-fg" title={`Estimated ${period} creator earnings — not official revenue`}>
      {formatRange(revenue[period])}
      <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-subtle">est.</span>
    </span>
  );
}
