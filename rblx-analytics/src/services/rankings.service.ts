import "server-only";
import type { DataSource, GameSummary } from "@/types";
import { listGameSummaries } from "./games.service";

export type RankingKey = "trending" | "most-played" | "most-visited" | "fastest-growing" | "highest-revenue";

export const RANKINGS: Record<RankingKey, { title: string; metric: string; description: string }> = {
  trending: {
    title: "Trending",
    metric: "Player growth, 24h",
    description: "Games whose average concurrent players rose the most in the last 24 hours vs the previous 24 hours (min. 1,000 players).",
  },
  "most-played": {
    title: "Most Played",
    metric: "Concurrent players",
    description: "Ranked by players online right now.",
  },
  "most-visited": {
    title: "Most Visited",
    metric: "Total visits",
    description: "Ranked by all-time visits reported by Roblox.",
  },
  "fastest-growing": {
    title: "Fastest Growing",
    metric: "Player growth, 7d",
    description: "Average concurrent players over the last 7 days vs the 7 days before (min. 1,000 players).",
  },
  "highest-revenue": {
    title: "Highest Estimated Revenue",
    metric: "Est. monthly revenue (midpoint)",
    description: "Ranked by the midpoint of our monthly revenue ESTIMATE. Not official figures.",
  },
};

const MIN_PLAYERS_FOR_GROWTH = 1000;

export function rank(games: GameSummary[], key: RankingKey, limit = 50): GameSummary[] {
  const by = (f: (g: GameSummary) => number | null) =>
    games
      .filter((g) => f(g) !== null)
      .sort((a, b) => (f(b) as number) - (f(a) as number))
      .slice(0, limit);
  switch (key) {
    case "trending":
      return by((g) => ((g.stats.players ?? 0) >= MIN_PLAYERS_FOR_GROWTH ? g.growth.players24h : null));
    case "most-played":
      return by((g) => g.stats.players);
    case "most-visited":
      return by((g) => g.stats.visits);
    case "fastest-growing":
      return by((g) => ((g.stats.players ?? 0) >= MIN_PLAYERS_FOR_GROWTH ? g.growth.players7d : null));
    case "highest-revenue":
      return by((g) => (g.revenue.status === "ok" ? g.revenue.monthly.mid : null));
  }
}

export async function getRankings(limit = 50): Promise<{ source: DataSource; rankings: Record<RankingKey, GameSummary[]> }> {
  const { games, source } = await listGameSummaries();
  const keys = Object.keys(RANKINGS) as RankingKey[];
  return { source, rankings: Object.fromEntries(keys.map((k) => [k, rank(games, k, limit)])) as Record<RankingKey, GameSummary[]> };
}
