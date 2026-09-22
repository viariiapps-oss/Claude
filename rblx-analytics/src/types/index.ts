/**
 * Shared domain types for RBLX Analytics.
 *
 * Conventions:
 * - `placeId` is the root place ID shown in roblox.com URLs (roblox.com/games/{placeId}).
 *   It is the public "Roblox Game ID" and the canonical identifier used in our routes.
 * - `universeId` is the experience ID that Roblox's games/thumbnails APIs key on.
 * - `null` always means "not available" — never zero-filled.
 */

export type DataSource = "live" | "demo";
export type DataMode = "auto" | "live" | "demo";
export type CreatorType = "User" | "Group";
export type Confidence = "low" | "medium" | "high";

export interface Creator {
  id: number;
  name: string;
  type: CreatorType;
  hasVerifiedBadge: boolean;
}

export interface GameMeta {
  universeId: number;
  placeId: number;
  name: string;
  description: string | null;
  creator: Creator;
  genre: string | null;
  maxPlayers: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  isTracked: boolean;
}

export interface GameStats {
  players: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
  dislikes: number | null;
  fetchedAt: string;
}

export interface GrowthMetrics {
  /** % change of average concurrent players, last 24h vs previous 24h. */
  players24h: number | null;
  /** % change of average concurrent players, last 7d vs previous 7d. */
  players7d: number | null;
  /** Visits gained during the last 24h / 7d (absolute). */
  visitsGained24h: number | null;
  visitsGained7d: number | null;
  /** % change of cumulative visits over 7d. */
  visits7d: number | null;
  /** % change of favorites over 7d. */
  favorites7d: number | null;
}

export interface PeakMetrics {
  peakPlayers: number | null;
  peakAt: string | null;
  /** First sample we hold for this game — peak is only valid since then. */
  trackedSince: string | null;
}

export interface MonetizationSignals {
  gamePassCount: number;
  gamePassMedianPrice: number | null;
  gamePassMaxPrice: number | null;
  fetchedAt: string;
}

export interface MoneyRange {
  low: number;
  mid: number;
  high: number;
}

export interface RevenueInputs {
  avgPlayers: number;
  avgPlayersWindow: "7d" | "24h" | "current";
  engagementHoursPerDay: number;
  baseUsdPerHour: number;
  genre: string | null;
  genreFactor: number;
  monetizationFactor: number;
  devexAdjustment: number;
  historySamples: number;
  historyCoverageHours: number;
  hasMonetizationSignals: boolean;
  gamePassCount: number | null;
  source: DataSource;
}

export type RevenueEstimate =
  | {
      status: "ok";
      currency: "USD";
      daily: MoneyRange;
      weekly: MoneyRange;
      monthly: MoneyRange;
      yearly: MoneyRange;
      confidence: Confidence;
      confidenceScore: number;
      confidenceReasons: string[];
      inputs: RevenueInputs;
      modelVersion: string;
      computedAt: string;
    }
  | {
      status: "insufficient";
      reason: string;
      modelVersion: string;
      computedAt: string;
    };

export interface GameAggregates {
  avgPlayers24h: number | null;
  avgPlayersPrev24h: number | null;
  avgPlayers7d: number | null;
  avgPlayersPrev7d: number | null;
  visits24hAgo: number | null;
  visits7dAgo: number | null;
  favorites7dAgo: number | null;
  samples7d: number;
  coverageHours7d: number;
}

export interface GameSummary {
  meta: GameMeta;
  stats: GameStats;
  growth: GrowthMetrics;
  revenue: RevenueEstimate;
  source: DataSource;
}

export interface GameDetail extends GameSummary {
  peak: PeakMetrics;
  monetization: MonetizationSignals | null;
  likeRatio: number | null;
}

export interface HistoryPoint {
  t: string;
  players: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
}

export type HistoryRange = "24h" | "7d" | "30d" | "90d" | "1y";

export interface HistoryResponse {
  placeId: number;
  range: HistoryRange;
  bucketSeconds: number;
  points: HistoryPoint[];
  source: DataSource;
  /** Present when there is not (yet) enough stored history to cover the range. */
  notice: string | null;
}

export interface SearchResult {
  placeId: number;
  universeId: number | null;
  name: string;
  creatorName: string | null;
  players: number | null;
  iconUrl: string | null;
  isTracked: boolean;
  matchedBy: "name" | "id" | "creator" | "url" | "roblox-search";
}

export interface DeveloperSummary {
  /** Route id, e.g. `group-4372130` or `user-1`. */
  id: string;
  robloxId: number;
  type: CreatorType;
  name: string;
  hasVerifiedBadge: boolean;
  gameCount: number;
  totalVisits: number | null;
  totalPlayers: number | null;
  estimatedMonthlyRevenue: MoneyRange | null;
  /** Players-weighted 7d growth across tracked games. */
  growth7d: number | null;
  topGame: { placeId: number; name: string } | null;
}

export interface DeveloperGame {
  placeId: number;
  universeId: number;
  name: string;
  visits: number | null;
  players: number | null;
  isTracked: boolean;
}

export interface DeveloperDetail extends DeveloperSummary {
  description: string | null;
  memberCount: number | null;
  games: DeveloperGame[];
  trackedGames: GameSummary[];
  source: DataSource;
}

export interface MetricWithDelta {
  value: number | null;
  changePct: number | null;
  changeLabel: string;
  series: { t: string; v: number }[];
}

export interface GlobalStats {
  gamesTracked: number;
  playersOnline: MetricWithDelta;
  totalVisits: MetricWithDelta;
  estimatedMonthlyRevenue: {
    range: MoneyRange | null;
    changePct: number | null;
    changeLabel: string;
    series: { t: string; v: number }[];
  };
  source: DataSource;
  updatedAt: string;
}

export interface CurrencyRates {
  base: "USD";
  rates: Record<string, number>;
  provider: string;
  fetchedAt: string;
  /** live: fresh from provider · cached: from our cache within TTL · stale: provider failed, serving last saved · snapshot: bundled reference values, never fetched */
  status: "live" | "cached" | "stale" | "snapshot";
  warning: string | null;
}

export interface ApiLogEntry {
  id: string;
  service: string;
  endpoint: string;
  status: number | null;
  message: string;
  occurredAt: string;
}

export interface RefreshRun {
  id: string;
  tier: RefreshTier;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean;
  gamesProcessed: number;
  error: string | null;
}

export type RefreshTier = "realtime" | "hourly" | "daily";

export interface DataStatus {
  mode: DataMode;
  activeSource: DataSource;
  reason: string;
  storage: "postgres" | "memory";
}
