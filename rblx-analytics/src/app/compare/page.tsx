import type { Metadata } from "next";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { PageHeader } from "@/components/common/page-header";
import { CompareView } from "@/components/compare/compare-view";
import { getDataStatus } from "@/services/data-status";
import { getSummariesForPlaceIds } from "@/services/games.service";

export const metadata: Metadata = {
  title: "Compare Roblox Games",
  description: "Compare up to four Roblox experiences: players, visits, favorites, likes, growth and estimated revenue.",
};

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const raw = (await searchParams).ids ?? "";
  const ids = [...new Set(raw.split(",").filter((s) => /^\d{1,20}$/.test(s)).map(Number))].slice(0, 4);
  const [games, status] = await Promise.all([getSummariesForPlaceIds(ids), getDataStatus()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compare"
        title="Game comparison"
        description="Select up to four experiences and compare them side by side."
        actions={<DataSourceBadge source={status.activeSource} />}
      />
      <CompareView games={games} requested={ids} />
    </div>
  );
}
