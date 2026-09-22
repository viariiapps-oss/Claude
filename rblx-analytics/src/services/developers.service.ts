import "server-only";
import { cache } from "@/lib/cache";
import { repo } from "@/db";
import type { DataSource, DeveloperDetail, DeveloperGame, DeveloperSummary, GameSummary, MoneyRange } from "@/types";
import { developerId, parseDeveloperId } from "@/utils/ids";
import { listGameSummaries } from "./games.service";
import { fetchCreatorGames, fetchGames, fetchGroup, fetchUser } from "./roblox/client";

function sumMoney(ranges: MoneyRange[]): MoneyRange | null {
  if (!ranges.length) return null;
  return ranges.reduce((a, r) => ({ low: a.low + r.low, mid: a.mid + r.mid, high: a.high + r.high }), { low: 0, mid: 0, high: 0 });
}

function summarize(id: string, games: GameSummary[]): DeveloperSummary {
  const c = games[0].meta.creator;
  const players = games.reduce((a, g) => a + (g.stats.players ?? 0), 0);
  const weighted = games.filter((g) => g.growth.players7d !== null && (g.stats.players ?? 0) > 0);
  const wSum = weighted.reduce((a, g) => a + (g.stats.players ?? 0), 0);
  const top = [...games].sort((a, b) => (b.stats.players ?? 0) - (a.stats.players ?? 0))[0];
  return {
    id,
    robloxId: c.id,
    type: c.type,
    name: c.name,
    hasVerifiedBadge: c.hasVerifiedBadge,
    gameCount: games.length,
    totalVisits: games.some((g) => g.stats.visits !== null) ? games.reduce((a, g) => a + (g.stats.visits ?? 0), 0) : null,
    totalPlayers: games.some((g) => g.stats.players !== null) ? players : null,
    estimatedMonthlyRevenue: sumMoney(games.flatMap((g) => (g.revenue.status === "ok" ? [g.revenue.monthly] : []))),
    growth7d: wSum > 0 ? weighted.reduce((a, g) => a + (g.growth.players7d as number) * (g.stats.players ?? 0), 0) / wSum : null,
    topGame: top ? { placeId: top.meta.placeId, name: top.meta.name } : null,
  };
}

/** Developers derived from tracked games (plus direct ID lookup in live mode). */
export async function listDevelopers(query?: string): Promise<{ developers: DeveloperSummary[]; source: DataSource }> {
  const { games, source } = await listGameSummaries();
  const groups = new Map<string, GameSummary[]>();
  for (const g of games) {
    const id = developerId(g.meta.creator.type, g.meta.creator.id);
    groups.set(id, [...(groups.get(id) ?? []), g]);
  }
  let developers = [...groups.entries()].map(([id, gs]) => summarize(id, gs));
  const q = query?.trim().toLowerCase();
  if (q) {
    developers = developers.filter(
      (d) => d.name.toLowerCase().includes(q) || String(d.robloxId) === q || d.id === q,
    );
  }
  developers.sort((a, b) => (b.totalPlayers ?? 0) - (a.totalPlayers ?? 0));
  return { developers, source };
}

export async function getDeveloper(id: string): Promise<DeveloperDetail | null> {
  const parsed = parseDeveloperId(id);
  if (!parsed) return null;
  const { games, source } = await listGameSummaries();
  const tracked = games.filter((g) => g.meta.creator.type === parsed.type && g.meta.creator.id === parsed.robloxId);

  if (source === "demo") {
    if (tracked.length === 0) return null;
    return {
      ...summarize(id, tracked),
      description: null,
      memberCount: null,
      games: tracked.map((g) => ({
        placeId: g.meta.placeId,
        universeId: g.meta.universeId,
        name: g.meta.name,
        visits: g.stats.visits,
        players: g.stats.players,
        isTracked: true,
      })),
      trackedGames: tracked,
      source,
    };
  }

  return cache.wrap(`live:developer:${id}`, 5 * 60_000, async () => {
    const profile =
      parsed.type === "Group" ? await fetchGroup(parsed.robloxId).catch(() => null) : await fetchUser(parsed.robloxId).catch(() => null);
    if (!profile && tracked.length === 0) return null;

    const list = await fetchCreatorGames(parsed.type, parsed.robloxId).catch(() => []);
    const live = await fetchGames(list.map((g) => g.universeId)).catch(() => []);
    const liveById = new Map(live.map((g) => [g.id, g]));
    const devGames: DeveloperGame[] = list
      .filter((g) => g.placeId !== null)
      .map((g) => ({
        placeId: g.placeId!,
        universeId: g.universeId,
        name: g.name,
        visits: liveById.get(g.universeId)?.visits ?? g.visits,
        players: liveById.get(g.universeId)?.playing ?? null,
        isTracked: tracked.some((t) => t.meta.universeId === g.universeId),
      }))
      .sort((a, b) => (b.players ?? 0) - (a.players ?? 0));

    const name = profile?.name ?? tracked[0]?.meta.creator.name ?? `Creator ${parsed.robloxId}`;
    const hasVerifiedBadge = profile?.hasVerifiedBadge ?? tracked[0]?.meta.creator.hasVerifiedBadge ?? false;
    const base: DeveloperSummary = tracked.length
      ? summarize(id, tracked)
      : {
          id,
          robloxId: parsed.robloxId,
          type: parsed.type,
          name,
          hasVerifiedBadge,
          gameCount: 0,
          totalVisits: null,
          totalPlayers: null,
          estimatedMonthlyRevenue: null,
          growth7d: null,
          topGame: null,
        };

    const memberCount = profile && "memberCount" in profile ? (profile.memberCount ?? null) : null;
    await repo()
      .upsertDeveloper({
        id,
        type: parsed.type,
        robloxId: parsed.robloxId,
        name,
        description: profile?.description ?? null,
        hasVerifiedBadge,
        memberCount,
        updatedAt: new Date().toISOString(),
      })
      .catch(() => undefined);

    return {
      ...base,
      name,
      hasVerifiedBadge,
      gameCount: Math.max(base.gameCount, devGames.length),
      totalVisits: devGames.length ? devGames.reduce((a, g) => a + (g.visits ?? 0), 0) : base.totalVisits,
      totalPlayers: devGames.length ? devGames.reduce((a, g) => a + (g.players ?? 0), 0) : base.totalPlayers,
      topGame: devGames[0] ? { placeId: devGames[0].placeId, name: devGames[0].name } : base.topGame,
      description: profile?.description ?? null,
      memberCount,
      games: devGames,
      trackedGames: tracked,
      source,
    } satisfies DeveloperDetail;
  });
}
