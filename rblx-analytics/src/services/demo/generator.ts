import { DEMO_REFERENCE_DATE, SEED_GAMES, type SeedGame } from "@/config/seed-games";
import type { GameMeta, GameStats, HistoryPoint, MonetizationSignals } from "@/types";

/**
 * DEMO MODE data generator.
 *
 * Every value is a pure, deterministic function of (game, timestamp), so the
 * "current" numbers and the history charts always agree and the dataset looks
 * alive without storing anything. Everything produced here is SYNTHETIC and
 * the UI labels it "DEMO DATA".
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function hash(n: number): number {
  // Deterministic 0..1 pseudo-random from an integer.
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

function seedOf(g: SeedGame): number {
  return Number(BigInt(g.placeId) % BigInt(2_147_483_647));
}

function noise(g: SeedGame, t: number): number {
  // Smooth hourly noise (linear interpolation between hourly random values).
  const s = seedOf(g);
  const h = t / HOUR;
  const i = Math.floor(h);
  const f = h - i;
  const a = hash(s + i) - 0.5;
  const b = hash(s + i + 1) - 0.5;
  return a + (b - a) * f;
}

const DIURNAL_AMPLITUDE = 0.32;
const SESSIONS_PER_PLAYER_HOUR = 1.35;

function diurnal(t: number): number {
  const hourUtc = (t % DAY) / HOUR;
  // Peak around 20:00 UTC (US afternoon / EU evening).
  return 1 + DIURNAL_AMPLITUDE * Math.cos((2 * Math.PI * (hourUtc - 20)) / 24);
}

function weekly(t: number): number {
  const dow = new Date(t).getUTCDay();
  return dow === 0 || dow === 6 ? 1.14 : dow === 5 ? 1.05 : 0.96;
}

function updateSpike(g: SeedGame, t: number): number {
  const period = g.demo.updateEvery * DAY;
  const phase = (hash(seedOf(g)) * period) | 0;
  const since = ((t - phase) % period + period) % period;
  return 1 + 0.22 * Math.exp(-since / (2.5 * DAY));
}

function trend(g: SeedGame, t: number): number {
  const days = (t - DEMO_REFERENCE_DATE) / DAY;
  // Bounded exponential trend + slow multi-week wave so long ranges look organic.
  const wave = 1 + 0.08 * Math.sin((2 * Math.PI * days) / (40 + (seedOf(g) % 30)));
  const clampedDays = Math.max(-365, Math.min(120, days));
  return Math.exp(g.demo.trend * clampedDays) * wave;
}

function launchRamp(g: SeedGame, t: number): number {
  const created = new Date(g.createdAt).getTime();
  if (t < created) return 0;
  const age = (t - created) / DAY;
  return age >= 30 ? 1 : Math.max(0.02, age / 30);
}

export function demoPlayersAt(g: SeedGame, t: number): number {
  const v = g.demo.ccu * trend(g, t) * diurnal(t) * weekly(t) * updateSpike(g, t) * launchRamp(g, t) * (1 + 0.08 * noise(g, t));
  return Math.max(0, Math.round(v));
}

/** Cumulative visits: the analytic integral of the diurnal curve keeps it monotonic. */
function dailyVisits(g: SeedGame): number {
  return g.demo.ccu * 24 * SESSIONS_PER_PLAYER_HOUR;
}

function cumulative(g: SeedGame, t: number, atReference: number, perDay: number): number {
  const days = (t - DEMO_REFERENCE_DATE) / DAY;
  const hourUtc = (t % DAY) / HOUR;
  const wiggle = (DIURNAL_AMPLITUDE / (2 * Math.PI)) * Math.sin((2 * Math.PI * (hourUtc - 20)) / 24);
  const value = atReference + perDay * (days + wiggle);
  const created = new Date(g.createdAt).getTime();
  return t < created ? 0 : Math.max(0, Math.round(value));
}

export function demoVisitsAt(g: SeedGame, t: number): number {
  return cumulative(g, t, g.demo.visits, dailyVisits(g));
}

export function demoFavoritesAt(g: SeedGame, t: number): number {
  const perDay = (dailyVisits(g) * g.demo.favorites) / g.demo.visits;
  return cumulative(g, t, g.demo.favorites, perDay * 1.1);
}

export function demoLikesAt(g: SeedGame, t: number): number {
  const perDay = (dailyVisits(g) * g.demo.likes) / g.demo.visits;
  return cumulative(g, t, g.demo.likes, perDay * 1.05);
}

export function demoDislikesAt(g: SeedGame, t: number): number {
  const perDay = (dailyVisits(g) * g.demo.dislikes) / g.demo.visits;
  return cumulative(g, t, g.demo.dislikes, perDay);
}

export function demoMeta(g: SeedGame): GameMeta {
  const updated = new Date(Date.now() - (hash(seedOf(g) + 7) * 6 + 0.5) * DAY);
  return {
    universeId: g.universeIdHint,
    placeId: g.placeId,
    name: g.name,
    description:
      "Demo profile. Descriptions, thumbnails and statistics are loaded from Roblox's public APIs when live data is enabled.",
    creator: { id: g.creator.id, name: g.creator.name, type: g.creator.type, hasVerifiedBadge: g.creator.verified },
    genre: g.genre,
    maxPlayers: g.demo.maxPlayers,
    createdAt: g.createdAt,
    updatedAt: new Date(Math.floor(updated.getTime() / HOUR) * HOUR).toISOString(),
    iconUrl: null,
    thumbnailUrl: null,
    isTracked: true,
  };
}

export function demoStats(g: SeedGame, t: number = Date.now()): GameStats {
  return {
    players: demoPlayersAt(g, t),
    visits: demoVisitsAt(g, t),
    favorites: demoFavoritesAt(g, t),
    likes: demoLikesAt(g, t),
    dislikes: demoDislikesAt(g, t),
    fetchedAt: new Date(t).toISOString(),
  };
}

export function demoMonetization(g: SeedGame): MonetizationSignals {
  const median = 99 + Math.round(hash(seedOf(g) + 3) * 6) * 100;
  return {
    gamePassCount: g.demo.gamePasses,
    gamePassMedianPrice: g.demo.gamePasses > 0 ? median : null,
    gamePassMaxPrice: g.demo.gamePasses > 0 ? median * 5 : null,
    fetchedAt: new Date(Math.floor(Date.now() / DAY) * DAY).toISOString(),
  };
}

/**
 * History with the same bucket semantics as the live store: players averaged
 * across the bucket, cumulative counters at bucket end.
 */
export function demoHistory(g: SeedGame, fromMs: number, toMs: number, bucketSeconds: number): HistoryPoint[] {
  const size = bucketSeconds * 1000;
  const samplesPerBucket = Math.max(1, Math.min(12, Math.round(size / (15 * 60_000))));
  const points: HistoryPoint[] = [];
  const start = Math.floor(fromMs / size) * size;
  for (let b = start; b <= toMs; b += size) {
    const end = Math.min(b + size, toMs);
    if (end <= b) break;
    let sum = 0;
    for (let i = 0; i < samplesPerBucket; i++) sum += demoPlayersAt(g, b + ((i + 0.5) * (end - b)) / samplesPerBucket);
    points.push({
      t: new Date(b).toISOString(),
      players: Math.round(sum / samplesPerBucket),
      visits: demoVisitsAt(g, end),
      favorites: demoFavoritesAt(g, end),
      likes: demoLikesAt(g, end),
    });
  }
  return points;
}

/** Peak over the last year (hourly resolution), cached per game per hour. */
const peakCache = new Map<number, { key: number; players: number; at: number }>();
export function demoPeak(g: SeedGame, now: number = Date.now()): { players: number; at: string; since: string } {
  const key = Math.floor(now / HOUR);
  const cached = peakCache.get(g.placeId);
  const since = Math.max(now - 365 * DAY, new Date(g.createdAt).getTime());
  if (!cached || cached.key !== key) {
    let best = 0;
    let at = now;
    for (let t = since; t <= now; t += HOUR) {
      const p = demoPlayersAt(g, t);
      if (p > best) {
        best = p;
        at = t;
      }
    }
    peakCache.set(g.placeId, { key, players: best, at });
  }
  const c = peakCache.get(g.placeId)!;
  return { players: c.players, at: new Date(c.at).toISOString(), since: new Date(since).toISOString() };
}

export function demoGames(): SeedGame[] {
  return SEED_GAMES;
}

export function findDemoGame(by: { placeId?: number; universeId?: number }): SeedGame | undefined {
  return SEED_GAMES.find((g) => g.placeId === by.placeId || g.universeIdHint === by.universeId);
}
