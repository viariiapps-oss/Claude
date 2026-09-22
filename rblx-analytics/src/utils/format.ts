/** Formatting helpers. All accept `null` and render an explicit placeholder. */

export const NA = "—";

export function formatCompact(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NA;
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const n = value / size;
      return `${n.toFixed(n >= 100 ? 0 : digits).replace(/\.0+$/, "")}${suffix}`;
    }
  }
  return Math.round(value).toLocaleString("en-US");
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NA;
  return Math.round(value).toLocaleString("en-US");
}

export function formatPercent(value: number | null | undefined, digits = 1, signed = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NA;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

const NO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW"]);

export function formatMoney(value: number | null | undefined, currency = "USD", compact = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NA;
  const noDecimals = NO_DECIMAL_CURRENCIES.has(currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: compact && Math.abs(value) >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: compact && Math.abs(value) >= 10_000 ? 1 : noDecimals ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${formatCompact(value)} ${currency}`;
  }
}

export function formatMoneyRange(
  range: { low: number; high: number } | null | undefined,
  currency = "USD",
): string {
  if (!range) return NA;
  return `${formatMoney(range.low, currency)} – ${formatMoney(range.high, currency)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return NA;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return NA;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function likeRatio(likes: number | null, dislikes: number | null): number | null {
  if (likes === null || dislikes === null || likes + dislikes === 0) return null;
  return likes / (likes + dislikes);
}
