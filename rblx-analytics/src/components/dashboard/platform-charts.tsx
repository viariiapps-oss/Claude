"use client";

import { HorizontalBars } from "@/components/charts/bar-chart";
import { CHART } from "@/components/charts/chart-theme";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { EmptyState } from "@/components/common/states";
import { formatCompact, formatNumber } from "@/utils/format";

export function PlatformPlayersChart({ series }: { series: { t: string; v: number }[] }) {
  if (series.length < 2) {
    return (
      <EmptyState
        title="Collecting data"
        description="Player history appears here after the refresh job has stored a few snapshots (every 5 minutes)."
      />
    );
  }
  return (
    <TimeSeriesChart
      data={series.map((p) => ({ t: p.t, players: p.v }))}
      series={[{ key: "players", label: "Players online", color: CHART.accent }]}
      formatValue={(v) => formatNumber(v)}
      formatTick={(v) => formatCompact(v)}
      height={280}
    />
  );
}

export function PlayerShareBars({ rows }: { rows: { label: string; value: number }[] }) {
  return <HorizontalBars data={rows} formatValue={(v) => formatCompact(v)} />;
}
