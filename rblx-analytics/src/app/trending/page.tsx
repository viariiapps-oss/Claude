import type { Metadata } from "next";
import { Info } from "lucide-react";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { GamesTable, type GamesTableColumn } from "@/components/common/games-table";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { RankingTabs } from "@/components/trending/ranking-tabs";
import { Card } from "@/components/ui/card";
import { getRankings, RANKINGS, type RankingKey } from "@/services/rankings.service";

export const metadata: Metadata = {
  title: "Trending Roblox Games",
  description: "Roblox experiences ranked by player growth, concurrent players, visits and estimated revenue.",
};

const HIGHLIGHT: Record<RankingKey, GamesTableColumn> = {
  trending: "growth24h",
  "most-played": "players",
  "most-visited": "visits",
  "fastest-growing": "growth7d",
  "highest-revenue": "revenue",
};

export default async function TrendingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const { source, rankings } = await getRankings(50);
  const keys = Object.keys(RANKINGS) as RankingKey[];
  const initial = keys.includes(tab as RankingKey) ? (tab as RankingKey) : "trending";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rankings"
        title="Trending games"
        description="Leaderboards for individual metrics across tracked experiences."
        actions={<DataSourceBadge source={source} />}
      />
      <p className="flex items-start gap-2 rounded-xl border border-border bg-card-2/60 px-4 py-3 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        Each ranking reflects one metric only. A higher position is not a judgement of a game&apos;s quality.
      </p>
      <RankingTabs
        initial={initial}
        tabs={keys.map((k) => ({
          value: k,
          label: RANKINGS[k].title,
          content: (
            <Card className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="font-medium text-fg">
                  {RANKINGS[k].title} <span className="text-sm font-normal text-muted">· ranked by {RANKINGS[k].metric.toLowerCase()}</span>
                </p>
                <p className="mt-0.5 text-sm text-muted">{RANKINGS[k].description}</p>
              </div>
              {rankings[k].length === 0 ? (
                <EmptyState title="Not enough data yet" description="Growth rankings need at least 48 hours of stored history." />
              ) : (
                <GamesTable
                  games={rankings[k]}
                  columns={["players", "growth24h", "growth7d", "visits", "revenue"]}
                  showRank
                  highlight={HIGHLIGHT[k]}
                />
              )}
            </Card>
          ),
        }))}
      />
    </div>
  );
}
