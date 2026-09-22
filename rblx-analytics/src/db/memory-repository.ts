import type {
  ApiLogEntry,
  CurrencyRates,
  GameMeta,
  GameStats,
  HistoryPoint,
  MonetizationSignals,
  RefreshRun,
  RefreshTier,
} from "@/types";
import { bucketSamples, type RawSample } from "./bucket";
import type { Repository, SnapshotInput, StoredDeveloper, StoredGame } from "./repository";

const MAX_SAMPLES_PER_GAME = 20_000;

/**
 * Volatile repository used when DATABASE_URL is not configured.
 * Data lives only as long as the server process — good for local development
 * and demos, not for production history.
 */
export class MemoryRepository implements Repository {
  readonly kind = "memory" as const;
  private games = new Map<number, StoredGame>();
  private stats = new Map<number, GameStats>();
  private history = new Map<number, RawSample[]>();
  private monetization = new Map<number, MonetizationSignals>();
  private developers = new Map<string, StoredDeveloper>();
  private rates: Pick<CurrencyRates, "rates" | "provider" | "fetchedAt"> | null = null;
  private apiErrors: ApiLogEntry[] = [];
  private runs: RefreshRun[] = [];
  private seq = 0;

  async listGames(opts?: { trackedOnly?: boolean }) {
    const all = [...this.games.values()];
    return opts?.trackedOnly ? all.filter((g) => g.isTracked) : all;
  }

  async getGame(by: { universeId?: number; placeId?: number }) {
    if (by.universeId !== undefined) return this.games.get(by.universeId) ?? null;
    for (const g of this.games.values()) if (g.placeId === by.placeId) return g;
    return null;
  }

  async upsertGame(game: GameMeta) {
    const prev = this.games.get(game.universeId);
    this.games.set(game.universeId, {
      ...game,
      isTracked: prev ? prev.isTracked || game.isTracked : game.isTracked,
      lastRefreshedAt: prev?.lastRefreshedAt ?? null,
      lastError: prev?.lastError ?? null,
    });
  }

  async setTracked(universeId: number, tracked: boolean) {
    const g = this.games.get(universeId);
    if (g) g.isTracked = tracked;
  }

  async deleteGame(universeId: number) {
    this.games.delete(universeId);
    this.stats.delete(universeId);
    this.history.delete(universeId);
    this.monetization.delete(universeId);
  }

  async markRefreshed(universeIds: number[], error: string | null) {
    const now = new Date().toISOString();
    for (const id of universeIds) {
      const g = this.games.get(id);
      if (!g) continue;
      if (!error) g.lastRefreshedAt = now;
      g.lastError = error;
    }
  }

  async getLatestStats(universeIds: number[]) {
    const out = new Map<number, GameStats>();
    for (const id of universeIds) {
      const s = this.stats.get(id);
      if (s) out.set(id, s);
    }
    return out;
  }

  async saveSnapshots(rows: SnapshotInput[], minIntervalMs: number) {
    let inserted = 0;
    for (const { universeId, stats } of rows) {
      this.stats.set(universeId, stats);
      const t = new Date(stats.fetchedAt).getTime();
      const arr = this.history.get(universeId) ?? [];
      const last = arr[arr.length - 1];
      if (!last || t - last.t >= minIntervalMs) {
        arr.push({ t, players: stats.players, visits: stats.visits, favorites: stats.favorites, likes: stats.likes });
        if (arr.length > MAX_SAMPLES_PER_GAME) arr.splice(0, arr.length - MAX_SAMPLES_PER_GAME);
        this.history.set(universeId, arr);
        inserted += 1;
      }
    }
    return inserted;
  }

  async getHistory(universeIds: number[], fromIso: string, toIso: string, bucketSeconds: number) {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    const out = new Map<number, HistoryPoint[]>();
    for (const id of universeIds) {
      const samples = (this.history.get(id) ?? []).filter((s) => s.t >= from && s.t <= to);
      out.set(id, bucketSamples(samples, from, bucketSeconds));
    }
    return out;
  }

  async getPeaks(universeIds: number[]) {
    const out = new Map<number, { players: number; at: string; since: string }>();
    for (const id of universeIds) {
      const arr = this.history.get(id);
      if (!arr || arr.length === 0) continue;
      let best: RawSample | null = null;
      for (const s of arr) if (s.players !== null && (!best || s.players > (best.players ?? -1))) best = s;
      if (best) out.set(id, { players: best.players!, at: new Date(best.t).toISOString(), since: new Date(arr[0].t).toISOString() });
    }
    return out;
  }

  async pruneHistory(olderThanIso: string) {
    const cutoff = new Date(olderThanIso).getTime();
    let removed = 0;
    for (const [id, arr] of this.history) {
      const kept = arr.filter((s) => s.t >= cutoff);
      removed += arr.length - kept.length;
      this.history.set(id, kept);
    }
    return removed;
  }

  async saveMonetization(universeId: number, s: MonetizationSignals) {
    this.monetization.set(universeId, s);
  }

  async getMonetization(universeIds: number[]) {
    const out = new Map<number, MonetizationSignals>();
    for (const id of universeIds) {
      const m = this.monetization.get(id);
      if (m) out.set(id, m);
    }
    return out;
  }

  async saveRevenueEstimate(): Promise<void> {
    // Estimates are recomputed on read; the memory store keeps no audit trail.
  }

  async upsertDeveloper(dev: StoredDeveloper) {
    this.developers.set(dev.id, dev);
  }

  async getDeveloper(id: string) {
    return this.developers.get(id) ?? null;
  }

  async saveCurrencyRates(rates: Pick<CurrencyRates, "rates" | "provider" | "fetchedAt">) {
    this.rates = rates;
  }

  async getLatestCurrencyRates() {
    return this.rates;
  }

  async logApiError(entry: Omit<ApiLogEntry, "id">) {
    this.apiErrors.unshift({ ...entry, id: String(++this.seq) });
    if (this.apiErrors.length > 500) this.apiErrors.length = 500;
  }

  async listApiErrors(limit: number) {
    return this.apiErrors.slice(0, limit);
  }

  async startRefreshRun(tier: RefreshTier) {
    const id = String(++this.seq);
    this.runs.unshift({ id, tier, startedAt: new Date().toISOString(), finishedAt: null, ok: false, gamesProcessed: 0, error: null });
    if (this.runs.length > 200) this.runs.length = 200;
    return id;
  }

  async finishRefreshRun(id: string, result: { ok: boolean; gamesProcessed: number; error: string | null }) {
    const run = this.runs.find((r) => r.id === id);
    if (run) Object.assign(run, result, { finishedAt: new Date().toISOString() });
  }

  async listRefreshRuns(limit: number) {
    return this.runs.slice(0, limit);
  }

  async ping() {
    return true;
  }
}
