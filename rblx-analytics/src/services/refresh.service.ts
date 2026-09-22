import "server-only";
import { singleton } from "@/lib/singleton";
import { cache } from "@/lib/cache";
import { repo } from "@/db";
import type { RefreshTier } from "@/types";
import { getCurrencyRates } from "./currency/currency.service";
import { getDataStatus } from "./data-status";
import { listGameSummaries } from "./games.service";
import { ensureLiveSeeded, ensureMonetization, refreshLiveGames } from "./live.service";

/**
 * Scheduled refresh tiers (triggered by Vercel Cron, the `npm run worker`
 * loop, or the admin panel):
 *
 *  realtime (every 5 min)  players, visits, favorites, votes — 2 batched calls per 50 games
 *  hourly                  + icons/thumbnails, + revenue estimates written to revenue_estimates
 *  daily                   + game-pass monetization signals, FX rates, history compaction
 *
 * An in-process lock prevents overlapping runs of the same tier.
 */

const running = singleton("refresh:running", () => new Set<RefreshTier>());

export interface RefreshResult {
  tier: RefreshTier;
  ok: boolean;
  skipped?: string;
  gamesProcessed: number;
  details: string[];
  error: string | null;
}

export async function runRefresh(tier: RefreshTier): Promise<RefreshResult> {
  if (running.has(tier)) {
    return { tier, ok: true, skipped: "A run of this tier is already in progress.", gamesProcessed: 0, details: [], error: null };
  }
  running.add(tier);
  const r = repo();
  const runId = await r.startRefreshRun(tier).catch(() => null);
  const details: string[] = [];
  let processed = 0;
  let error: string | null = null;

  try {
    const status = await getDataStatus();
    if (tier === "daily") {
      const fx = await getCurrencyRates({ force: true });
      details.push(`FX rates: ${fx.status} (${fx.provider})`);
    }

    if (status.activeSource === "demo") {
      details.push("Demo mode active — no Roblox data to refresh.");
    } else {
      await ensureLiveSeeded();
      const tracked = await r.listGames({ trackedOnly: true });
      const ids = tracked.map((g) => g.universeId);
      processed = await refreshLiveGames(ids, { withMedia: tier !== "realtime" });
      details.push(`Refreshed ${processed}/${ids.length} tracked games.`);

      if (tier === "daily") {
        let n = 0;
        for (const g of tracked) {
          if (await ensureMonetization(g.universeId, 0)) n++;
        }
        details.push(`Monetization signals updated for ${n} games.`);
        const compacted = await r.pruneHistory(new Date(Date.now() - 30 * 24 * 3_600_000).toISOString());
        details.push(`History compaction: ${compacted} rows thinned to hourly resolution.`);
      }

      if (tier !== "realtime") {
        cache.deletePrefix("live:");
        const { games } = await listGameSummaries();
        for (const g of games) await r.saveRevenueEstimate(g.meta.universeId, g.revenue);
        details.push(`Saved ${games.length} revenue estimates.`);
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  } finally {
    running.delete(tier);
  }

  if (runId) await r.finishRefreshRun(runId, { ok: error === null, gamesProcessed: processed, error }).catch(() => undefined);
  return { tier, ok: error === null, gamesProcessed: processed, details, error };
}
