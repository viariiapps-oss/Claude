import { Pool, types, type PoolClient } from "pg";
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
import type { Repository, SnapshotInput, StoredDeveloper, StoredGame } from "./repository";
import { developerId } from "@/utils/ids";

// int8 and numeric → JS number. Every counter we store (≤ ~1e12) is far below 2^53.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));

const iso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString());

interface GameRow {
  universe_id: number;
  root_place_id: number;
  name: string;
  description: string | null;
  creator_type: "User" | "Group";
  creator_id: number;
  creator_name: string;
  creator_verified: boolean;
  genre: string | null;
  max_players: number | null;
  created_at_roblox: Date | null;
  updated_at_roblox: Date | null;
  icon_url: string | null;
  thumbnail_url: string | null;
  is_tracked: boolean;
  last_refreshed_at: Date | null;
  last_error: string | null;
}

function toGame(r: GameRow): StoredGame {
  return {
    universeId: r.universe_id,
    placeId: r.root_place_id,
    name: r.name,
    description: r.description,
    creator: { id: r.creator_id, name: r.creator_name, type: r.creator_type, hasVerifiedBadge: r.creator_verified },
    genre: r.genre,
    maxPlayers: r.max_players,
    createdAt: iso(r.created_at_roblox),
    updatedAt: iso(r.updated_at_roblox),
    iconUrl: r.icon_url,
    thumbnailUrl: r.thumbnail_url,
    isTracked: r.is_tracked,
    lastRefreshedAt: iso(r.last_refreshed_at),
    lastError: r.last_error,
  };
}

export class PostgresRepository implements Repository {
  readonly kind = "postgres" as const;
  private pool: Pool;

  constructor(connectionString: string, ssl: boolean) {
    this.pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
    });
  }

  private async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      const out = await fn(c);
      await c.query("commit");
      return out;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }

  async listGames(opts?: { trackedOnly?: boolean }) {
    const { rows } = await this.pool.query<GameRow>(
      `select * from games ${opts?.trackedOnly ? "where is_tracked" : ""} order by name`,
    );
    return rows.map(toGame);
  }

  async getGame(by: { universeId?: number; placeId?: number }) {
    const { rows } =
      by.universeId !== undefined
        ? await this.pool.query<GameRow>("select * from games where universe_id = $1", [by.universeId])
        : await this.pool.query<GameRow>("select * from games where root_place_id = $1", [by.placeId]);
    return rows[0] ? toGame(rows[0]) : null;
  }

  async upsertGame(g: GameMeta) {
    const devId = developerId(g.creator.type, g.creator.id);
    await this.tx(async (c) => {
      await c.query(
        `insert into developers (id, creator_type, roblox_id, name, has_verified_badge)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set name = excluded.name, has_verified_badge = excluded.has_verified_badge, updated_at = now()`,
        [devId, g.creator.type, g.creator.id, g.creator.name, g.creator.hasVerifiedBadge],
      );
      await c.query(
        `insert into games (universe_id, root_place_id, name, description, developer_id, creator_type, creator_id,
            creator_name, creator_verified, genre, max_players, created_at_roblox, updated_at_roblox, icon_url,
            thumbnail_url, is_tracked)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         on conflict (universe_id) do update set
            root_place_id = excluded.root_place_id, name = excluded.name, description = excluded.description,
            developer_id = excluded.developer_id, creator_type = excluded.creator_type, creator_id = excluded.creator_id,
            creator_name = excluded.creator_name, creator_verified = excluded.creator_verified, genre = excluded.genre,
            max_players = excluded.max_players, created_at_roblox = excluded.created_at_roblox,
            updated_at_roblox = excluded.updated_at_roblox,
            icon_url = coalesce(excluded.icon_url, games.icon_url),
            thumbnail_url = coalesce(excluded.thumbnail_url, games.thumbnail_url),
            is_tracked = games.is_tracked or excluded.is_tracked`,
        [
          g.universeId, g.placeId, g.name, g.description, devId, g.creator.type, g.creator.id, g.creator.name,
          g.creator.hasVerifiedBadge, g.genre, g.maxPlayers, g.createdAt, g.updatedAt, g.iconUrl, g.thumbnailUrl,
          g.isTracked,
        ],
      );
    });
  }

  async setTracked(universeId: number, tracked: boolean) {
    await this.pool.query("update games set is_tracked = $2 where universe_id = $1", [universeId, tracked]);
  }

  async deleteGame(universeId: number) {
    await this.pool.query("delete from games where universe_id = $1", [universeId]);
  }

  async markRefreshed(universeIds: number[], error: string | null) {
    if (universeIds.length === 0) return;
    await this.pool.query(
      `update games set last_error = $2, last_refreshed_at = case when $2::text is null then now() else last_refreshed_at end
       where universe_id = any($1::bigint[])`,
      [universeIds, error],
    );
  }

  async getLatestStats(universeIds: number[]) {
    const out = new Map<number, GameStats>();
    if (universeIds.length === 0) return out;
    const { rows } = await this.pool.query(
      "select * from game_stats where universe_id = any($1::bigint[])",
      [universeIds],
    );
    for (const r of rows) {
      out.set(r.universe_id, {
        players: r.players, visits: r.visits, favorites: r.favorites, likes: r.likes, dislikes: r.dislikes,
        fetchedAt: new Date(r.fetched_at).toISOString(),
      });
    }
    return out;
  }

  async saveSnapshots(rows: SnapshotInput[], minIntervalMs: number) {
    if (rows.length === 0) return 0;
    return this.tx(async (c) => {
      let inserted = 0;
      for (const { universeId, stats: s, revenueDaily } of rows) {
        await c.query(
          `insert into game_stats (universe_id, players, visits, favorites, likes, dislikes, fetched_at)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (universe_id) do update set players = excluded.players,
             visits = coalesce(excluded.visits, game_stats.visits),
             favorites = coalesce(excluded.favorites, game_stats.favorites),
             likes = coalesce(excluded.likes, game_stats.likes),
             dislikes = coalesce(excluded.dislikes, game_stats.dislikes),
             fetched_at = excluded.fetched_at`,
          [universeId, s.players, s.visits, s.favorites, s.likes, s.dislikes, s.fetchedAt],
        );
        const res = await c.query(
          `insert into game_history (universe_id, recorded_at, players, visits, favorites, likes, dislikes,
              estimated_revenue_low, estimated_revenue_high)
           select $1,$2,$3,$4,$5,$6,$7,$8,$9
           where not exists (
             select 1 from game_history where universe_id = $1
               and recorded_at > $2::timestamptz - make_interval(secs => $10::double precision / 1000))`,
          [universeId, s.fetchedAt, s.players, s.visits, s.favorites, s.likes, s.dislikes,
            revenueDaily?.low ?? null, revenueDaily?.high ?? null, minIntervalMs],
        );
        inserted += res.rowCount ?? 0;
      }
      return inserted;
    });
  }

  async getHistory(universeIds: number[], fromIso: string, toIso: string, bucketSeconds: number) {
    const out = new Map<number, HistoryPoint[]>();
    for (const id of universeIds) out.set(id, []);
    if (universeIds.length === 0) return out;
    const { rows } = await this.pool.query(
      `select universe_id,
              date_bin(make_interval(secs => $4::double precision), recorded_at, $2::timestamptz) as bucket,
              round(avg(players))::bigint as players,
              (array_agg(visits order by recorded_at desc))[1] as visits,
              (array_agg(favorites order by recorded_at desc))[1] as favorites,
              (array_agg(likes order by recorded_at desc))[1] as likes
       from game_history
       where universe_id = any($1::bigint[]) and recorded_at >= $2 and recorded_at <= $3
       group by 1, 2 order by 1, 2`,
      [universeIds, fromIso, toIso, bucketSeconds],
    );
    for (const r of rows) {
      out.get(r.universe_id)?.push({
        t: new Date(r.bucket).toISOString(),
        players: r.players, visits: r.visits, favorites: r.favorites, likes: r.likes,
      });
    }
    return out;
  }

  async getPeaks(universeIds: number[]) {
    const out = new Map<number, { players: number; at: string; since: string }>();
    if (universeIds.length === 0) return out;
    const { rows } = await this.pool.query(
      `select p.universe_id, p.players, p.recorded_at, f.since from (
         select distinct on (universe_id) universe_id, players, recorded_at
         from game_history where universe_id = any($1::bigint[]) and players is not null
         order by universe_id, players desc, recorded_at desc) p
       join (select universe_id, min(recorded_at) as since from game_history
             where universe_id = any($1::bigint[]) group by universe_id) f using (universe_id)`,
      [universeIds],
    );
    for (const r of rows) {
      out.set(r.universe_id, { players: r.players, at: new Date(r.recorded_at).toISOString(), since: new Date(r.since).toISOString() });
    }
    return out;
  }

  async pruneHistory(olderThanIso: string) {
    // Keep one sample per game per hour for old data instead of deleting it entirely.
    const res = await this.pool.query(
      `delete from game_history h using (
         select id, row_number() over (partition by universe_id, date_trunc('hour', recorded_at) order by recorded_at) as rn
         from game_history where recorded_at < $1) d
       where h.id = d.id and d.rn > 1`,
      [olderThanIso],
    );
    return res.rowCount ?? 0;
  }

  async saveMonetization(universeId: number, s: MonetizationSignals) {
    await this.pool.query(
      `insert into game_monetization (universe_id, game_pass_count, game_pass_median_price, game_pass_max_price, fetched_at)
       values ($1,$2,$3,$4,$5)
       on conflict (universe_id) do update set game_pass_count = excluded.game_pass_count,
         game_pass_median_price = excluded.game_pass_median_price, game_pass_max_price = excluded.game_pass_max_price,
         fetched_at = excluded.fetched_at`,
      [universeId, s.gamePassCount, s.gamePassMedianPrice, s.gamePassMaxPrice, s.fetchedAt],
    );
  }

  async getMonetization(universeIds: number[]) {
    const out = new Map<number, MonetizationSignals>();
    if (universeIds.length === 0) return out;
    const { rows } = await this.pool.query(
      "select * from game_monetization where universe_id = any($1::bigint[])",
      [universeIds],
    );
    for (const r of rows) {
      out.set(r.universe_id, {
        gamePassCount: r.game_pass_count,
        gamePassMedianPrice: r.game_pass_median_price,
        gamePassMaxPrice: r.game_pass_max_price,
        fetchedAt: new Date(r.fetched_at).toISOString(),
      });
    }
    return out;
  }

  async saveRevenueEstimate(universeId: number, e: RevenueEstimate) {
    if (e.status === "ok") {
      await this.pool.query(
        `insert into revenue_estimates (universe_id, computed_at, model_version, status, daily_low, daily_mid, daily_high,
           monthly_low, monthly_mid, monthly_high, confidence, confidence_score, inputs)
         values ($1,$2,$3,'ok',$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [universeId, e.computedAt, e.modelVersion, e.daily.low, e.daily.mid, e.daily.high, e.monthly.low, e.monthly.mid,
          e.monthly.high, e.confidence, e.confidenceScore, JSON.stringify(e.inputs)],
      );
    } else {
      await this.pool.query(
        `insert into revenue_estimates (universe_id, computed_at, model_version, status, reason)
         values ($1,$2,$3,'insufficient',$4)`,
        [universeId, e.computedAt, e.modelVersion, e.reason],
      );
    }
  }

  async upsertDeveloper(d: StoredDeveloper) {
    await this.pool.query(
      `insert into developers (id, creator_type, roblox_id, name, description, has_verified_badge, member_count, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do update set name = excluded.name, description = excluded.description,
         has_verified_badge = excluded.has_verified_badge, member_count = excluded.member_count, updated_at = excluded.updated_at`,
      [d.id, d.type, d.robloxId, d.name, d.description, d.hasVerifiedBadge, d.memberCount, d.updatedAt],
    );
  }

  async getDeveloper(id: string) {
    const { rows } = await this.pool.query("select * from developers where id = $1", [id]);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id, type: r.creator_type, robloxId: r.roblox_id, name: r.name, description: r.description,
      hasVerifiedBadge: r.has_verified_badge, memberCount: r.member_count, updatedAt: new Date(r.updated_at).toISOString(),
    } satisfies StoredDeveloper;
  }

  async saveCurrencyRates(r: Pick<CurrencyRates, "rates" | "provider" | "fetchedAt">) {
    await this.pool.query(
      "insert into currency_rates (base, rates, provider, fetched_at) values ('USD', $1, $2, $3)",
      [JSON.stringify(r.rates), r.provider, r.fetchedAt],
    );
  }

  async getLatestCurrencyRates() {
    const { rows } = await this.pool.query("select * from currency_rates order by fetched_at desc limit 1");
    const r = rows[0];
    if (!r) return null;
    return { rates: r.rates as Record<string, number>, provider: r.provider as string, fetchedAt: new Date(r.fetched_at).toISOString() };
  }

  async logApiError(e: Omit<ApiLogEntry, "id">) {
    await this.pool.query(
      "insert into api_logs (service, endpoint, status, message, occurred_at) values ($1,$2,$3,$4,$5)",
      [e.service, e.endpoint, e.status, e.message.slice(0, 2000), e.occurredAt],
    );
  }

  async listApiErrors(limit: number) {
    const { rows } = await this.pool.query("select * from api_logs order by occurred_at desc limit $1", [limit]);
    return rows.map((r) => ({
      id: String(r.id), service: r.service, endpoint: r.endpoint, status: r.status, message: r.message,
      occurredAt: new Date(r.occurred_at).toISOString(),
    }));
  }

  async startRefreshRun(tier: RefreshTier) {
    const { rows } = await this.pool.query("insert into refresh_runs (tier) values ($1) returning id", [tier]);
    return String(rows[0].id);
  }

  async finishRefreshRun(id: string, r: { ok: boolean; gamesProcessed: number; error: string | null }) {
    await this.pool.query(
      "update refresh_runs set finished_at = now(), ok = $2, games_processed = $3, error = $4 where id = $1",
      [Number(id), r.ok, r.gamesProcessed, r.error],
    );
  }

  async listRefreshRuns(limit: number): Promise<RefreshRun[]> {
    const { rows } = await this.pool.query("select * from refresh_runs order by started_at desc limit $1", [limit]);
    return rows.map((r) => ({
      id: String(r.id), tier: r.tier, startedAt: new Date(r.started_at).toISOString(),
      finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null, ok: r.ok,
      gamesProcessed: r.games_processed, error: r.error,
    }));
  }

  async ping() {
    try {
      await this.pool.query("select 1");
      return true;
    } catch {
      return false;
    }
  }
}
