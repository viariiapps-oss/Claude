import "server-only";
import { cache } from "@/lib/cache";
import { repo } from "@/db";
import type {
  DataSource,
  GameDetail,
  GameStats,
  GameSummary,
  GlobalStats,
  HistoryPoint,
  HistoryRange,
  HistoryResponse,
  MoneyRange,
  SearchResult,
} from "@/types";
import { likeRatio, pctChange } from "@/utils/format";
import { parseGameInput } from "@/utils/ids";
import { getDataStatus } from "./data-status";
import {
  demoGames,
  demoHistory,
  demoMeta,
  demoMonetization,
  demoPeak,
  demoStats,
  findDemoGame,
} from "./demo/generator";
import { computeAggregates, computeGrowth, EMPTY_AGGREGATES, estimatorPlayers } from "./metrics";
import { estimateRevenue } from "./revenue/estimator";
import { ensureLiveSeeded, ensureMonetization, importLiveGame, refreshStale } from "./live.service";
import { omniSearch } from "./roblox/client";

const HOUR = 3_600_000;
const LIST_TTL_MS = 60_000;

export const RANGE_CONFIG: Record<HistoryRange, { ms: number; bucketSeconds: number; label: string }> = {
  "24h": { ms: 24 * HOUR, bucketSeconds: 900, label: "Last 24 hours" },
  "7d": { ms: 7 * 24 * HOUR, bucketSeconds: 3600, label: "Last 7 days" },
  "30d": { ms: 30 * 24 * HOUR, bucketSeconds: 6 * 3600, label: "Last 30 days" },
  "90d": { ms: 90 * 24 * HOUR, bucketSeconds: 24 * 3600, label: "Last 90 days" },
  "1y": { ms: 365 * 24 * HOUR, bucketSeconds: 24 * 3600, label: "Last 12 months" },
};

// ─── Summaries ─────────────────────────────────────────────────────────────────

function buildSummary(
  meta: GameSummary["meta"],
  stats: GameStats,
  hourly: HistoryPoint[],
  passCount: number | null,
  source: DataSource,
  now: number,
): GameSummary {
  const agg = hourly.length ? computeAggregates(hourly, now) : EMPTY_AGGREGATES;
  const revenue = estimateRevenue({
    ...estimatorPlayers(stats, agg),
    genre: meta.genre,
    gamePassCount: passCount,
    historySamples: agg.samples7d,
    coverageHours7d: agg.coverageHours7d,
    source,
    now,
  });
  return { meta, stats, growth: computeGrowth(stats, agg), revenue, source };
}

async function demoSummaries(): Promise<GameSummary[]> {
  return cache.wrap("demo:summaries", LIST_TTL_MS, async () => {
    const now = Date.now();
    return demoGames().map((g) =>
      buildSummary(demoMeta(g), demoStats(g, now), demoHistory(g, now - 14 * 24 * HOUR, now, 3600), g.demo.gamePasses, "demo", now),
    );
  });
}

async function liveSummaries(): Promise<GameSummary[]> {
  return cache.wrap("live:summaries", LIST_TTL_MS, async () => {
    await ensureLiveSeeded();
    const r = repo();
    const games = await r.listGames({ trackedOnly: true });
    const ids = games.map((g) => g.universeId);
    let stats = await r.getLatestStats(ids);
    await refreshStale(games, stats);
    stats = await r.getLatestStats(ids);
    const now = Date.now();
    const [history, monetization] = await Promise.all([
      r.getHistory(ids, new Date(now - 14 * 24 * HOUR).toISOString(), new Date(now).toISOString(), 3600),
      r.getMonetization(ids),
    ]);
    return games
      .filter((g) => stats.has(g.universeId))
      .map((g) =>
        buildSummary(
          g,
          stats.get(g.universeId)!,
          history.get(g.universeId) ?? [],
          monetization.get(g.universeId)?.gamePassCount ?? null,
          "live",
          now,
        ),
      );
  });
}

/** All tracked games with current stats, growth and revenue estimates. */
export async function listGameSummaries(): Promise<{ games: GameSummary[]; source: DataSource }> {
  const status = await getDataStatus();
  if (status.activeSource === "demo") return { games: await demoSummaries(), source: "demo" };
  return { games: await liveSummaries(), source: "live" };
}

// ─── Detail ────────────────────────────────────────────────────────────────────

export type GameLookup =
  | { status: "ok"; game: GameDetail }
  | { status: "redirect"; placeId: number }
  | { status: "not-found"; source: DataSource; reason: string };

/** Looks a game up by place ID (canonical) — universe IDs redirect to the place ID. */
export async function getGameDetail(id: number): Promise<GameLookup> {
  const status = await getDataStatus();
  const now = Date.now();

  if (status.activeSource === "demo") {
    const g = findDemoGame({ placeId: id }) ?? findDemoGame({ universeId: id });
    if (!g) {
      return {
        status: "not-found",
        source: "demo",
        reason: "This game is not part of the demo dataset. Connect live data to look up any Roblox experience.",
      };
    }
    if (g.placeId !== id) return { status: "redirect", placeId: g.placeId };
    const summary = (await demoSummaries()).find((s) => s.meta.placeId === id)!;
    return {
      status: "ok",
      game: { ...summary, peak: toPeak(demoPeak(g, now)), monetization: demoMonetization(g), likeRatio: likeRatio(summary.stats.likes, summary.stats.dislikes) },
    };
  }

  const stored = await importLiveGame(id);
  if (!stored) return { status: "not-found", source: "live", reason: "No public Roblox experience was found for this ID." };
  if (stored.placeId !== id) return { status: "redirect", placeId: stored.placeId };

  const r = repo();
  let stats = (await r.getLatestStats([stored.universeId])).get(stored.universeId);
  await refreshStale([stored], new Map(stats ? [[stored.universeId, stats]] : []));
  stats = (await r.getLatestStats([stored.universeId])).get(stored.universeId);
  if (!stats) return { status: "not-found", source: "live", reason: "Statistics for this experience are currently unavailable." };

  const [history, peaks, monetization] = await Promise.all([
    r.getHistory([stored.universeId], new Date(now - 14 * 24 * HOUR).toISOString(), new Date(now).toISOString(), 3600),
    r.getPeaks([stored.universeId]),
    ensureMonetization(stored.universeId),
  ]);
  const summary = buildSummary(stored, stats, history.get(stored.universeId) ?? [], monetization?.gamePassCount ?? null, "live", now);
  const peak = peaks.get(stored.universeId);
  return {
    status: "ok",
    game: { ...summary, peak: toPeak(peak ?? null), monetization, likeRatio: likeRatio(stats.likes, stats.dislikes) },
  };
}

function toPeak(p: { players: number; at: string; since: string } | null) {
  return p ? { peakPlayers: p.players, peakAt: p.at, trackedSince: p.since } : { peakPlayers: null, peakAt: null, trackedSince: null };
}

// ─── History ───────────────────────────────────────────────────────────────────

export async function getGameHistory(placeId: number, range: HistoryRange): Promise<HistoryResponse | null> {
  const status = await getDataStatus();
  const cfg = RANGE_CONFIG[range];
  const now = Date.now();
  // Align to bucket boundaries so series from different games share timestamps.
  const size = cfg.bucketSeconds * 1000;
  const from = Math.floor((now - cfg.ms) / size) * size;

  if (status.activeSource === "demo") {
    const g = findDemoGame({ placeId });
    if (!g) return null;
    return cache.wrap(`demo:history:${placeId}:${range}:${Math.floor(now / 60_000)}`, 60_000, async () => ({
      placeId,
      range,
      bucketSeconds: cfg.bucketSeconds,
      points: demoHistory(g, from, now, cfg.bucketSeconds),
      source: "demo" as const,
      notice: null,
    }));
  }

  const stored = await repo().getGame({ placeId });
  if (!stored) return null;
  const points =
    (await repo().getHistory([stored.universeId], new Date(from).toISOString(), new Date(now).toISOString(), cfg.bucketSeconds)).get(
      stored.universeId,
    ) ?? [];
  let notice: string | null = null;
  if (points.length === 0) {
    notice = "No history stored yet. History accumulates from the moment a game is tracked (refresh job every 5 minutes).";
  } else if (new Date(points[0].t).getTime() - from > cfg.bucketSeconds * 2000) {
    notice = `Tracking began ${new Date(points[0].t).toUTCString()} — earlier data is not available from Roblox's public APIs.`;
  }
  return { placeId, range, bucketSeconds: cfg.bucketSeconds, points, source: "live", notice };
}

// ─── Search ────────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").trim();
}

export async function searchGames(input: string, limit = 10): Promise<{ results: SearchResult[]; source: DataSource }> {
  const { games, source } = await listGameSummaries();
  const parsed = parseGameInput(input);
  const results: SearchResult[] = [];
  const toResult = (s: GameSummary, matchedBy: SearchResult["matchedBy"]): SearchResult => ({
    placeId: s.meta.placeId,
    universeId: s.meta.universeId,
    name: s.meta.name,
    creatorName: s.meta.creator.name,
    players: s.stats.players,
    iconUrl: s.meta.iconUrl,
    isTracked: s.meta.isTracked,
    matchedBy,
  });

  if (parsed.kind !== "text") {
    const id = parsed.kind === "url" ? parsed.placeId : parsed.id;
    const local = games.find((g) => g.meta.placeId === id || g.meta.universeId === id);
    if (local) return { results: [toResult(local, parsed.kind === "url" ? "url" : "id")], source };
    if (source === "live") {
      const imported = await importLiveGame(id).catch(() => null);
      if (imported) {
        const stats = (await repo().getLatestStats([imported.universeId])).get(imported.universeId);
        results.push({
          placeId: imported.placeId,
          universeId: imported.universeId,
          name: imported.name,
          creatorName: imported.creator.name,
          players: stats?.players ?? null,
          iconUrl: imported.iconUrl,
          isTracked: imported.isTracked,
          matchedBy: parsed.kind === "url" ? "url" : "id",
        });
      }
    }
    return { results, source };
  }

  const q = norm(parsed.query);
  if (q.length === 0) return { results: [], source };
  const scored = games
    .map((g) => {
      const name = norm(g.meta.name);
      const creator = norm(g.meta.creator.name);
      let score = 0;
      let by: SearchResult["matchedBy"] = "name";
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (creator.includes(q)) {
        score = 40;
        by = "creator";
      }
      return { g, score, by };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.g.stats.players ?? 0) - (a.g.stats.players ?? 0));
  results.push(...scored.map((x) => toResult(x.g, x.by)));

  if (source === "live" && results.length < limit) {
    const remote = await omniSearch(parsed.query).catch(() => []);
    for (const r of remote) {
      if (results.some((x) => x.placeId === r.placeId)) continue;
      results.push({ placeId: r.placeId, universeId: r.universeId, name: r.name, creatorName: r.creatorName, players: r.players, iconUrl: null, isTracked: false, matchedBy: "roblox-search" });
    }
  }
  return { results: results.slice(0, limit), source };
}

// ─── Global dashboard ──────────────────────────────────────────────────────────

function sumRange(ranges: MoneyRange[]): MoneyRange | null {
  if (ranges.length === 0) return null;
  return ranges.reduce((a, r) => ({ low: a.low + r.low, mid: a.mid + r.mid, high: a.high + r.high }), { low: 0, mid: 0, high: 0 });
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const { games, source } = await listGameSummaries();
  return cache.wrap(`${source}:global`, LIST_TTL_MS, async () => {
    const now = Date.now();
    const from = now - 7 * 24 * HOUR;
    const bucket = 6 * 3600;

    // Per-game 6-hour series for the last 7 days → summed platform series.
    let perGame: Map<number, HistoryPoint[]>;
    if (source === "demo") {
      perGame = new Map(
        games.map((s) => {
          const g = findDemoGame({ placeId: s.meta.placeId })!;
          return [s.meta.universeId, demoHistory(g, from, now, bucket)];
        }),
      );
    } else {
      perGame = await repo().getHistory(games.map((g) => g.meta.universeId), new Date(from).toISOString(), new Date(now).toISOString(), bucket);
    }

    const playersByT = new Map<string, number>();
    const visitsByT = new Map<string, number>();
    const revenueByT = new Map<string, number>();
    for (const s of games) {
      const pts = perGame.get(s.meta.universeId) ?? [];
      // Revenue scales linearly with players in the model → per-game coefficient.
      const coef =
        s.revenue.status === "ok" && s.revenue.inputs.avgPlayers > 0 ? s.revenue.monthly.mid / s.revenue.inputs.avgPlayers : 0;
      for (const p of pts) {
        if (p.players !== null) {
          playersByT.set(p.t, (playersByT.get(p.t) ?? 0) + p.players);
          revenueByT.set(p.t, (revenueByT.get(p.t) ?? 0) + p.players * coef);
        }
        if (p.visits !== null) visitsByT.set(p.t, (visitsByT.get(p.t) ?? 0) + p.visits);
      }
    }
    const toSeries = (m: Map<string, number>) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, v]) => ({ t, v }));
    const players = toSeries(playersByT);
    const visits = toSeries(visitsByT);
    const revenue = toSeries(revenueByT);

    const halfChange = (series: { v: number }[]) => {
      // Last 24h (4 buckets of 6h) vs the previous 24h.
      if (series.length < 8) return null;
      const last = series.slice(-4).reduce((a, p) => a + p.v, 0);
      const prev = series.slice(-8, -4).reduce((a, p) => a + p.v, 0);
      return pctChange(last, prev);
    };

    const totalPlayers = games.reduce((a, g) => a + (g.stats.players ?? 0), 0);
    const totalVisits = games.reduce((a, g) => a + (g.stats.visits ?? 0), 0);
    const monthly = sumRange(games.flatMap((g) => (g.revenue.status === "ok" ? [g.revenue.monthly] : [])));

    return {
      gamesTracked: games.length,
      playersOnline: {
        value: games.some((g) => g.stats.players !== null) ? totalPlayers : null,
        changePct: halfChange(players),
        changeLabel: "avg. 24h vs previous 24h",
        series: players,
      },
      totalVisits: {
        value: games.some((g) => g.stats.visits !== null) ? totalVisits : null,
        changePct: visits.length >= 2 ? pctChange(visits[visits.length - 1].v, visits[0].v) : null,
        changeLabel: "vs 7 days ago",
        series: visits,
      },
      estimatedMonthlyRevenue: {
        range: monthly,
        changePct: halfChange(revenue),
        changeLabel: "run-rate, 24h vs previous 24h",
        series: revenue,
      },
      source,
      updatedAt: new Date(now).toISOString(),
    };
  });
}

// ─── Live lookup helper for comparisons of untracked games ─────────────────────

export async function getSummariesForPlaceIds(placeIds: number[]): Promise<GameSummary[]> {
  const { games, source } = await listGameSummaries();
  const out: GameSummary[] = [];
  for (const id of placeIds) {
    const local = games.find((g) => g.meta.placeId === id);
    if (local) {
      out.push(local);
      continue;
    }
    if (source === "live") {
      const lookup = await getGameDetail(id).catch(() => null);
      if (lookup?.status === "ok") out.push(lookup.game);
    }
  }
  return out;
}

