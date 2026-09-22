import "server-only";
import type { z } from "zod";
import { env } from "@/config/env";
import { TokenBucket } from "@/lib/rate-limit";
import { singleton } from "@/lib/singleton";
import { repo } from "@/db";
import {
  creatorGamesResponseSchema,
  gamePassesResponseSchema,
  gamesResponseSchema,
  groupSchema,
  iconsResponseSchema,
  omniSearchSchema,
  placeToUniverseSchema,
  thumbnailsResponseSchema,
  userSchema,
  votesResponseSchema,
  type RobloxGame,
} from "./schemas";

/**
 * Thin client over Roblox's PUBLIC web APIs (no authentication required):
 *
 *  games.roblox.com       /v1/games, /v1/games/votes, /v2/groups/{id}/games, /v2/users/{id}/games
 *  apis.roblox.com        /universes/v1/places/{placeId}/universe
 *                         /game-passes/v1/universes/{universeId}/game-passes
 *                         /search-api/omni-search  (undocumented; optional)
 *  thumbnails.roblox.com  /v1/games/icons, /v1/games/multiget/thumbnails
 *  groups.roblox.com      /v1/groups/{groupId}
 *  users.roblox.com       /v1/users/{userId}
 *
 * All calls go through one token bucket, a timeout, a retry for 429/5xx and a
 * circuit breaker, and failures are written to the api_logs table.
 */

export class RobloxApiError extends Error {
  constructor(
    message: string,
    public status: number | null,
    public endpoint: string,
  ) {
    super(message);
    this.name = "RobloxApiError";
  }
}

interface Health {
  consecutiveFailures: number;
  openUntil: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

const health = singleton<Health>("roblox:health", () => ({
  consecutiveFailures: 0,
  openUntil: 0,
  lastSuccessAt: null,
  lastError: null,
  lastErrorAt: null,
}));

const bucket = singleton("roblox:bucket", () => new TokenBucket(env().ROBLOX_MAX_RPS, env().ROBLOX_MAX_RPS * 2));

const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60_000;

export function robloxHealth() {
  return {
    ...health,
    circuitOpen: health.openUntil > Date.now(),
    apiKeyConfigured: Boolean(env().ROBLOX_API_KEY),
  };
}

export function isRobloxCircuitOpen(): boolean {
  return health.openUntil > Date.now();
}

function recordFailure(endpoint: string, status: number | null, message: string, countsForBreaker: boolean) {
  health.lastError = message;
  health.lastErrorAt = new Date().toISOString();
  if (countsForBreaker) {
    health.consecutiveFailures += 1;
    if (health.consecutiveFailures >= BREAKER_THRESHOLD) health.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
  void repo()
    .logApiError({ service: "roblox", endpoint, status, message, occurredAt: new Date().toISOString() })
    .catch(() => undefined);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function robloxFetch<S extends z.ZodType>(url: string, schema: S, opts: { allow404?: boolean } = {}): Promise<z.output<S> | null> {
  const endpoint = url.replace(/\?.*$/, "").replace(/\d{3,}/g, "{id}");
  if (isRobloxCircuitOpen()) {
    throw new RobloxApiError("Roblox API temporarily unavailable (circuit open)", null, endpoint);
  }
  let attempt = 0;
  for (;;) {
    attempt += 1;
    await bucket.take();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "RBLX-Analytics/1.0 (+https://github.com)" },
        signal: AbortSignal.timeout(env().ROBLOX_TIMEOUT_MS),
        // ISR-compatible short-lived caching. `cache: "no-store"` would make Next abort
        // static/ISR renders, which this function would then misreport as an outage.
        next: { revalidate: 30 },
      });
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : "Network error";
      recordFailure(endpoint, null, msg, true);
      throw new RobloxApiError(msg, null, endpoint);
    }

    if (res.status === 404 && opts.allow404) return null;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 500 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      const msg = `HTTP ${res.status} ${res.statusText}`;
      recordFailure(endpoint, res.status, msg, res.status === 429 || res.status >= 500);
      throw new RobloxApiError(msg, res.status, endpoint);
    }

    const json: unknown = await res.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const msg = `Unexpected response shape: ${parsed.error.issues[0]?.message ?? "invalid"}`;
      recordFailure(endpoint, res.status, msg, false);
      throw new RobloxApiError(msg, res.status, endpoint);
    }
    health.consecutiveFailures = 0;
    health.openUntil = 0;
    health.lastSuccessAt = new Date().toISOString();
    return parsed.data;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Games ─────────────────────────────────────────────────────────────────────

export async function fetchGames(universeIds: number[]): Promise<RobloxGame[]> {
  const out: RobloxGame[] = [];
  for (const ids of chunk([...new Set(universeIds)], 50)) {
    const r = await robloxFetch(`https://games.roblox.com/v1/games?universeIds=${ids.join(",")}`, gamesResponseSchema);
    if (r) out.push(...r.data);
  }
  return out;
}

export async function fetchVotes(universeIds: number[]): Promise<Map<number, { up: number; down: number }>> {
  const out = new Map<number, { up: number; down: number }>();
  for (const ids of chunk([...new Set(universeIds)], 50)) {
    const r = await robloxFetch(`https://games.roblox.com/v1/games/votes?universeIds=${ids.join(",")}`, votesResponseSchema);
    for (const v of r?.data ?? []) out.set(v.id, { up: v.upVotes, down: v.downVotes });
  }
  return out;
}

export async function resolveUniverseId(placeId: number): Promise<number | null> {
  const r = await robloxFetch(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    placeToUniverseSchema,
    { allow404: true },
  );
  return r?.universeId ?? null;
}

export async function fetchIcons(universeIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const ids of chunk([...new Set(universeIds)], 100)) {
    const r = await robloxFetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids.join(",")}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`,
      iconsResponseSchema,
    );
    for (const i of r?.data ?? []) if (i.state === "Completed" && i.imageUrl) out.set(i.targetId, i.imageUrl);
  }
  return out;
}

export async function fetchThumbnails(universeIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const ids of chunk([...new Set(universeIds)], 50)) {
    const r = await robloxFetch(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${ids.join(",")}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`,
      thumbnailsResponseSchema,
    );
    for (const t of r?.data ?? []) {
      const first = t.thumbnails.find((x) => x.state === "Completed" && x.imageUrl);
      if (first?.imageUrl) out.set(t.universeId, first.imageUrl);
    }
  }
  return out;
}

export async function fetchGamePasses(universeId: number): Promise<{ price: number | null; isForSale: boolean | null }[]> {
  const passes: { price: number | null; isForSale: boolean | null }[] = [];
  let token: string | null = null;
  for (let page = 0; page < 5; page++) {
    const url: string =
      `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes?passView=Full&pageSize=100` +
      (token ? `&pageToken=${encodeURIComponent(token)}` : "");
    const r = await robloxFetch(url, gamePassesResponseSchema, { allow404: true });
    if (!r) break;
    passes.push(...r.passes.map((p) => ({ price: p.price, isForSale: p.isForSale })));
    token = r.nextPageToken;
    if (!token) break;
  }
  return passes;
}

// ─── Creators ──────────────────────────────────────────────────────────────────

export async function fetchGroup(groupId: number) {
  return robloxFetch(`https://groups.roblox.com/v1/groups/${groupId}`, groupSchema, { allow404: true });
}

export async function fetchUser(userId: number) {
  return robloxFetch(`https://users.roblox.com/v1/users/${userId}`, userSchema, { allow404: true });
}

export async function fetchCreatorGames(type: "User" | "Group", id: number) {
  const base = type === "Group" ? `https://games.roblox.com/v2/groups/${id}/games` : `https://games.roblox.com/v2/users/${id}/games`;
  const out: { universeId: number; placeId: number | null; name: string; visits: number | null }[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 4; page++) {
    const url: string = `${base}?accessFilter=2&limit=50&sortOrder=Desc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const r = await robloxFetch(url, creatorGamesResponseSchema, { allow404: true });
    if (!r) break;
    for (const g of r.data) out.push({ universeId: g.id, placeId: g.rootPlace?.id ?? null, name: g.name, visits: g.placeVisits ?? null });
    cursor = r.nextPageCursor ?? null;
    if (!cursor) break;
  }
  return out;
}

// ─── Search ────────────────────────────────────────────────────────────────────

export async function omniSearch(query: string) {
  if (!env().ROBLOX_ENABLE_OMNI_SEARCH) return [];
  // Stable per process so identical searches hit the fetch cache.
  const sessionId = singleton("roblox:search-session", () => crypto.randomUUID());
  const r = await robloxFetch(
    `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(query)}&sessionId=${sessionId}&pageType=all`,
    omniSearchSchema,
  );
  const games = (r?.searchResults ?? []).filter((g) => !g.contentGroupType || g.contentGroupType === "Game");
  return games
    .flatMap((g) => g.contents)
    .filter((c) => c.universeId && c.rootPlaceId && c.name)
    .map((c) => ({
      universeId: c.universeId!,
      placeId: c.rootPlaceId!,
      name: c.name!,
      players: c.playerCount ?? null,
      creatorName: c.creatorName ?? null,
    }));
}

/** Lightweight connectivity probe used for DATA_MODE=auto and the admin status page. */
export async function probeRoblox(): Promise<{ ok: boolean; latencyMs: number | null; error: string | null }> {
  const started = Date.now();
  try {
    await fetchGames([383310974]);
    return { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (e) {
    return { ok: false, latencyMs: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
