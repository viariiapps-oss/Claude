"use client";

import { ArrowRightLeft, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SUPPORTED_CURRENCIES } from "@/config/site";
import { useCurrency } from "@/hooks/use-currency";
import { formatMoney, timeAgo } from "@/utils/format";

const OPTIONS = SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

export function CurrencyConverter() {
  const { rates, isLoading, isError } = useCurrency();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");

  const value = Number(amount);
  const rFrom = rates?.rates[from];
  const rTo = rates?.rates[to];
  const valid = Number.isFinite(value) && value >= 0 && amount.trim() !== "";
  const result = valid && rFrom && rTo ? (value / rFrom) * rTo : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Currency Converter</CardTitle>
          <CardDescription>Uses live USD-based reference rates</CardDescription>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Refresh rates" onClick={() => void qc.invalidateQueries({ queryKey: ["currency"] })}>
          <RefreshCw />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div>
            <Label htmlFor="cc-amount">Amount</Label>
            <Input id="cc-amount" inputMode="decimal" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="mt-2">
              <Select label="From currency" value={from} onValueChange={setFrom} options={OPTIONS} />
            </div>
          </div>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Swap currencies"
            className="mx-auto"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <ArrowRightLeft />
          </Button>
          <div>
            <Label>Result</Label>
            <div className="tabular flex h-10 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-fg" aria-live="polite">
              {isLoading ? <Skeleton className="h-4 w-24" /> : result !== null ? formatMoney(result, to, false) : "—"}
            </div>
            <div className="mt-2">
              <Select label="To currency" value={to} onValueChange={setTo} options={OPTIONS} />
            </div>
          </div>
        </div>
        {rFrom && rTo && (
          <p className="tabular text-xs text-muted">
            1 {from} = {(rTo / rFrom).toLocaleString("en-US", { maximumFractionDigits: 6 })} {to}
          </p>
        )}
        {isError && <p className="text-xs text-danger">Exchange rates could not be loaded.</p>}
        {rates && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-subtle">
            <span>Source: {rates.provider}</span>
            <span>Last updated: {rates.status === "snapshot" ? "never (offline snapshot)" : timeAgo(rates.fetchedAt)}</span>
          </div>
        )}
        {rates?.warning && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {rates.warning}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
