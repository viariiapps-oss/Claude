"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CURRENCY_CODES, type CurrencyCode } from "@/config/site";
import type { CurrencyRates, MoneyRange } from "@/types";
import { formatMoney, formatMoneyRange } from "@/utils/format";

const STORAGE_KEY = "rblx.currency";

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rates: CurrencyRates | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Converts a USD amount into the selected currency; null when no rate. */
  convert: (usd: number | null | undefined) => number | null;
  format: (usd: number | null | undefined) => string;
  formatRange: (r: MoneyRange | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export async function fetchRates(): Promise<CurrencyRates> {
  const res = await fetch("/api/currency");
  if (!res.ok) throw new Error(`Currency API ${res.status}`);
  return res.json();
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate a persisted preference after mount
      if (saved && CURRENCY_CODES.includes(saved)) setCurrencyState(saved);
    } catch {
      /* storage unavailable (private mode) — keep USD */
    }
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const { data: rates, isLoading, isError } = useQuery({
    queryKey: ["currency"],
    queryFn: fetchRates,
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
  });

  const convert = useCallback(
    (usd: number | null | undefined) => {
      if (usd === null || usd === undefined) return null;
      if (currency === "USD") return usd;
      const r = rates?.rates[currency];
      return r ? usd * r : null;
    },
    [currency, rates],
  );

  // Fall back to USD display while a rate is missing, rather than showing nothing.
  const effective = currency === "USD" || rates?.rates[currency] ? currency : "USD";
  const format = useCallback(
    (usd: number | null | undefined) => formatMoney(effective === "USD" ? (usd ?? null) : convert(usd), effective),
    [convert, effective],
  );
  const formatRange = useCallback(
    (r: MoneyRange | null | undefined) => {
      if (!r) return formatMoneyRange(null);
      if (effective === "USD") return formatMoneyRange(r, "USD");
      const low = convert(r.low);
      const high = convert(r.high);
      return low === null || high === null ? formatMoneyRange(r, "USD") : formatMoneyRange({ low, high }, effective);
    },
    [convert, effective],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, rates, isLoading, isError, convert, format, formatRange }),
    [currency, setCurrency, rates, isLoading, isError, convert, format, formatRange],
  );
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
