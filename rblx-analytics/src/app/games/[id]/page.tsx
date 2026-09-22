import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { GameStatGrid } from "@/components/games/game-stat-grid";
import { GameHeader } from "@/components/games/game-header";
import { GrowthChartCard, PlayersChartCard, VisitsChartCard } from "@/components/games/game-charts";
import { CurrencyConverter } from "@/components/revenue/currency-converter";
import { MethodologySection } from "@/components/revenue/methodology-section";
import { RevenuePanel } from "@/components/revenue/revenue-panel";
import { siteConfig } from "@/config/site";
import { getGameDetailCached } from "@/services/cached";
import { formatCompact } from "@/utils/format";
import { parsePositiveId } from "@/utils/ids";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parsePositiveId((await params).id);
  if (!id) return { title: "Game not found" };
  const r = await getGameDetailCached(id);
  if (r.status !== "ok") return { title: "Game not found", robots: { index: false } };
  const g = r.game;
  const title = `${g.meta.name} — Roblox stats, players & estimated revenue`;
  const description = `${g.meta.name} by ${g.meta.creator.name}: ${formatCompact(g.stats.players)} players online, ${formatCompact(g.stats.visits)} visits, ${formatCompact(g.stats.favorites)} favorites. Player history, growth and estimated revenue.`;
  return {
    title,
    description,
    alternates: { canonical: `/games/${g.meta.placeId}` },
    openGraph: { title, description, url: `/games/${g.meta.placeId}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    robots: g.source === "demo" ? { index: false, follow: true } : undefined,
  };
}

export default async function GamePage({ params }: Props) {
  const id = parsePositiveId((await params).id);
  if (!id) notFound();
  const r = await getGameDetailCached(id);
  if (r.status === "redirect") permanentRedirect(`/games/${r.placeId}`);
  if (r.status === "not-found") notFound();
  const game = r.game;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.meta.name,
    url: `${siteConfig.url}/games/${game.meta.placeId}`,
    sameAs: `https://www.roblox.com/games/${game.meta.placeId}`,
    author: { "@type": game.meta.creator.type === "Group" ? "Organization" : "Person", name: game.meta.creator.name },
    genre: game.meta.genre ?? undefined,
    gamePlatform: "Roblox",
    dateCreated: game.meta.createdAt ?? undefined,
    dateModified: game.meta.updatedAt ?? undefined,
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <GameHeader game={game} />
      <GameStatGrid game={game} />
      <PlayersChartCard placeId={game.meta.placeId} />
      <div className="grid gap-6 xl:grid-cols-2">
        <VisitsChartCard placeId={game.meta.placeId} />
        <GrowthChartCard placeId={game.meta.placeId} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <RevenuePanel estimate={game.revenue} />
        <CurrencyConverter />
      </div>
      <MethodologySection />
    </div>
  );
}
