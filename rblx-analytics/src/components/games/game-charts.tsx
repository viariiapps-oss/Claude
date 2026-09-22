"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Table2, LineChart as LineIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { SimpleBarChart } from "@/components/charts/bar-chart";
import { CHART, seriesColor } from "@/components/charts/chart-theme";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Delta } from "@/components/common/delta";
import { EmptyState, ErrorState, Notice } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoryPoint, HistoryRange, HistoryResponse } from "@/types";
import { formatCompact, formatNumber, formatPercent } from "@/utils/format";

async function fetchHistory(placeId: number, range: HistoryRange): Promise<HistoryResponse> {
  const res = await fetch(`/api/games/${placeId}/history?range=${range}`);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? `HTTP ${res.status}`);
  return res.json();
}

export function useHistory(placeId: number, range: HistoryRange) {
  return useQuery({ queryKey: ["history", placeId, range], queryFn: () => fetchHistory(placeId, range), staleTime: 60_000 });
}

const RANGES = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
] as const;

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}

/** Collapses points into one per UTC day: mean players, last cumulative values. */
function toDaily(points: HistoryPoint[]): HistoryPoint[] {
  const days = new Map<string, { sum: number; n: number; last: HistoryPoint }>();
  for (const p of points) {
    const key = p.t.slice(0, 10);
    const d = days.get(key) ?? { sum: 0, n: 0, last: p };
    if (p.players !== null) {
      d.sum += p.players;
      d.n += 1;
    }
    d.last = p;
    days.set(key, d);
  }
  // Drop partial days (first/last bucket of the range) so they don't skew averages or baselines.
  const counts = [...days.values()].map((d) => d.n).sort((a, b) => a - b);
  const typical = counts[Math.floor(counts.length / 2)] ?? 0;
  const entries = [...days.entries()].filter(([, d], i, arr) => !((i === 0 || i === arr.length - 1) && d.n < typical * 0.75));
  return entries.map(([k, d]) => ({
    t: `${k}T00:00:00.000Z`,
    players: d.n ? Math.round(d.sum / d.n) : null,
    visits: d.last.visits,
    favorites: d.last.favorites,
    likes: d.last.likes,
  }));
}

function DataTable({ rows, columns }: { rows: Record<string, string>[]; columns: { key: string; label: string }[] }) {
  return (
    <div className="max-h-[280px] overflow-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card-2">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left text-xs font-medium text-muted">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              {columns.map((c) => (
                <td key={c.key} className="tabular px-3 py-1.5 text-fg">{r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViewToggle({ table, onChange }: { table: boolean; onChange: (t: boolean) => void }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={() => onChange(!table)} aria-label={table ? "Show chart" : "Show data table"} title={table ? "Show chart" : "Show data table"}>
      {table ? <LineIcon /> : <Table2 />}
    </Button>
  );
}

function QueryStates({ isLoading, error, refetch, height }: { isLoading: boolean; error: unknown; refetch: () => void; height?: number }) {
  if (isLoading) return <ChartSkeleton height={height} />;
  if (error)
    return (
      <ErrorState
        title="Could not load history"
        description={(error as Error).message}
        action={<Button variant="secondary" size="sm" onClick={refetch}><RefreshCw /> Retry</Button>}
      />
    );
  return null;
}

// ─── Players ──────────────────────────────────────────────────────────────────

export function PlayersChartCard({ placeId }: { placeId: number }) {
  const [range, setRange] = useState<HistoryRange>("7d");
  const [table, setTable] = useState(false);
  const { data, isLoading, error, refetch } = useHistory(placeId, range);
  const points = data?.points.filter((p) => p.players !== null) ?? [];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Concurrent players</CardTitle>
          <CardDescription>Average players per interval (UTC)</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Segmented label="Time range" options={RANGES} value={range} onChange={setRange} />
          <ViewToggle table={table} onChange={setTable} />
        </div>
      </CardHeader>
      <CardContent>
        {data?.notice && <div className="mb-3"><Notice>{data.notice}</Notice></div>}
        <QueryStates isLoading={isLoading} error={error} refetch={() => void refetch()} />
        {data && points.length === 0 && <EmptyState title="No player history yet" description="Snapshots are stored every 5 minutes once the game is tracked." />}
        {data && points.length > 0 &&
          (table ? (
            <DataTable
              columns={[{ key: "t", label: "Time (UTC)" }, { key: "players", label: "Players" }]}
              rows={[...points].reverse().map((p) => ({ t: new Date(p.t).toISOString().slice(0, 16).replace("T", " "), players: formatNumber(p.players) }))}
            />
          ) : (
            <TimeSeriesChart
              data={points.map((p) => ({ t: p.t, players: p.players }))}
              series={[{ key: "players", label: "Players", color: CHART.accent }]}
              formatValue={(v) => formatNumber(v)}
              formatTick={(v) => formatCompact(v)}
            />
          ))}
      </CardContent>
    </Card>
  );
}

// ─── Visits ───────────────────────────────────────────────────────────────────

const GRAIN = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;
type Grain = (typeof GRAIN)[number]["value"];
const GRAIN_RANGE: Record<Grain, HistoryRange> = { daily: "30d", weekly: "90d", monthly: "1y" };

function periodKey(t: string, grain: Grain): string {
  const d = new Date(t);
  if (grain === "daily") return t.slice(0, 10);
  if (grain === "monthly") return t.slice(0, 7);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return monday.toISOString().slice(0, 10);
}

function periodLabel(key: string, grain: Grain): string {
  const d = new Date(grain === "monthly" ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`);
  return grain === "monthly"
    ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Visits gained per period, derived from the cumulative counter. Incomplete first period is dropped. */
export function visitsPerPeriod(points: HistoryPoint[], grain: Grain) {
  const lastByPeriod = new Map<string, number>();
  for (const p of points) if (p.visits !== null) lastByPeriod.set(periodKey(p.t, grain), p.visits);
  const keys = [...lastByPeriod.keys()].sort();
  const out: { key: string; label: string; value: number }[] = [];
  for (let i = 1; i < keys.length; i++) {
    const gained = lastByPeriod.get(keys[i])! - lastByPeriod.get(keys[i - 1])!;
    if (gained >= 0) out.push({ key: keys[i], label: periodLabel(keys[i], grain), value: gained });
  }
  return out;
}

export function VisitsChartCard({ placeId }: { placeId: number }) {
  const [grain, setGrain] = useState<Grain>("daily");
  const [table, setTable] = useState(false);
  const { data, isLoading, error, refetch } = useHistory(placeId, GRAIN_RANGE[grain]);
  const bars = useMemo(() => (data ? visitsPerPeriod(data.points, grain) : []), [data, grain]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Visits gained</CardTitle>
          <CardDescription>New visits per {grain === "daily" ? "day" : grain === "weekly" ? "week (Mon–Sun)" : "month"}; latest period may be partial</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Segmented label="Granularity" options={GRAIN} value={grain} onChange={setGrain} />
          <ViewToggle table={table} onChange={setTable} />
        </div>
      </CardHeader>
      <CardContent>
        <QueryStates isLoading={isLoading} error={error} refetch={() => void refetch()} height={260} />
        {data && bars.length === 0 && (
          <EmptyState title="Not enough history" description="At least two periods of stored visit counts are needed to compute visits gained." />
        )}
        {data && bars.length > 0 &&
          (table ? (
            <DataTable
              columns={[{ key: "label", label: "Period" }, { key: "value", label: "Visits gained" }]}
              rows={[...bars].reverse().map((b) => ({ label: b.label, value: formatNumber(b.value) }))}
            />
          ) : (
            <SimpleBarChart data={bars} formatValue={(v) => formatNumber(v)} formatTick={(v) => formatCompact(v)} />
          ))}
      </CardContent>
    </Card>
  );
}

// ─── Growth ───────────────────────────────────────────────────────────────────

const GROWTH_RANGES = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
] as const;

const GROWTH_SERIES = [
  { key: "players", label: "Players (daily avg.)", color: seriesColor(0) },
  { key: "visits", label: "Visits", color: seriesColor(1) },
  { key: "favorites", label: "Favorites", color: seriesColor(2) },
] as const;

/** Indexes each metric to 0 % at the start of the period so they share one axis. */
export function indexGrowth(points: HistoryPoint[]) {
  const daily = toDaily(points);
  const base: Record<string, number | null> = { players: null, visits: null, favorites: null };
  for (const k of ["players", "visits", "favorites"] as const) base[k] = daily.find((p) => p[k] !== null && p[k] !== 0)?.[k] ?? null;
  const rows = daily.map((p) => {
    const row: { t: string } & Record<string, number | null | string> = { t: p.t };
    for (const k of ["players", "visits", "favorites"] as const) {
      const b = base[k];
      row[k] = b && p[k] !== null ? ((p[k]! - b) / b) * 100 : null;
    }
    return row;
  });
  const last = rows[rows.length - 1];
  return {
    rows,
    totals: {
      players: (last?.players as number | null) ?? null,
      visits: (last?.visits as number | null) ?? null,
      favorites: (last?.favorites as number | null) ?? null,
    },
  };
}

export function GrowthChartCard({ placeId }: { placeId: number }) {
  const [range, setRange] = useState<HistoryRange>("30d");
  const { data, isLoading, error, refetch } = useHistory(placeId, range);
  const growth = useMemo(() => (data ? indexGrowth(data.points) : null), [data]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Growth</CardTitle>
          <CardDescription>% change since the start of the period (indexed, one axis)</CardDescription>
        </div>
        <Segmented label="Growth period" options={GROWTH_RANGES} value={range} onChange={setRange} />
      </CardHeader>
      <CardContent>
        <QueryStates isLoading={isLoading} error={error} refetch={() => void refetch()} height={260} />
        {growth && growth.rows.length < 2 && (
          <EmptyState title="Not enough history" description="Growth needs at least two days of stored data." />
        )}
        {growth && growth.rows.length >= 2 && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              {GROWTH_SERIES.map((s) => (
                <div key={s.key} className="rounded-xl border border-border bg-card-2/60 p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                    {s.label.replace(" (daily avg.)", "")}
                  </p>
                  <Delta value={growth.totals[s.key]} className="mt-1 text-base" digits={2} />
                </div>
              ))}
            </div>
            <TimeSeriesChart
              variant="line"
              data={growth.rows}
              series={[...GROWTH_SERIES]}
              formatValue={(v) => formatPercent(v, 2)}
              formatTick={(v) => formatPercent(v, 0)}
              height={240}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
