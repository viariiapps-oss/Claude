# RBLX Analytics — HTTP API

Base URL: your deployment (e.g. `http://localhost:3000`). All endpoints:

- return JSON (`Content-Type: application/json`)
- accept only `GET` (plus `OPTIONS` for CORS pre-flight)
- are rate-limited per client IP (`API_RATE_LIMIT_PER_MINUTE`, default 120; search: 60/min) and send
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; over the limit → `429` with `Retry-After`
- validate every query parameter with Zod; invalid input → `400`
- send CORS headers according to `CORS_ALLOWED_ORIGINS`

Errors always look like:

```json
{ "error": { "status": 400, "message": "Invalid query parameters", "details": [{ "path": "pageSize", "message": "Too big: expected number to be <=100" }] } }
```

### Identifiers

| Name | Meaning |
|------|---------|
| `placeId` | The **Roblox game ID** shown in `roblox.com/games/{placeId}` URLs. Canonical ID in this API and in page routes. |
| `universeId` | Roblox's experience ID used by its games API. Returned for reference. |
| developer id | `group-{groupId}` or `user-{userId}` |

### Data source flag

Every response that contains statistics includes `"source": "live" | "demo"`. `demo` means synthetic sample data
(Roblox unreachable or `DATA_MODE=demo`) and must not be treated as real statistics. `null` values mean
**unavailable**, never zero.

---

## `GET /api/games`

Tracked games with filters, sorting and pagination.

| Query | Type | Notes |
|-------|------|-------|
| `q` | string ≤ 100 | Matches name, creator/group name, place ID, universe ID, creator ID |
| `genre` | string | Exact genre (see `genres` in the response) |
| `minPlayers`, `maxPlayers`, `minVisits` | number ≥ 0 | |
| `minRevenue` | number ≥ 0 | USD, compared with the **midpoint** of the monthly estimate |
| `minGrowth` | number | % player growth over 7 days (falls back to 24 h) |
| `createdAfter`, `updatedAfter` | `YYYY-MM-DD` | |
| `sort` | `players` \| `visits` \| `growth` \| `revenue` \| `likes` | default `players` |
| `dir` | `asc` \| `desc` | default `desc`; unavailable values always sort last |
| `page` | int ≥ 1 | default 1 |
| `pageSize` | 1–100 | default 25 |

Response: `{ source, genres: string[], total, page, pageSize, games: GameSummary[] }`

`GameSummary`:

```jsonc
{
  "meta": { "placeId": 920587237, "universeId": 383310974, "name": "Adopt Me!", "creator": { "id": 295182, "name": "Uplift Games", "type": "Group", "hasVerifiedBadge": true },
            "genre": "Roleplay & Avatar Sim", "maxPlayers": 48, "createdAt": "…", "updatedAt": "…", "iconUrl": "…", "thumbnailUrl": "…", "isTracked": true },
  "stats": { "players": 210000, "visits": 41700000000, "favorites": 26800000, "likes": 4500000, "dislikes": 950000, "fetchedAt": "…" },
  "growth": { "players24h": 2.1, "players7d": -0.4, "visitsGained24h": 6800000, "visitsGained7d": 47000000, "visits7d": 0.11, "favorites7d": 0.09 },
  "revenue": { /* RevenueEstimate, see below */ },
  "source": "live"
}
```

## `GET /api/games/{placeId}`

Full detail = `GameSummary` + `peak` (`peakPlayers`, `peakAt`, `trackedSince` — peak within **stored** history),
`monetization` (`gamePassCount`, `gamePassMedianPrice`, `gamePassMaxPrice` in Robux) and `likeRatio` (0–1).
In live mode any public experience can be looked up (it is imported as *untracked*). Passing a universe ID
returns `404` with `details.placeId` set to the canonical place ID.

## `GET /api/games/{placeId}/stats`

`{ placeId, universeId, source, stats, likeRatio, growth, peak }`

## `GET /api/games/{placeId}/history?range=24h|7d|30d|90d|1y`

Bucketed time series. Bucket sizes: 24h → 15 min, 7d → 1 h, 30d → 6 h, 90d/1y → 1 day.
Players are averaged per bucket; visits/favorites/likes are the cumulative value at the end of the bucket.
Buckets without samples are omitted — gaps are never interpolated.

```json
{ "placeId": 920587237, "range": "7d", "bucketSeconds": 3600, "source": "live",
  "notice": "Tracking began … — earlier data is not available from Roblox's public APIs.",
  "points": [{ "t": "2026-09-15T20:00:00.000Z", "players": 201345, "visits": 41650000000, "favorites": 26790000, "likes": 4490000 }] }
```

## `GET /api/games/search?q=&limit=`

`q` (1–200 chars) may be a name, creator, place/universe ID or a `roblox.com/games/…` URL. `limit` 1–25 (default 10).
In live mode, name searches are supplemented by roblox.com's own (undocumented) omni-search when
`ROBLOX_ENABLE_OMNI_SEARCH=true`.

`{ source, results: [{ placeId, universeId, name, creatorName, players, iconUrl, isTracked, matchedBy }] }`
where `matchedBy` ∈ `name | id | url | creator | roblox-search`.

## `GET /api/trending?ranking=&limit=`

`ranking` ∈ `trending` (24 h player growth, ≥ 1,000 players) · `most-played` · `most-visited` ·
`fastest-growing` (7 d player growth, ≥ 1,000 players) · `highest-revenue` (monthly estimate midpoint). `limit` 1–100.

`{ source, ranking, title, metric, description, note, games: [{ rank, ...GameSummary }] }`

Rankings reflect a single metric and are not a judgement of quality.

## `GET /api/revenue[?ids=placeId,placeId]`

Up to 10 comma-separated place IDs; omitted → all tracked games.

`{ disclaimer, source, model: RevenueModelConfig, estimates: [{ placeId, name, source, revenue: RevenueEstimate }] }`

`RevenueEstimate` is either

```jsonc
{ "status": "ok", "currency": "USD",
  "daily": { "low": 0, "mid": 0, "high": 0 }, "weekly": {…}, "monthly": {…}, "yearly": {…},
  "confidence": "low" | "medium" | "high", "confidenceScore": 0-100, "confidenceReasons": ["…"],
  "inputs": { "avgPlayers": 0, "avgPlayersWindow": "7d" | "24h" | "current", "engagementHoursPerDay": 0, "baseUsdPerHour": 0.0121,
              "genre": "…", "genreFactor": 1.25, "monetizationFactor": 1.05, "devexAdjustment": 1.086,
              "historySamples": 0, "historyCoverageHours": 0, "hasMonetizationSignals": true, "gamePassCount": 14, "source": "live" },
  "modelVersion": "2026.09-1", "computedAt": "…" }
```

or `{ "status": "insufficient", "reason": "Insufficient data to estimate revenue — …", "modelVersion": "…", "computedAt": "…" }`.

**These are estimates of creator earnings in USD at the DevEx rate — not official revenue.**

## `GET /api/currency[?amount=&from=&to=]`

USD-based rates for `USD EUR GBP JPY CAD AUD CHF CNY KRW BRL MXN INR SEK NOK PLN SGD`.

```json
{ "base": "USD", "rates": { "USD": 1, "EUR": 0.86 }, "provider": "Frankfurter (ECB)", "fetchedAt": "…",
  "status": "live" | "stale" | "snapshot", "warning": null,
  "conversion": { "amount": 100, "from": "USD", "to": "EUR", "result": 86, "rate": 0.86 } }
```

`stale` = providers unreachable, last saved rates served. `snapshot` = nothing was ever saved; approximate bundled
reference values with a warning.

## `GET /api/developers[?q=]`

Creators of tracked games: `{ source, developers: [{ id, robloxId, type, name, hasVerifiedBadge, gameCount, totalVisits, totalPlayers, estimatedMonthlyRevenue, growth7d, topGame }] }`

## `GET /api/developers/{group-ID|user-ID}`

Developer summary + `description`, `memberCount`, `games` (all public experiences of the creator, live mode),
`trackedGames` (`GameSummary[]`), `source`.

## `GET /api/health`

`{ ok, dataMode, activeSource, storage, storageOk, time }`

## `GET /api/cron/refresh?tier=realtime|hourly|daily` (protected)

Requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically) or an admin session.
Returns `{ tier, ok, skipped?, gamesProcessed, details: string[], error }`.
