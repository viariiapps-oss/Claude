import "server-only";
import { z } from "zod";
import { CURRENCY_CODES } from "@/config/site";
import { env } from "@/config/env";
import { singleton } from "@/lib/singleton";
import { repo } from "@/db";
import type { CurrencyRates } from "@/types";

/**
 * USD-based FX rates with a provider chain:
 *   1. ExchangeRate-API v6 (when EXCHANGE_RATE_API_KEY is set)
 *   2. Frankfurter (European Central Bank reference rates, no key)
 *   3. open.er-api.com (ExchangeRate-API open endpoint, no key)
 * then the last successfully saved rates (DB/memory), and finally a bundled
 * reference snapshot that is always flagged in the UI as not current.
 */

const TTL_MS = 60 * 60_000; // rates change daily; one fetch per hour is plenty
const FAILURE_BACKOFF_MS = 5 * 60_000;

/** Last-resort, clearly-labelled approximate values. Never shown without a warning. */
const REFERENCE_SNAPSHOT: Record<string, number> = {
  USD: 1, EUR: 0.86, GBP: 0.74, JPY: 147, CAD: 1.37, AUD: 1.52, CHF: 0.8, CNY: 7.15, KRW: 1380,
  BRL: 5.4, MXN: 18.6, INR: 87.5, SEK: 9.5, NOK: 10.1, PLN: 3.65, SGD: 1.28,
};

const ratesRecord = z.record(z.string(), z.number().positive());

interface Provider {
  name: string;
  enabled: () => boolean;
  fetch: () => Promise<Record<string, number>>;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 3600 }, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const providers: Provider[] = [
  {
    name: "ExchangeRate-API",
    enabled: () => Boolean(env().EXCHANGE_RATE_API_KEY),
    fetch: async () => {
      const key = encodeURIComponent(env().EXCHANGE_RATE_API_KEY!);
      const data = z
        .object({ result: z.literal("success"), conversion_rates: ratesRecord })
        .parse(await getJson(`https://v6.exchangerate-api.com/v6/${key}/latest/USD`));
      return data.conversion_rates;
    },
  },
  {
    name: "Frankfurter (ECB)",
    enabled: () => true,
    fetch: async () => {
      const data = z.object({ base: z.literal("USD"), rates: ratesRecord }).parse(await getJson("https://api.frankfurter.dev/v1/latest?base=USD"));
      return { USD: 1, ...data.rates };
    },
  },
  {
    name: "open.er-api.com",
    enabled: () => true,
    fetch: async () => {
      const data = z
        .object({ result: z.literal("success"), rates: ratesRecord })
        .parse(await getJson("https://open.er-api.com/v6/latest/USD"));
      return data.rates;
    },
  },
];

interface State {
  current: CurrencyRates | null;
  lastFailureAt: number;
  inflight: Promise<CurrencyRates> | null;
}
const state = singleton<State>("fx:state", () => ({ current: null, lastFailureAt: 0, inflight: null }));

function pick(rates: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CURRENCY_CODES) if (rates[c]) out[c] = rates[c];
  out.USD = 1;
  return out;
}

async function fetchFromProviders(): Promise<CurrencyRates | null> {
  for (const p of providers) {
    if (!p.enabled()) continue;
    try {
      const rates = pick(await p.fetch());
      return { base: "USD", rates, provider: p.name, fetchedAt: new Date().toISOString(), status: "live", warning: null };
    } catch (e) {
      await repo()
        .logApiError({
          service: "currency",
          endpoint: p.name,
          status: null,
          message: e instanceof Error ? e.message : "Unknown error",
          occurredAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
  }
  return null;
}

async function load(force: boolean): Promise<CurrencyRates> {
  const now = Date.now();
  const cur = state.current;
  if (!force && cur && cur.status === "live" && now - new Date(cur.fetchedAt).getTime() < TTL_MS) return cur;

  if (force || now - state.lastFailureAt > FAILURE_BACKOFF_MS) {
    const fresh = await fetchFromProviders();
    if (fresh) {
      state.current = fresh;
      await repo().saveCurrencyRates(fresh).catch(() => undefined);
      return fresh;
    }
    state.lastFailureAt = now;
  }

  const saved = cur?.status === "live" || cur?.status === "stale" ? cur : await repo().getLatestCurrencyRates().catch(() => null);
  if (saved) {
    const stale: CurrencyRates = {
      base: "USD",
      rates: saved.rates,
      provider: saved.provider,
      fetchedAt: saved.fetchedAt,
      status: "stale",
      warning: "Exchange-rate providers are unreachable — showing the last saved rates.",
    };
    state.current = stale;
    return stale;
  }

  return {
    base: "USD",
    rates: REFERENCE_SNAPSHOT,
    provider: "Bundled reference snapshot",
    fetchedAt: new Date(0).toISOString(),
    status: "snapshot",
    warning: "Live exchange rates are unavailable and none were saved yet. Showing approximate reference values — do not rely on them.",
  };
}

export async function getCurrencyRates(opts: { force?: boolean } = {}): Promise<CurrencyRates> {
  if (state.inflight) return state.inflight;
  state.inflight = load(Boolean(opts.force)).finally(() => {
    state.inflight = null;
  });
  return state.inflight;
}

export async function probeCurrencyProviders(): Promise<{ name: string; enabled: boolean; ok: boolean | null; error: string | null }[]> {
  const out = [];
  for (const p of providers) {
    if (!p.enabled()) {
      out.push({ name: p.name, enabled: false, ok: null, error: "Not configured" });
      continue;
    }
    try {
      await p.fetch();
      out.push({ name: p.name, enabled: true, ok: true, error: null });
    } catch (e) {
      out.push({ name: p.name, enabled: true, ok: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }
  return out;
}
