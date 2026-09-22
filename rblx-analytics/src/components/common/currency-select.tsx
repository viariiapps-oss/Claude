"use client";

import { Select } from "@/components/ui/select";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/config/site";
import { useCurrency } from "@/hooks/use-currency";

export function CurrencySelect({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <Select
      label="Display currency"
      value={currency}
      onValueChange={(v) => setCurrency(v as CurrencyCode)}
      options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
      className={className ?? "w-44"}
    />
  );
}
