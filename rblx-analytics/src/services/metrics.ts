import type { GameAggregates, GameStats, GrowthMetrics, HistoryPoint } from "@/types";
import { pctChange } from "@/utils/format";
import type { EstimatorInput } from "./revenue/estimator";

const HOUR = 3_600_000;

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function valueNear(points: HistoryPoint[], target: number, toleranceMs: number, key: "visits" | "favorites"): number | null {
  let best: { d: number; v: number } | null = null;
  for (const p of points) {
    const v = p[key];
    if (v === null) continue;
    const d = Math.abs(new Date(p.t).getTime() - target);
    if (d <= toleranceMs && (!best || d < best.d)) best = { d, v };
  }
  return best?.v ?? null;
}

/** Aggregates from ~14 days of hourly-bucketed history. */
export function computeAggregates(hourly: HistoryPoint[], now: number = Date.now()): GameAggregates {
  const within = (fromH: number, toH: number) =>
    hourly
      .filter((p) => {
        const t = new Date(p.t).getTime();
        return t > now - fromH * HOUR && t <= now - toH * HOUR && p.players !== null;
      })
      .map((p) => p.players as number);

  const last24 = within(24, 0);
  const prev24 = within(48, 24);
  const last7d = within(168, 0);
  const prev7d = within(336, 168);

  return {
    // Require a minimum of coverage before reporting an average.
    avgPlayers24h: last24.length >= 6 ? avg(last24) : null,
    avgPlayersPrev24h: prev24.length >= 6 ? avg(prev24) : null,
    avgPlayers7d: last7d.length >= 24 ? avg(last7d) : null,
    avgPlayersPrev7d: prev7d.length >= 24 ? avg(prev7d) : null,
    visits24hAgo: valueNear(hourly, now - 24 * HOUR, 3 * HOUR, "visits"),
    visits7dAgo: valueNear(hourly, now - 168 * HOUR, 12 * HOUR, "visits"),
    favorites7dAgo: valueNear(hourly, now - 168 * HOUR, 12 * HOUR, "favorites"),
    samples7d: last7d.length,
    coverageHours7d: last7d.length,
  };
}

export function computeGrowth(stats: GameStats, a: GameAggregates): GrowthMetrics {
  return {
    players24h: pctChange(a.avgPlayers24h, a.avgPlayersPrev24h),
    players7d: pctChange(a.avgPlayers7d, a.avgPlayersPrev7d),
    visitsGained24h: stats.visits !== null && a.visits24hAgo !== null ? stats.visits - a.visits24hAgo : null,
    visitsGained7d: stats.visits !== null && a.visits7dAgo !== null ? stats.visits - a.visits7dAgo : null,
    visits7d: pctChange(stats.visits, a.visits7dAgo),
    favorites7d: pctChange(stats.favorites, a.favorites7dAgo),
  };
}

/** Picks the best available players average for the revenue model. */
export function estimatorPlayers(stats: GameStats, a: GameAggregates): Pick<EstimatorInput, "avgPlayers" | "window"> {
  if (a.avgPlayers7d !== null && a.coverageHours7d >= 72) return { avgPlayers: a.avgPlayers7d, window: "7d" };
  if (a.avgPlayers24h !== null) return { avgPlayers: a.avgPlayers24h, window: "24h" };
  return { avgPlayers: stats.players, window: "current" };
}

export const EMPTY_AGGREGATES: GameAggregates = {
  avgPlayers24h: null,
  avgPlayersPrev24h: null,
  avgPlayers7d: null,
  avgPlayersPrev7d: null,
  visits24hAgo: null,
  visits7dAgo: null,
  favorites7dAgo: null,
  samples7d: 0,
  coverageHours7d: 0,
};
