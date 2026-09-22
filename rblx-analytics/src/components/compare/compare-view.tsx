"use client";

import { useQueries } from "@tanstack/react-query";
import { Crown, Loader2, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { HorizontalBars } from "@/components/charts/bar-chart";
import { seriesColor } from "@/components/charts/chart-theme";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ConfidenceBadge } from "@/components/common/confidence-badge";
import { Delta } from "@/components/common/delta";
import { GameIcon } from "@/components/common/game-icon";
import { CurrencySelect } from "@/components/common/currency-select";
import { MoneyRangeText } from "@/components/common/money";
import { EmptyState } from "@/components/common/states";
import { useGameSearch } from "@/components/layout/search-command";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import type { GameSummary, HistoryRange, HistoryResponse } from "@/types";
import { formatCompact, formatNumber, formatPercent, likeRatio } from "@/utils/format";

const MAX = 4;
const PRESET = [126884695634066, 2753915549, 4924922222, 920587237];

type Metric = {
  label: string;
  value: (g: GameSummary) => number | null;
  render: (g: GameSummary) => React.ReactNode;
};

function useMetrics(): Metric[] {
  const money = (period: "daily" | "weekly" | "monthly" | "yearly") =>
    function RevenueValue(g: GameSummary) {
      return g.revenue.status === "ok" ? <MoneyRangeText range={g.revenue[period]} /> : <span className="text-xs text-subtle">Insufficient data</span>;
    };
  const mid = (period: "daily" | "weekly" | "monthly" | "yearly") => (g: GameSummary) => (g.revenue.status === "ok" ? g.revenue[period].mid : null);
  return [
    { label: "Players online", value: (g) => g.stats.players, render: (g) => formatNumber(g.stats.players) },
    { label: "Total visits", value: (g) => g.stats.visits, render: (g) => formatCompact(g.stats.visits, 2) },
    { label: "Favorites", value: (g) => g.stats.favorites, render: (g) => formatCompact(g.stats.favorites, 2) },
    { label: "Likes", value: (g) => g.stats.likes, render: (g) => formatCompact(g.stats.likes, 2) },
    {
      label: "Like ratio",
      value: (g) => likeRatio(g.stats.likes, g.stats.dislikes),
      render: (g) => {
        const r = likeRatio(g.stats.likes, g.stats.dislikes);
        return r === null ? "—" : formatPercent(r * 100, 1, false);
      },
    },
    { label: "Growth 24h", value: (g) => g.growth.players24h, render: (g) => <Delta value={g.growth.players24h} /> },
    { label: "Growth 7d", value: (g) => g.growth.players7d, render: (g) => <Delta value={g.growth.players7d} /> },
    { label: "Est. revenue · daily", value: mid("daily"), render: money("daily") },
    { label: "Est. revenue · weekly", value: mid("weekly"), render: money("weekly") },
    { label: "Est. revenue · monthly", value: mid("monthly"), render: money("monthly") },
    { label: "Est. revenue · yearly", value: mid("yearly"), render: money("yearly") },
    {
      label: "Estimate confidence",
      value: () => null,
      render: (g) => (g.revenue.status === "ok" ? <ConfidenceBadge confidence={g.revenue.confidence} withLabel={false} /> : "—"),
    },
  ];
}

function GamePicker({ onAdd, disabled }: { onAdd: (placeId: number) => void; disabled: boolean }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useGameSearch(q);
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? `Maximum of ${MAX} games` : "Add a game by name or ID…"}
        aria-label="Add a game to compare"
        className="h-11 pl-10"
      />
      {isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
      {q.trim() && data && (
        <ul className="absolute inset-x-0 top-full z-30 mt-2 animate-fade-in rounded-xl border border-border bg-card-2 p-1 shadow-2xl">
          {data.results.length === 0 && <li className="px-3 py-3 text-sm text-muted">No games found</li>}
          {data.results.slice(0, 6).map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                onClick={() => {
                  onAdd(r.placeId);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent-soft"
              >
                <GameIcon name={r.name} url={r.iconUrl} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                <Plus className="size-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RANGES = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
] as const;

function PlayersOverlay({ games, colorOf }: { games: GameSummary[]; colorOf: (id: number) => string }) {
  const [range, setRange] = useState<HistoryRange>("7d");
  const results = useQueries({
    queries: games.map((g) => ({
      queryKey: ["history", g.meta.placeId, range],
      queryFn: async (): Promise<HistoryResponse> => {
        const res = await fetch(`/api/games/${g.meta.placeId}/history?range=${range}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const rows = useMemo(() => {
    const byT = new Map<string, Record<string, number | string | null>>();
    results.forEach((r, i) => {
      for (const p of r.data?.points ?? []) {
        const row = byT.get(p.t) ?? { t: p.t };
        row[`g${games[i].meta.placeId}`] = p.players;
        byT.set(p.t, row);
      }
    });
    return [...byT.values()].sort((a, b) => String(a.t).localeCompare(String(b.t))) as ({ t: string } & Record<string, number | string | null>)[];
  }, [results, games]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Concurrent players over time</CardTitle>
          <CardDescription>Same scale for all games</CardDescription>
        </div>
        <Segmented label="Time range" options={RANGES} value={range} onChange={setRange} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : rows.length < 2 ? (
          <EmptyState title="Not enough history" description="Player history accumulates as games are refreshed." />
        ) : (
          <TimeSeriesChart
            variant="line"
            data={rows}
            series={games.map((g) => ({ key: `g${g.meta.placeId}`, label: g.meta.name, color: colorOf(g.meta.placeId) }))}
            formatValue={(v) => formatNumber(v)}
            formatTick={(v) => formatCompact(v)}
            height={300}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function CompareView({ games, requested }: { games: GameSummary[]; requested: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const metrics = useMetrics();
  const { format } = useCurrency();

  // Colour follows the game's slot (its position in the URL); adding a game never repaints existing ones.
  const slots = useMemo(() => new Map(requested.map((id, i) => [id, i])), [requested]);
  const colorOf = (id: number) => seriesColor(slots.get(id) ?? 0);

  const setIds = (ids: number[]) => {
    const q = ids.length ? `?ids=${ids.join(",")}` : "";
    startTransition(() => router.replace(`${pathname}${q}`, { scroll: false }));
  };
  const add = (id: number) => {
    if (requested.includes(id)) return toast.info("That game is already in the comparison");
    if (requested.length >= MAX) return toast.warning(`You can compare up to ${MAX} games`);
    setIds([...requested, id]);
  };
  const remove = (id: number) => setIds(requested.filter((x) => x !== id));
  const missing = requested.filter((id) => !games.some((g) => g.meta.placeId === id));

  const bar = (label: string, value: (g: GameSummary) => number | null, fmt: (v: number) => string) => (
    <Card>
      <CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
      <CardContent>
        <HorizontalBars
          data={games.map((g) => ({ label: g.meta.name.length > 16 ? `${g.meta.name.slice(0, 15)}…` : g.meta.name, value: value(g) ?? 0, color: colorOf(g.meta.placeId) }))}
          formatValue={fmt}
        />
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")}>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <GamePicker onAdd={add} disabled={requested.length >= MAX} />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIds(PRESET)}>Load example</Button>
              {requested.length > 0 && <Button variant="ghost" size="sm" onClick={() => setIds([])}>Clear</Button>}
              <CurrencySelect className="w-40" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {games.map((g) => (
              <span key={g.meta.placeId} className="inline-flex items-center gap-2 rounded-full border border-border bg-card-2 py-1 pl-1.5 pr-2 text-sm">
                <span className="size-3 rounded-full" style={{ background: colorOf(g.meta.placeId) }} aria-hidden />
                <GameIcon name={g.meta.name} url={g.meta.iconUrl} size={22} className="rounded-md" />
                {g.meta.name}
                <button type="button" onClick={() => remove(g.meta.placeId)} className="rounded-full p-0.5 text-muted hover:bg-bg hover:text-fg" aria-label={`Remove ${g.meta.name}`}>
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {Array.from({ length: Math.max(0, MAX - requested.length) }).map((_, i) => (
              <span key={i} className="inline-flex items-center rounded-full border border-dashed border-border px-3 py-1 text-xs text-subtle">Empty slot</span>
            ))}
          </div>
          {missing.length > 0 && <p className="text-xs text-warning">Not found{games[0]?.source === "demo" ? " in the demo dataset" : ""}: {missing.join(", ")}</p>}
        </CardContent>
      </Card>

      {games.length === 0 ? (
        <Card>
          <EmptyState
            title="Pick games to compare"
            description="Add up to four experiences, e.g. Grow a Garden vs Blox Fruits vs Brookhaven vs Adopt Me."
            action={<Button onClick={() => setIds(PRESET)}>Load example comparison</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-10 bg-card px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-subtle">Metric</th>
                    {games.map((g) => (
                      <th key={g.meta.placeId} className="px-4 py-4 text-left">
                        <Link href={`/games/${g.meta.placeId}`} className="flex items-center gap-2 font-medium hover:text-accent">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(g.meta.placeId) }} aria-hidden />
                          <span className="truncate">{g.meta.name}</span>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const values = games.map((g) => m.value(g));
                    const best = games.length > 1 && values.some((v) => v !== null) ? Math.max(...values.map((v) => v ?? -Infinity)) : null;
                    return (
                      <tr key={m.label} className="border-b border-border/60 last:border-0">
                        <th scope="row" className="sticky left-0 z-10 bg-card px-5 py-3 text-left text-xs font-medium text-muted">{m.label}</th>
                        {games.map((g, i) => (
                          <td key={g.meta.placeId} className="tabular px-4 py-3 text-fg">
                            <span className="inline-flex items-center gap-1.5">
                              {m.render(g)}
                              {best !== null && values[i] === best && <Crown className="size-3.5 text-warning" aria-label="Highest" />}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-5 py-3 text-xs text-subtle">
              <Crown className="mr-1 inline size-3 text-warning" aria-hidden />marks the highest value in each row. Revenue values are estimates, not official figures.
            </p>
          </Card>

          <PlayersOverlay games={games} colorOf={colorOf} />

          <div className="grid gap-6 md:grid-cols-2">
            {bar("Players online", (g) => g.stats.players, (v) => formatCompact(v))}
            {bar("Total visits", (g) => g.stats.visits, (v) => formatCompact(v))}
            {bar("Favorites", (g) => g.stats.favorites, (v) => formatCompact(v))}
            {bar("Est. monthly revenue (midpoint)", (g) => (g.revenue.status === "ok" ? g.revenue.monthly.mid : null), (v) => format(v))}
          </div>
        </>
      )}
    </div>
  );
}
