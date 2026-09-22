import "server-only";
import { SEED_GAMES } from "@/config/seed-games";
import { cache } from "@/lib/cache";
import { singleton } from "@/lib/singleton";
import { repo, type StoredGame } from "@/db";
import type { GameMeta, GameStats, MonetizationSignals } from "@/types";
import {
  fetchGamePasses,
  fetchGames,
  fetchIcons,
  fetchThumbnails,
  fetchVotes,
  resolveUniverseId,
} from "./roblox/client";
import type { RobloxGame } from "./roblox/schemas";
import { estimateRevenue } from "./revenue/estimator";

/** Stats older than this are refreshed on read (the cron keeps them fresher). */
export const STALE_AFTER_MS = 5 * 60_000;
/** Minimum spacing between two history rows for the same game. */
export const HISTORY_MIN_INTERVAL_MS = 4 * 60_000;

const inflight = singleton("live:inflight", () => new Map<string, Promise<unknown>>());

function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function toMeta(g: RobloxGame, tracked: boolean, media: { icon?: string; thumb?: string }, prev?: StoredGame | null): GameMeta {
  return {
    universeId: g.id,
    placeId: g.rootPlaceId,
    name: g.name,
    description: g.description ?? null,
    creator: { id: g.creator.id, name: g.creator.name, type: g.creator.type, hasVerifiedBadge: g.creator.hasVerifiedBadge },
    // Prefer the newer taxonomy (genre_l1) when Roblox provides it.
    genre: (g.genre_l1 && g.genre_l1 !== "All" ? g.genre_l1 : null) ?? (g.genre && g.genre !== "All" ? g.genre : null),
    maxPlayers: g.maxPlayers ?? null,
    createdAt: g.created ?? null,
    updatedAt: g.updated ?? null,
    iconUrl: media.icon ?? prev?.iconUrl ?? null,
    thumbnailUrl: media.thumb ?? prev?.thumbnailUrl ?? null,
    isTracked: tracked,
  };
}

/**
 * Fetches metadata + stats for the given universes from Roblox and persists a
 * snapshot. Two batched requests per 50 games (games + votes), plus media when
 * requested.
 */
export async function refreshLiveGames(
  universeIds: number[],
  opts: { withMedia?: boolean; track?: boolean; force?: boolean } = {},
): Promise<number> {
  if (universeIds.length === 0) return 0;
  const r = repo();
  const games = await fetchGames(universeIds);
  const votes = await fetchVotes(games.map((g) => g.id)).catch(() => new Map<number, { up: number; down: number }>());

  let icons = new Map<number, string>();
  let thumbs = new Map<number, string>();
  const needsMedia = opts.withMedia || (await Promise.all(games.map((g) => r.getGame({ universeId: g.id })))).some((p) => !p?.iconUrl);
  if (needsMedia) {
    icons = await fetchIcons(games.map((g) => g.id)).catch(() => icons);
    thumbs = await fetchThumbnails(games.map((g) => g.id)).catch(() => thumbs);
  }

  const fetchedAt = new Date().toISOString();
  const snapshots = [];
  for (const g of games) {
    const prev = await r.getGame({ universeId: g.id });
    await r.upsertGame(toMeta(g, opts.track ?? prev?.isTracked ?? false, { icon: icons.get(g.id), thumb: thumbs.get(g.id) }, prev));
    const v = votes.get(g.id);
    const stats: GameStats = {
      players: g.playing ?? null,
      visits: g.visits ?? null,
      favorites: g.favoritedCount ?? null,
      likes: v?.up ?? null,
      dislikes: v?.down ?? null,
      fetchedAt,
    };
    const quick = estimateRevenue({
      avgPlayers: stats.players,
      window: "current",
      genre: null,
      gamePassCount: null,
      historySamples: 0,
      coverageHours7d: 0,
      source: "live",
    });
    snapshots.push({
      universeId: g.id,
      stats,
      revenueDaily: quick.status === "ok" ? { low: quick.daily.low, high: quick.daily.high } : null,
    });
  }
  await r.saveSnapshots(snapshots, opts.force ? 0 : HISTORY_MIN_INTERVAL_MS);
  await r.markRefreshed(games.map((g) => g.id), null);
  const missing = universeIds.filter((id) => !games.some((g) => g.id === id));
  if (missing.length) await r.markRefreshed(missing, "Not returned by games.roblox.com (removed or private?)");
  cache.deletePrefix("live:");
  return games.length;
}

/**
 * First-run seeding of the default tracked list. Tries the universe ID hints in
 * one batched call and re-resolves any whose root place does not match.
 */
export async function ensureLiveSeeded(): Promise<void> {
  const r = repo();
  const existing = await r.listGames();
  if (existing.length > 0) return;
  await once("seed", async () => {
    const hinted = await fetchGames(SEED_GAMES.map((g) => g.universeIdHint));
    const ok = new Set(hinted.filter((h) => SEED_GAMES.some((s) => s.placeId === h.rootPlaceId)).map((h) => h.id));
    const ids = [...ok];
    for (const seed of SEED_GAMES) {
      if (hinted.some((h) => ok.has(h.id) && h.rootPlaceId === seed.placeId)) continue;
      const u = await resolveUniverseId(seed.placeId).catch(() => null);
      if (u) ids.push(u);
    }
    await refreshLiveGames(ids, { withMedia: true, track: true, force: true });
  });
}

/** Refreshes stale tracked games on read. Failures fall back to stored values. */
export async function refreshStale(games: StoredGame[], stats: Map<number, GameStats>): Promise<void> {
  const now = Date.now();
  const stale = games.filter((g) => {
    const s = stats.get(g.universeId);
    return !s || now - new Date(s.fetchedAt).getTime() > STALE_AFTER_MS;
  });
  if (stale.length === 0) return;
  await once(`stale:${stale.map((g) => g.universeId).sort().join(",")}`, () =>
    refreshLiveGames(stale.map((g) => g.universeId)),
  ).catch(() => undefined);
}

/** Finds or imports a game by place ID (or universe ID as a fallback). */
export async function importLiveGame(
  id: number,
  opts: { track?: boolean } = {},
): Promise<StoredGame | null> {
  const r = repo();
  const byPlace = await r.getGame({ placeId: id });
  if (byPlace) {
    if (opts.track && !byPlace.isTracked) await r.setTracked(byPlace.universeId, true);
    return { ...byPlace, isTracked: byPlace.isTracked || Boolean(opts.track) };
  }
  let universeId = await resolveUniverseId(id).catch(() => null);
  if (!universeId) {
    // Maybe the caller passed a universe ID.
    const direct = await fetchGames([id]).catch(() => []);
    if (direct.length === 0) return null;
    universeId = direct[0].id;
  }
  const byUniverse = await r.getGame({ universeId });
  if (byUniverse && !opts.track) return byUniverse;
  const n = await refreshLiveGames([universeId], { withMedia: true, track: opts.track ?? false, force: true });
  if (n === 0) return null;
  return r.getGame({ universeId });
}

/** Public game-pass signals, refreshed at most daily. */
export async function ensureMonetization(universeId: number, maxAgeMs = 24 * 3_600_000): Promise<MonetizationSignals | null> {
  const r = repo();
  const current = (await r.getMonetization([universeId])).get(universeId) ?? null;
  if (current && Date.now() - new Date(current.fetchedAt).getTime() < maxAgeMs) return current;
  try {
    const passes = await fetchGamePasses(universeId);
    const prices = passes
      .filter((p) => p.isForSale !== false && p.price !== null && p.price > 0)
      .map((p) => p.price as number)
      .sort((a, b) => a - b);
    const signals: MonetizationSignals = {
      gamePassCount: passes.length,
      gamePassMedianPrice: prices.length ? prices[Math.floor(prices.length / 2)] : null,
      gamePassMaxPrice: prices.length ? prices[prices.length - 1] : null,
      fetchedAt: new Date().toISOString(),
    };
    await r.saveMonetization(universeId, signals);
    return signals;
  } catch {
    return current;
  }
}
