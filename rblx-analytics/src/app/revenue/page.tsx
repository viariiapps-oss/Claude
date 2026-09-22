import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { PageHeader } from "@/components/common/page-header";
import { CurrencyConverter } from "@/components/revenue/currency-converter";
import { MethodologySection } from "@/components/revenue/methodology-section";
import { RevenueExplorer, type EstimatorRow } from "@/components/revenue/revenue-explorer";
import { listGameSummaries } from "@/services/games.service";

export const metadata: Metadata = {
  title: "Estimated Revenue",
  description: "Transparent, configurable revenue estimates for Roblox experiences — ranges with confidence levels, never presented as official figures.",
};

export default async function RevenuePage() {
  const { games, source } = await listGameSummaries();
  const rows: EstimatorRow[] = games.map((g) => ({
    placeId: g.meta.placeId,
    name: g.meta.name,
    iconUrl: g.meta.iconUrl,
    input:
      g.revenue.status === "ok"
        ? {
            avgPlayers: g.revenue.inputs.avgPlayers,
            window: g.revenue.inputs.avgPlayersWindow,
            genre: g.meta.genre,
            gamePassCount: g.revenue.inputs.gamePassCount,
            historySamples: g.revenue.inputs.historySamples,
            coverageHours7d: g.revenue.inputs.historyCoverageHours,
            source: g.source,
          }
        : { avgPlayers: g.stats.players, window: "current", genre: g.meta.genre, gamePassCount: null, historySamples: 0, coverageHours7d: 0, source: g.source },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Revenue"
        title="Estimated revenue analytics"
        description="Model-based ranges of creator earnings for tracked experiences, with every assumption exposed and adjustable."
        actions={<DataSourceBadge source={source} />}
      />
      <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm">
        <Scale className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <p className="text-muted">
          <strong className="text-warning">Estimated Revenue ≠ Official Revenue.</strong> Roblox does not publish per-experience earnings. These are estimates of
          creator earnings (USD at the DevEx rate) derived from public engagement data. Use them for relative comparison, not as financial facts.
        </p>
      </div>
      <RevenueExplorer rows={rows} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <MethodologySection />
        <CurrencyConverter />
      </div>
    </div>
  );
}

