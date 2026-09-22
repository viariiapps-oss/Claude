"use client";

import { AlertCircle } from "lucide-react";
import { ConfidenceBadge } from "@/components/common/confidence-badge";
import { CurrencySelect } from "@/components/common/currency-select";
import { MoneyRangeText } from "@/components/common/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import type { RevenueEstimate } from "@/types";
import { MethodologyDialog } from "./methodology-dialog";

const PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
] as const;

export function RevenuePanel({ estimate }: { estimate: RevenueEstimate }) {
  const { rates, currency } = useCurrency();
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <CardHeader>
        <div>
          <CardTitle>Estimated Revenue</CardTitle>
          <CardDescription>Creator earnings, estimated from public engagement data. Not official revenue.</CardDescription>
        </div>
        <CurrencySelect />
      </CardHeader>
      <CardContent>
        {estimate.status === "insufficient" ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card-2/60 p-5">
            <p className="flex items-center gap-2 font-medium text-fg">
              <AlertCircle className="size-4 text-warning" aria-hidden /> Insufficient data to estimate revenue.
            </p>
            <p className="text-sm text-muted">{estimate.reason}</p>
            <MethodologyDialog estimate={estimate} />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Monthly · estimated range</p>
                <MoneyRangeText range={estimate.monthly} className="mt-1 block text-3xl font-semibold tracking-tight text-fg sm:text-4xl" />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ConfidenceBadge confidence={estimate.confidence} />
                  <span className="text-xs text-subtle">model {estimate.modelVersion}</span>
                </div>
              </div>
              <MethodologyDialog estimate={estimate} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {PERIODS.map((p) => (
                <div
                  key={p.key}
                  className={cn(
                    "rounded-xl border p-4",
                    p.key === "monthly" ? "border-accent/40 bg-accent-soft" : "border-border bg-card-2/60",
                  )}
                >
                  <p className="text-xs text-muted">{p.label}</p>
                  <MoneyRangeText range={estimate[p.key]} className="mt-1 block text-sm font-semibold text-fg sm:text-base" />
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-subtle">estimated</p>
                </div>
              ))}
            </div>
          </>
        )}
        {currency !== "USD" && rates && rates.status !== "live" && (
          <p className="mt-4 text-xs text-warning">{rates.warning}</p>
        )}
      </CardContent>
    </Card>
  );
}
