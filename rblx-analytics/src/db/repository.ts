import type {
  ApiLogEntry,
  CurrencyRates,
  GameMeta,
  GameStats,
  HistoryPoint,
  MonetizationSignals,
  RefreshRun,
  RefreshTier,
  RevenueEstimate,
} from "@/types";

export interface StoredGame extends GameMeta {
  lastRefreshedAt: string | null;
  lastError: string | null;
}

export interface StoredDeveloper {
  id: string;
  type: "User" | "Group";
  robloxId: number;
  name: string;
  description: string | null;
  hasVerifiedBadge: boolean;
  memberCount: number | null;
  updatedAt: string;
}

export interface SnapshotInput {
  universeId: number;
  stats: GameStats;
  revenueDaily: { low: number; high: number } | null;
}

/**
 * Persistence for LIVE data. Demo data is generated on the fly and never stored.
 * Implementations: PostgresRepository (DATABASE_URL set) and MemoryRepository.
 */
export interface Repository {
  readonly kind: "postgres" | "memory";

  listGames(opts?: { trackedOnly?: boolean }): Promise<StoredGame[]>;
  getGame(by: { universeId?: number; placeId?: number }): Promise<StoredGame | null>;
  upsertGame(game: GameMeta): Promise<void>;
  setTracked(universeId: number, tracked: boolean): Promise<void>;
  deleteGame(universeId: number): Promise<void>;
  markRefreshed(universeIds: number[], error: string | null): Promise<void>;

  getLatestStats(universeIds: number[]): Promise<Map<number, GameStats>>;
  /** Upserts the latest snapshot and appends a history row when `minIntervalMs` elapsed. */
  saveSnapshots(rows: SnapshotInput[], minIntervalMs: number): Promise<number>;
  /** Bucketed history (avg players; last cumulative values per bucket). */
  getHistory(universeIds: number[], fromIso: string, toIso: string, bucketSeconds: number): Promise<Map<number, HistoryPoint[]>>;
  getPeaks(universeIds: number[]): Promise<Map<number, { players: number; at: string; since: string }>>;
  pruneHistory(olderThanIso: string): Promise<number>;

  saveMonetization(universeId: number, s: MonetizationSignals): Promise<void>;
  getMonetization(universeIds: number[]): Promise<Map<number, MonetizationSignals>>;

  saveRevenueEstimate(universeId: number, estimate: RevenueEstimate): Promise<void>;

  upsertDeveloper(dev: StoredDeveloper): Promise<void>;
  getDeveloper(id: string): Promise<StoredDeveloper | null>;

  saveCurrencyRates(rates: Pick<CurrencyRates, "rates" | "provider" | "fetchedAt">): Promise<void>;
  getLatestCurrencyRates(): Promise<Pick<CurrencyRates, "rates" | "provider" | "fetchedAt"> | null>;

  logApiError(entry: Omit<ApiLogEntry, "id">): Promise<void>;
  listApiErrors(limit: number): Promise<ApiLogEntry[]>;
  startRefreshRun(tier: RefreshTier): Promise<string>;
  finishRefreshRun(id: string, result: { ok: boolean; gamesProcessed: number; error: string | null }): Promise<void>;
  listRefreshRuns(limit: number): Promise<RefreshRun[]>;

  ping(): Promise<boolean>;
}
