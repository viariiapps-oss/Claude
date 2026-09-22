/**
 * End-to-end test of the LIVE data path with Roblox's HTTP API mocked:
 * seeding → snapshot storage → history → detail → search → revenue.
 *
 * Runs against the in-memory repository by default, and against PostgreSQL
 * when TEST_DATABASE_URL is set (e.g. postgres://user:pass@localhost/rblx_test).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const PLACE = 920587237;
const UNIVERSE = 383310974;

let playing = 200_000;
const calls: string[] = [];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function mockRoblox(url: string): Response {
  calls.push(url);
  const u = new URL(url);
  if (u.hostname === "games.roblox.com" && u.pathname === "/v1/games") {
    const ids = (u.searchParams.get("universeIds") ?? "").split(",").map(Number);
    return json({
      data: ids
        .filter((id) => id === UNIVERSE)
        .map((id) => ({
          id,
          rootPlaceId: PLACE,
          name: "Adopt Me!",
          description: "Test description",
          creator: { id: 295182, name: "Uplift Games", type: "Group", isRNVAccount: false, hasVerifiedBadge: true },
          price: null,
          playing,
          visits: 41_000_000_000,
          maxPlayers: 48,
          created: "2017-07-14T00:00:00Z",
          updated: "2026-09-20T00:00:00Z",
          genre: "Town and City",
          genre_l1: "Roleplay & Avatar Sim",
          favoritedCount: 26_000_000,
        })),
    });
  }
  if (u.pathname === "/v1/games/votes") return json({ data: [{ id: UNIVERSE, upVotes: 4_500_000, downVotes: 900_000 }] });
  if (u.pathname.startsWith("/universes/v1/places/")) {
    return u.pathname.includes(String(PLACE)) ? json({ universeId: UNIVERSE }) : json({ universeId: null });
  }
  if (u.hostname === "thumbnails.roblox.com") {
    return u.pathname.includes("icons")
      ? json({ data: [{ targetId: UNIVERSE, state: "Completed", imageUrl: "https://tr.rbxcdn.com/icon.png" }] })
      : json({ data: [{ universeId: UNIVERSE, thumbnails: [{ state: "Completed", imageUrl: "https://tr.rbxcdn.com/thumb.png" }] }] });
  }
  if (u.pathname.includes("/game-passes")) {
    return json({ gamePasses: [{ id: 1, name: "VIP", price: 499, isForSale: true }, { id: 2, name: "Pet", price: 199, isForSale: true }], nextPageToken: null });
  }
  if (u.pathname.includes("omni-search")) {
    return json({ searchResults: [{ contentGroupType: "Game", contents: [{ universeId: UNIVERSE, rootPlaceId: PLACE, name: "Adopt Me!", playerCount: playing, creatorName: "Uplift Games" }] }] });
  }
  // Exchange-rate providers
  if (u.hostname === "api.frankfurter.dev") return json({ amount: 1, base: "USD", date: "2026-09-22", rates: { EUR: 0.9, GBP: 0.8, JPY: 150 } });
  return json({ errors: [{ message: "not mocked" }] }, 404);
}

type Services = {
  games: typeof import("@/services/games.service");
  live: typeof import("@/services/live.service");
  repo: typeof import("@/db");
  currency: typeof import("@/services/currency/currency.service");
};
let s: Services;

beforeAll(async () => {
  vi.stubEnv("DATA_MODE", "live");
  vi.stubEnv("ROBLOX_MAX_RPS", "50");
  if (process.env.TEST_DATABASE_URL) {
    vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL);
    vi.stubEnv("DATABASE_SSL", "false");
  } else {
    vi.stubEnv("DATABASE_URL", "");
  }
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => mockRoblox(String(input))));
  (globalThis as { __rblx?: unknown }).__rblx = undefined;
  s = {
    games: await import("@/services/games.service"),
    live: await import("@/services/live.service"),
    repo: await import("@/db"),
    currency: await import("@/services/currency/currency.service"),
  };
  // Clean slate for Postgres runs.
  const r = s.repo.repo();
  for (const g of await r.listGames()) await r.deleteGame(g.universeId);
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("live pipeline (mocked Roblox)", () => {
  it("imports a game by place ID and stores a snapshot", async () => {
    const game = await s.live.importLiveGame(PLACE, { track: true });
    expect(game).not.toBeNull();
    expect(game!.universeId).toBe(UNIVERSE);
    expect(game!.genre).toBe("Roleplay & Avatar Sim");
    expect(game!.iconUrl).toContain("rbxcdn");
    const stats = (await s.repo.repo().getLatestStats([UNIVERSE])).get(UNIVERSE);
    expect(stats).toMatchObject({ players: 200_000, visits: 41_000_000_000, favorites: 26_000_000, likes: 4_500_000, dislikes: 900_000 });
  });

  it("serves detail with live source, like ratio, peak and monetization signals", async () => {
    const r = await s.games.getGameDetail(PLACE);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.game.source).toBe("live");
    expect(r.game.likeRatio).toBeCloseTo(4.5 / 5.4, 5);
    expect(r.game.peak.peakPlayers).toBe(200_000);
    expect(r.game.monetization?.gamePassCount).toBe(2);
    expect(r.game.monetization?.gamePassMedianPrice).toBe(499);
    // One snapshot → estimate uses the current reading with low confidence.
    expect(r.game.revenue.status).toBe("ok");
    if (r.game.revenue.status === "ok") {
      expect(r.game.revenue.inputs.avgPlayersWindow).toBe("current");
      expect(r.game.revenue.confidence).not.toBe("high");
    }
  });

  it("redirects universe IDs to the canonical place ID", async () => {
    const r = await s.games.getGameDetail(UNIVERSE);
    expect(r).toEqual({ status: "redirect", placeId: PLACE });
  });

  it("accumulates history across refreshes and respects the minimum interval", async () => {
    playing = 250_000;
    await s.live.refreshLiveGames([UNIVERSE], { force: true });
    await s.live.refreshLiveGames([UNIVERSE]); // within min interval → no new history row
    const h = await s.games.getGameHistory(PLACE, "24h");
    expect(h?.source).toBe("live");
    const players = h!.points.map((p) => p.players);
    // Both samples fall into the same 15-minute bucket → averaged.
    expect(players.at(-1)).toBe(225_000);
    const peaks = await s.repo.repo().getPeaks([UNIVERSE]);
    expect(peaks.get(UNIVERSE)?.players).toBe(250_000);
  });

  it("reports missing games honestly", async () => {
    const r = await s.games.getGameDetail(111);
    expect(r.status).toBe("not-found");
  });

  it("searches by URL, id and name (including Roblox omni-search)", async () => {
    const byUrl = await s.games.searchGames(`https://www.roblox.com/games/${PLACE}/Adopt-Me`);
    expect(byUrl.results[0]).toMatchObject({ placeId: PLACE, matchedBy: "url" });
    const byName = await s.games.searchGames("adopt");
    expect(byName.results[0]?.placeId).toBe(PLACE);
  });

  it("fetches exchange rates from a provider and marks them live", async () => {
    const rates = await s.currency.getCurrencyRates({ force: true });
    expect(rates.status).toBe("live");
    expect(rates.rates.EUR).toBe(0.9);
    expect(rates.rates.USD).toBe(1);
  });

  it("only called documented Roblox hosts", () => {
    const hosts = new Set(calls.map((c) => new URL(c).hostname));
    for (const h of hosts) expect(["games.roblox.com", "apis.roblox.com", "thumbnails.roblox.com", "api.frankfurter.dev"]).toContain(h);
  });
});
