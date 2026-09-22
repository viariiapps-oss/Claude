import { describe, expect, it } from "vitest";
import { bucketSamples } from "@/db/bucket";
import { applyExplorer, explorerSchema } from "@/lib/explorer";
import { computeAggregates, computeGrowth } from "@/services/metrics";
import { demoGames, demoHistory, demoMeta, demoStats, demoVisitsAt } from "@/services/demo/generator";
import { estimateRevenue } from "@/services/revenue/estimator";
import type { GameSummary } from "@/types";
import { formatCompact, formatMoney, formatPercent, likeRatio, pctChange } from "@/utils/format";
import { parseDeveloperId, parseGameInput } from "@/utils/ids";

describe("format", () => {
  it("formats compact numbers and placeholders", () => {
    expect(formatCompact(28_400_000_000)).toBe("28.4B");
    expect(formatCompact(1_840_000, 2)).toBe("1.84M");
    expect(formatCompact(null)).toBe("—");
    expect(formatPercent(8.4)).toBe("+8.4%");
    expect(formatMoney(1234.5, "USD", false)).toBe("$1,234.5");
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(1, 0)).toBeNull();
    expect(likeRatio(90, 10)).toBeCloseTo(0.9);
  });
});

describe("id parsing", () => {
  it("parses roblox URLs, ids and text", () => {
    expect(parseGameInput("https://www.roblox.com/games/920587237/Adopt-Me")).toEqual({ kind: "url", placeId: 920587237 });
    expect(parseGameInput("https://www.roblox.com/es/games/2753915549")).toEqual({ kind: "url", placeId: 2753915549 });
    expect(parseGameInput(" 126884695634066 ")).toEqual({ kind: "id", id: 126884695634066 });
    expect(parseGameInput("Grow a Garden")).toEqual({ kind: "text", query: "Grow a Garden" });
    expect(parseDeveloperId("group-4372130")).toEqual({ type: "Group", robloxId: 4372130 });
    expect(parseDeveloperId("group-abc")).toBeNull();
    expect(parseDeveloperId("../etc")).toBeNull();
  });
});

describe("history bucketing", () => {
  it("averages players and keeps last cumulative values, without inventing gaps", () => {
    const t0 = Date.UTC(2026, 0, 1);
    const pts = bucketSamples(
      [
        { t: t0, players: 10, visits: 100, favorites: 1, likes: 1 },
        { t: t0 + 60_000, players: 20, visits: 110, favorites: 2, likes: 1 },
        { t: t0 + 2 * 3_600_000, players: 30, visits: 200, favorites: 3, likes: 2 },
      ],
      t0,
      3600,
    );
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ players: 15, visits: 110 });
    expect(pts[1]).toMatchObject({ players: 30, visits: 200 });
  });
});

describe("demo generator", () => {
  const g = demoGames()[0];
  it("is deterministic and visits are monotonic", () => {
    const now = Date.UTC(2026, 8, 20, 12);
    expect(demoStats(g, now)).toEqual(demoStats(g, now));
    let prev = -1;
    for (let t = now - 30 * 86_400_000; t <= now; t += 3_600_000) {
      const v = demoVisitsAt(g, t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("produces aggregates and growth from history", () => {
    const now = Date.UTC(2026, 8, 20, 12);
    const hist = demoHistory(g, now - 14 * 86_400_000, now, 3600);
    const agg = computeAggregates(hist, now);
    expect(agg.coverageHours7d).toBeGreaterThanOrEqual(167);
    expect(agg.avgPlayers7d).not.toBeNull();
    const growth = computeGrowth(demoStats(g, now), agg);
    expect(growth.players7d).not.toBeNull();
    expect(growth.visitsGained24h).toBeGreaterThan(0);
  });
});

describe("explorer", () => {
  const now = Date.UTC(2026, 8, 20, 12);
  const games: GameSummary[] = demoGames().map((g) => {
    const stats = demoStats(g, now);
    return {
      meta: demoMeta(g),
      stats,
      growth: { players24h: null, players7d: null, visitsGained24h: null, visitsGained7d: null, visits7d: null, favorites7d: null },
      revenue: estimateRevenue({ avgPlayers: stats.players, window: "current", genre: g.genre, gamePassCount: null, historySamples: 0, coverageHours7d: 0, source: "demo" }),
      source: "demo",
    };
  });

  it("filters by genre and sorts by players", () => {
    const r = applyExplorer(games, explorerSchema.parse({ genre: "Simulation", sort: "players" }));
    expect(r.games.every((g) => g.meta.genre === "Simulation")).toBe(true);
    for (let i = 1; i < r.games.length; i++) expect(r.games[i - 1].stats.players!).toBeGreaterThanOrEqual(r.games[i].stats.players!);
  });

  it("searches by name, creator and id", () => {
    expect(applyExplorer(games, explorerSchema.parse({ q: "garden" })).games[0].meta.name).toBe("Grow a Garden");
    expect(applyExplorer(games, explorerSchema.parse({ q: "uplift" })).games[0].meta.name).toBe("Adopt Me!");
    expect(applyExplorer(games, explorerSchema.parse({ q: "2753915549" })).games[0].meta.name).toBe("Blox Fruits");
  });

  it("rejects invalid params", () => {
    expect(explorerSchema.safeParse({ pageSize: "5000" }).success).toBe(false);
    expect(explorerSchema.safeParse({ createdAfter: "yesterday" }).success).toBe(false);
  });
});
