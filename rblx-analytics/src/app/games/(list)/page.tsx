import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { GamesTable } from "@/components/common/games-table";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { EmptyState } from "@/components/common/states";
import { ExplorerFilters } from "@/components/games/explorer-filters";
import { Card } from "@/components/ui/card";
import { applyExplorer, explorerSchema, genresOf } from "@/lib/explorer";
import { listGameSummaries } from "@/services/games.service";

export const metadata: Metadata = {
  title: "Game Explorer",
  description: "Search and filter Roblox experiences by players, visits, growth, genre and estimated revenue.",
};

export default async function GamesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = explorerSchema.safeParse(raw);
  const params = parsed.success ? parsed.data : explorerSchema.parse({});
  const { games, source } = await listGameSummaries();
  const result = applyExplorer(games, params);

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
    sp.set("page", String(p));
    return `/games?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Game Explorer"
        title="Explore Roblox games"
        description="Filter tracked experiences by genre, players, visits, growth, dates and estimated revenue. Search by a Roblox game ID or URL to look up any public experience."
        actions={<DataSourceBadge source={source} />}
      />
      <ExplorerFilters genres={genresOf(games)} total={result.total} />
      {!parsed.success && <p className="text-xs text-warning">Some filters were invalid and have been ignored.</p>}
      <Card className="overflow-hidden">
        {result.games.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No games match these filters"
            description={
              params.q && /^\d+$/.test(params.q)
                ? "This ID is not in the tracked set. Use the search button (⌘K) to look it up directly."
                : "Try widening the filters or clearing the search."
            }
          />
        ) : (
          <>
            <GamesTable games={result.games} showRank rankOffset={(result.page - 1) * result.pageSize} />
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={hrefFor} />
          </>
        )}
      </Card>
    </div>
  );
}
