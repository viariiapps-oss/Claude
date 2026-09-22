import { z } from "zod";
import type { GameSummary } from "@/types";

/** Shared (client + server) schema for game explorer filters, used by /games and /api/games. */

export const SORT_OPTIONS = [
  { value: "players", label: "Most players" },
  { value: "visits", label: "Most visits" },
  { value: "growth", label: "Fastest growing" },
  { value: "revenue", label: "Highest estimated revenue" },
  { value: "likes", label: "Most liked" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

const num = z.coerce.number().finite().nonnegative().optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional();

export const explorerSchema = z.object({
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(50).optional(),
  minPlayers: num,
  maxPlayers: num,
  minVisits: num,
  minRevenue: num,
  minGrowth: z.coerce.number().finite().min(-100).max(10_000).optional(),
  createdAfter: date,
  updatedAfter: date,
  sort: z.enum(["players", "visits", "growth", "revenue", "likes"]).default("players"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ExplorerParams = z.infer<typeof explorerSchema>;

function sortValue(g: GameSummary, key: SortKey): number | null {
  switch (key) {
    case "players":
      return g.stats.players;
    case "visits":
      return g.stats.visits;
    case "growth":
      return g.growth.players7d ?? g.growth.players24h;
    case "revenue":
      return g.revenue.status === "ok" ? g.revenue.monthly.mid : null;
    case "likes":
      return g.stats.likes;
  }
}

export function applyExplorer(games: GameSummary[], p: ExplorerParams) {
  const q = p.q?.toLowerCase();
  const filtered = games.filter((g) => {
    if (q) {
      const hay = [g.meta.name, g.meta.creator.name, String(g.meta.placeId), String(g.meta.universeId), String(g.meta.creator.id)]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (p.genre && g.meta.genre !== p.genre) return false;
    if (p.minPlayers !== undefined && (g.stats.players ?? -1) < p.minPlayers) return false;
    if (p.maxPlayers !== undefined && (g.stats.players ?? Infinity) > p.maxPlayers) return false;
    if (p.minVisits !== undefined && (g.stats.visits ?? -1) < p.minVisits) return false;
    if (p.minRevenue !== undefined && (g.revenue.status !== "ok" || g.revenue.monthly.mid < p.minRevenue)) return false;
    if (p.minGrowth !== undefined && ((g.growth.players7d ?? g.growth.players24h ?? -Infinity) < p.minGrowth)) return false;
    if (p.createdAfter && (!g.meta.createdAt || g.meta.createdAt.slice(0, 10) < p.createdAfter)) return false;
    if (p.updatedAfter && (!g.meta.updatedAt || g.meta.updatedAt.slice(0, 10) < p.updatedAfter)) return false;
    return true;
  });
  const dir = p.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    const va = sortValue(a, p.sort);
    const vb = sortValue(b, p.sort);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // unavailable values always last
    if (vb === null) return -1;
    return (va - vb) * dir;
  });
  const total = filtered.length;
  const start = (p.page - 1) * p.pageSize;
  return { total, page: p.page, pageSize: p.pageSize, games: filtered.slice(start, start + p.pageSize) };
}

export function genresOf(games: GameSummary[]): string[] {
  return [...new Set(games.map((g) => g.meta.genre).filter((g): g is string => Boolean(g)))].sort();
}
