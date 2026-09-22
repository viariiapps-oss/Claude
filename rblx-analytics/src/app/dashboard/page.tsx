import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, Radio } from "lucide-react";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { GamesTable } from "@/components/common/games-table";
import { PageHeader } from "@/components/common/page-header";
import { GlobalStatsGrid } from "@/components/dashboard/global-stats-grid";
import { PlatformPlayersChart, PlayerShareBars } from "@/components/dashboard/platform-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDataStatus } from "@/services/data-status";
import { getGlobalStats, listGameSummaries } from "@/services/games.service";
import { rank } from "@/services/rankings.service";
import { formatDateTime } from "@/utils/format";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Players online, visits and estimated revenue across tracked Roblox experiences.",
};

export default async function DashboardPage() {
  const [{ games, source }, stats, status] = await Promise.all([listGameSummaries(), getGlobalStats(), getDataStatus()]);
  const share = rank(games, "most-played", 8).map((g) => ({ label: g.meta.name, value: g.stats.players ?? 0 }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Platform overview"
        description={`Aggregates across ${games.length} tracked experiences. Updated ${formatDateTime(stats.updatedAt)}.`}
        actions={<DataSourceBadge source={source} reason={status.reason} />}
      />
      <GlobalStatsGrid stats={stats} />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Players online · last 7 days</CardTitle>
              <CardDescription>Sum of concurrent players across tracked experiences, 6-hour averages</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PlatformPlayersChart series={stats.playersOnline.series} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Where players are now</CardTitle>
              <CardDescription>Top 8 experiences by concurrent players</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PlayerShareBars rows={share} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Fastest growing · 7d</CardTitle>
              <CardDescription>Average players vs the previous 7 days</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href="/trending?tab=fastest-growing">View all <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <GamesTable games={rank(games, "fastest-growing", 6)} columns={["players", "growth7d", "revenue"]} showRank highlight="growth7d" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Highest estimated revenue</CardTitle>
              <CardDescription>Monthly range, estimated — not official</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href="/revenue">Methodology <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <GamesTable games={rank(games, "highest-revenue", 6)} columns={["players", "growth7d", "revenue"]} showRank highlight="revenue" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-border bg-card-2 text-muted">
              {status.storage === "postgres" ? <Database className="size-5" /> : <Radio className="size-5" />}
            </div>
            <div>
              <p className="font-medium">Data status</p>
              <p className="text-sm text-muted">
                Mode <span className="text-fg">{status.mode}</span> · serving <span className="text-fg">{status.activeSource}</span> data · storage{" "}
                <span className="text-fg">{status.storage === "postgres" ? "PostgreSQL" : "in-memory (not persistent)"}</span>
              </p>
              <p className="mt-0.5 text-xs text-subtle">{status.reason}</p>
            </div>
          </div>
          <Button asChild variant="secondary" size="sm"><Link href="/about#data">How data works</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
