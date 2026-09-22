# RBLX Analytics

**Roblox Game Intelligence.** Explore player activity, visits, growth and **estimated** revenue across Roblox experiences.

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn-style UI (Radix) · Recharts · TanStack Query · Zod · PostgreSQL/Supabase

> Revenue figures are **estimates** of creator earnings built from public data and documented assumptions.
> Estimated Revenue ≠ Official Revenue. Roblox does not publish per-experience earnings.

---

## Features

| Route | What it does |
|-------|--------------|
| `/` | Hero search (name, creator, game ID, roblox.com URL), platform overview cards, trending & most played |
| `/dashboard` | Players online / visits / est. monthly revenue with change %, sparklines, 7-day chart, player share, top lists |
| `/games` | Explorer: search + filters (genre, players, visits, revenue, growth, created/updated) + 5 sort orders, pagination |
| `/games/[placeId]` | Game page: metadata, 6 stat cards, players chart (24H/7D/30D/90D/1Y), visits (daily/weekly/monthly), indexed growth, revenue ranges (daily→yearly, 16 currencies, confidence, methodology dialog), currency converter, JSON-LD, dynamic OG image |
| `/trending` | Trending, Most Played, Most Visited, Fastest Growing, Highest Estimated Revenue |
| `/revenue` | Interactive **Revenue Estimator** (Robux, conversion, monetization and confidence assumptions) + leaderboard + calculator |
| `/developers`, `/developers/[group-ID\|user-ID]` | Creators with aggregated games, visits, players, revenue and growth |
| `/compare?ids=…` | Up to 4 games: metric table (crown = best), overlaid players chart, per-metric bars |
| `/about` | What it is, how it works, data sources, methodology, limitations, privacy, API, contact |
| `/admin` | Password-protected: add/remove games, force refresh (per game / per tier), API status, errors, run history |

Also: `⌘K` global search, bottom tab bar + hamburger menu on phones, tables → cards on mobile, skeletons,
empty/error states, toasts, tooltips, `sitemap.xml`, `robots.txt`, Open Graph/Twitter cards and per-page metadata.

🟢 **LIVE DATA** / 🟡 **DEMO DATA** badges appear wherever numbers are shown.

---

## Run locally

Requirements: **Node.js ≥ 20.9** (22 LTS recommended) and npm.

```bash
cd rblx-analytics
npm install
cp .env.example .env.local      # optional — everything works without editing it
npm run dev                     # http://localhost:3000
```

With no configuration the app starts in `DATA_MODE=auto`: it uses Roblox's public APIs when they are reachable
and otherwise falls back to the labelled demo dataset, storing data in memory.

To enable the admin panel, set in `.env.local`:

```bash
ADMIN_PASSWORD=choose-a-long-password
ADMIN_SESSION_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
```

### With a local PostgreSQL (persistent history)

```bash
createdb rblx
# .env.local
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/rblx
DATABASE_SSL=false

npm run db:migrate
npm run dev
# in a second terminal — scheduled refreshes (5 min / hourly / daily):
npm run worker
```

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm test` | Vitest: estimator, formatting, parsing, bucketing, explorer, demo generator, **live pipeline with mocked Roblox** |
| `TEST_DATABASE_URL=postgres://… npm test` | Same, with the live pipeline against PostgreSQL |
| `npm run db:migrate` | Applies `db/migrations/*.sql` |
| `npm run worker` | Local scheduler calling `/api/cron/refresh` (needs `CRON_SECRET`, `APP_URL`) |
| `npm run refresh -- hourly` | Trigger one tier once |

---

## Deploy: Supabase + Vercel

### 1. Supabase (database)

1. Create a project at supabase.com.
2. **SQL Editor** → paste `db/migrations/001_init.sql` → Run. (Or run `npm run db:migrate` locally with `DATABASE_URL` pointing at Supabase.)
3. **Project Settings → Database → Connection string → URI**. On Vercel use the **Transaction pooler** URI (port 6543), e.g.
   `postgresql://postgres.xxxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`.

`SUPABASE_URL` / `SUPABASE_ANON_KEY` are optional; the app talks to Postgres directly through `DATABASE_URL`.

### 2. Vercel (app)

1. Import the repository in Vercel and set **Root Directory = `rblx-analytics`** (framework: Next.js is auto-detected).
2. Environment variables (Production):

   | Variable | Value |
   |----------|-------|
   | `DATA_MODE` | `auto` (or `live`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |
   | `DATABASE_URL` | Supabase pooler URI |
   | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | strong random values |
   | `CRON_SECRET` | random value — Vercel Cron sends it as `Authorization: Bearer …` |
   | `EXCHANGE_RATE_API_KEY` | optional |

3. Deploy. `vercel.json` registers a **daily** cron (`/api/cron/refresh?tier=daily`), which works on every Vercel plan.

### 3. Sub-daily refresh (5 minutes / hourly)

Vercel Hobby only allows daily cron jobs. Pick one:

- **Vercel Pro** — add to `vercel.json`:
  ```json
  { "path": "/api/cron/refresh?tier=realtime", "schedule": "*/5 * * * *" },
  { "path": "/api/cron/refresh?tier=hourly",   "schedule": "0 * * * *" }
  ```
- **Any external scheduler** (cron-job.org, GitHub Actions, Supabase `pg_cron` + `pg_net`) calling
  `GET https://your-domain/api/cron/refresh?tier=realtime` with header `Authorization: Bearer $CRON_SECRET`.
- **Self-hosted** — `npm run worker` next to `npm start`.

Without any scheduler, stale games (> 5 min) are still refreshed on read; history is simply sparser.

---

## Architecture

```
rblx-analytics/
├── db/migrations/001_init.sql     games, game_stats, game_history, developers, revenue_estimates,
│                                  game_monetization, currency_rates, api_logs, refresh_runs (+ indexes)
├── docs/API.md                    endpoint reference
├── scripts/                       migrate, worker (scheduler), refresh-once
├── tests/                         Vitest suites
└── src/
    ├── app/                       routes, API route handlers, metadata (sitemap, robots, OG images)
    ├── components/                ui/ (shadcn-style primitives) · layout/ · charts/ · common/ · games/ ·
    │                              dashboard/ · revenue/ · compare/ · developers/ · admin/ · trending/ · home/
    ├── config/                    env (Zod-validated, server-only) · site · revenue-model · seed-games
    ├── db/                        Repository interface · PostgresRepository · MemoryRepository · bucketing
    ├── hooks/                     useCurrency (context + TanStack Query) · useDebounce
    ├── lib/                       api wrapper (rate limit, CORS, errors) · admin auth · cache · rate limiters · explorer
    ├── services/
    │   ├── roblox/                public-API client (Zod schemas, token bucket, retries, circuit breaker)
    │   ├── demo/                  deterministic synthetic generator (DEMO mode)
    │   ├── revenue/estimator.ts   pure estimator (server + browser)
    │   ├── currency/              FX provider chain + persistence + fallbacks
    │   ├── games · live · rankings · developers · refresh · metrics · data-status
    ├── types/                     domain interfaces
    └── utils/                     formatting, ID parsing
```

**Data flow.** `services/data-status` decides live vs demo. Live reads go Repository → (stale? batched Roblox refresh)
→ aggregates → growth + revenue estimate. Every refresh appends a `game_history` row (min. 4 min apart), which powers
every chart, growth metric and peak. Demo data is a pure function of `(game, time)` and is never stored.

**Upstream protection.** One token bucket (`ROBLOX_MAX_RPS`, default 4 req/s), batching (50 universes per call),
in-flight de-duplication, TTL caches, 30 s Next fetch cache, retry with `Retry-After` on 429/5xx, and a circuit
breaker (3 failures → 60 s pause). FX rates are fetched at most hourly.

---

## Roblox data: what is (and isn't) available

Only **public, unauthenticated** Roblox web APIs are used:

| Data | Endpoint |
|------|----------|
| players (`playing`), visits, favorites, name, creator, genre (`genre_l1`), created/updated, max players | `games.roblox.com/v1/games?universeIds=` |
| likes / dislikes | `games.roblox.com/v1/games/votes?universeIds=` |
| place → universe | `apis.roblox.com/universes/v1/places/{placeId}/universe` |
| icons / thumbnails | `thumbnails.roblox.com/v1/games/icons`, `/v1/games/multiget/thumbnails` |
| game passes (signal) | `apis.roblox.com/game-passes/v1/universes/{id}/game-passes` (replaced the games.roblox.com endpoint deprecated in 2025) |
| groups / users | `groups.roblox.com/v1/groups/{id}`, `users.roblox.com/v1/users/{id}` |
| a creator's games | `games.roblox.com/v2/groups/{id}/games`, `/v2/users/{id}/games` |
| name search (optional) | `apis.roblox.com/search-api/omni-search` — **undocumented**, used by roblox.com; toggle with `ROBLOX_ENABLE_OMNI_SEARCH` |

**Not publicly available** (shown as "Data unavailable" or estimated): actual revenue per experience, historical
CCU before tracking starts, all-time peaks, DAU/retention/session length, pass/product sales volumes, Premium
Payouts. Those exist only in the owner's Creator Hub / Open Cloud analytics. `ROBLOX_API_KEY` is reserved for a
future "your own experiences" integration and is not needed for public data.

## Revenue methodology (summary)

```
engagementHours/day = avgConcurrentPlayers (7-day avg when available) × 24
daily creator earnings ≈ engagementHours × $0.0121/h × 1.086 (DevEx rate change) × genreFactor × monetizationFactor
range = daily × [low, high] multipliers that widen as confidence drops
```

- **$0.0121/hour**: Roblox FY2025 results — $1,503.1M Developer Exchange fees ÷ 124B hours engaged (platform average).
- **× 1.086**: the standard DevEx rate rose from $0.0035 to $0.0038 per Robux on 5 Sep 2025.
- **Genre factors** and **game-pass factors** are editorial assumptions, listed in `src/config/revenue-model.ts`.
- **Confidence** (low/medium/high) scores history coverage, averaging window, signals, sample size and source.
  Demo data is capped at medium. Below 25 average players → "Insufficient data to estimate revenue."

Everything is configurable in `src/config/revenue-model.ts` and interactively on `/revenue`.

## Security

- Secrets only in server-side env (`server-only` guard on `config/env.ts`); `.env*` ignored by git.
- Zod validation on every query string, route param and server-action input.
- Per-IP rate limiting on all API routes (in-memory per instance; swap `WindowLimiter` for Redis/Upstash for multi-region).
- Admin: constant-time password check, HMAC-signed `httpOnly`, `sameSite=strict` session cookie (8 h), login
  rate limit (5/min/IP); every server action re-checks the session. Cron endpoint requires `CRON_SECRET`.
- Configurable CORS allow-list; security headers (`nosniff`, `DENY` framing, referrer & permissions policies).
- React escaping for all external strings; JSON-LD is serialized with `<` escaped.

## Honest status of verification

- ✅ `npm install`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (22 tests) pass.
- ✅ All pages return 200 (and proper 404/308 for missing games and universe-ID URLs); no horizontal overflow at 390 px.
- ✅ Demo mode, charts, search, compare, currency converter, revenue estimator and admin flows were exercised in a real browser.
- ✅ The live pipeline (seed → snapshot → history → detail/search/peak/monetization) is tested against **PostgreSQL** with
  Roblox HTTP responses mocked.
- ⚠️ The build environment could not reach `*.roblox.com` or the FX providers, so the Roblox endpoints were **not**
  called for real from here. Response parsing is schema-validated and tolerant; if Roblox changes a response shape
  the app logs it in `/admin` and falls back to "Data unavailable" rather than crashing.
