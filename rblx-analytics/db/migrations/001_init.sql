-- RBLX Analytics — initial schema (PostgreSQL 14+ / Supabase)
-- Apply with `npm run db:migrate` or paste into the Supabase SQL editor.

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

-- Creators (Roblox users or groups) --------------------------------------------
create table if not exists developers (
  id                 text primary key,               -- 'group-123' | 'user-456'
  creator_type       text not null check (creator_type in ('User', 'Group')),
  roblox_id          bigint not null,
  name               text not null,
  description        text,
  has_verified_badge boolean not null default false,
  member_count       bigint,
  updated_at         timestamptz not null default now(),
  unique (creator_type, roblox_id)
);
create index if not exists developers_name_idx on developers (lower(name));

-- Experiences ---------------------------------------------------------------------
create table if not exists games (
  universe_id        bigint primary key,
  root_place_id      bigint not null unique,
  name               text not null,
  description        text,
  developer_id       text references developers (id) on delete set null,
  creator_type       text not null check (creator_type in ('User', 'Group')),
  creator_id         bigint not null,
  creator_name       text not null,
  creator_verified   boolean not null default false,
  genre              text,
  max_players        integer,
  created_at_roblox  timestamptz,
  updated_at_roblox  timestamptz,
  icon_url           text,
  thumbnail_url      text,
  is_tracked         boolean not null default true,
  added_at           timestamptz not null default now(),
  last_refreshed_at  timestamptz,
  last_error         text
);
create index if not exists games_tracked_idx on games (is_tracked) where is_tracked;
create index if not exists games_name_idx on games (lower(name));
create index if not exists games_creator_idx on games (creator_type, creator_id);
create index if not exists games_developer_idx on games (developer_id);

-- Latest snapshot per game (fast reads for lists) ---------------------------------
create table if not exists game_stats (
  universe_id  bigint primary key references games (universe_id) on delete cascade,
  players      integer,
  visits       bigint,
  favorites    bigint,
  likes        bigint,
  dislikes     bigint,
  fetched_at   timestamptz not null
);
create index if not exists game_stats_players_idx on game_stats (players desc nulls last);
create index if not exists game_stats_visits_idx on game_stats (visits desc nulls last);

-- Time series: one row per refresh ----------------------------------------------------
create table if not exists game_history (
  id                        bigserial primary key,
  universe_id               bigint not null references games (universe_id) on delete cascade,
  recorded_at               timestamptz not null,
  players                   integer,
  visits                    bigint,
  favorites                 bigint,
  likes                     bigint,
  dislikes                  bigint,
  estimated_revenue_low     numeric(14, 2),  -- estimated daily creator earnings, USD (NOT official)
  estimated_revenue_high    numeric(14, 2)
);
create index if not exists game_history_game_time_idx on game_history (universe_id, recorded_at desc);
create index if not exists game_history_time_idx on game_history (recorded_at);

-- Public monetization signals (game passes) -----------------------------------------
create table if not exists game_monetization (
  universe_id              bigint primary key references games (universe_id) on delete cascade,
  game_pass_count          integer not null,
  game_pass_median_price   integer,
  game_pass_max_price      integer,
  fetched_at               timestamptz not null
);

-- Estimates are versioned so methodology changes stay auditable ----------------------
create table if not exists revenue_estimates (
  id                bigserial primary key,
  universe_id       bigint not null references games (universe_id) on delete cascade,
  computed_at       timestamptz not null default now(),
  model_version     text not null,
  status            text not null check (status in ('ok', 'insufficient')),
  daily_low         numeric(14, 2),
  daily_mid         numeric(14, 2),
  daily_high        numeric(14, 2),
  monthly_low       numeric(16, 2),
  monthly_mid       numeric(16, 2),
  monthly_high      numeric(16, 2),
  confidence        text check (confidence in ('low', 'medium', 'high')),
  confidence_score  integer,
  inputs            jsonb,
  reason            text
);
create index if not exists revenue_estimates_game_idx on revenue_estimates (universe_id, computed_at desc);

-- FX rates (base USD) ------------------------------------------------------------------
create table if not exists currency_rates (
  id          bigserial primary key,
  base        text not null default 'USD',
  rates       jsonb not null,
  provider    text not null,
  fetched_at  timestamptz not null default now()
);
create index if not exists currency_rates_time_idx on currency_rates (fetched_at desc);

-- Operations ---------------------------------------------------------------------------
create table if not exists api_logs (
  id           bigserial primary key,
  service      text not null,
  endpoint     text not null,
  status       integer,
  message      text not null,
  occurred_at  timestamptz not null default now()
);
create index if not exists api_logs_time_idx on api_logs (occurred_at desc);

create table if not exists refresh_runs (
  id               bigserial primary key,
  tier             text not null check (tier in ('realtime', 'hourly', 'daily')),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  ok               boolean not null default false,
  games_processed  integer not null default 0,
  error            text
);
create index if not exists refresh_runs_time_idx on refresh_runs (started_at desc);

insert into schema_migrations (version) values ('001_init') on conflict do nothing;
