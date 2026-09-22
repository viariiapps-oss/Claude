import type { Metadata } from "next";
import { BadgeCheck, Building2, DollarSign, ExternalLink, Eye, Gamepad2, TrendingUp, User, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { Delta } from "@/components/common/delta";
import { GamesTable } from "@/components/common/games-table";
import { MoneyRangeText } from "@/components/common/money";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDeveloper } from "@/services/developers.service";
import { formatCompact, formatNumber } from "@/utils/format";

const load = cache(getDeveloper);
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dev = await load((await params).id);
  if (!dev) return { title: "Developer not found" };
  return {
    title: `${dev.name} — Roblox developer stats`,
    description: `${dev.name}: ${dev.gameCount} experiences, ${formatCompact(dev.totalVisits)} total visits, ${formatCompact(dev.totalPlayers)} players online.`,
    alternates: { canonical: `/developers/${dev.id}` },
  };
}

export default async function DeveloperPage({ params }: Props) {
  const dev = await load((await params).id);
  if (!dev) notFound();
  const robloxUrl = dev.type === "Group" ? `https://www.roblox.com/communities/${dev.robloxId}` : `https://www.roblox.com/users/${dev.robloxId}/profile`;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl border border-accent/30 bg-accent-soft text-accent">
              {dev.type === "Group" ? <Building2 className="size-7" /> : <User className="size-7" />}
            </div>
            <div>
              <div className="mb-1 flex flex-wrap gap-2">
                <DataSourceBadge source={dev.source} />
                <Badge>{dev.type === "Group" ? "Group" : "User"}</Badge>
                {dev.memberCount !== null && <Badge>{formatNumber(dev.memberCount)} members</Badge>}
              </div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {dev.name}
                {dev.hasVerifiedBadge && <BadgeCheck className="size-6 text-accent" aria-label="Verified" />}
              </h1>
              <p className="text-sm text-muted">Roblox {dev.type.toLowerCase()} ID {dev.robloxId}</p>
            </div>
          </div>
          <Button asChild variant="secondary">
            <a href={robloxUrl} target="_blank" rel="noopener noreferrer">View on Roblox <ExternalLink /></a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Games" value={String(dev.gameCount)} icon={<Gamepad2 />} />
        <StatCard label="Total visits" value={formatCompact(dev.totalVisits, 2)} icon={<Eye />} />
        <StatCard label="Players online" value={formatCompact(dev.totalPlayers, 2)} icon={<Users />} />
        <StatCard
          label="Est. revenue / mo"
          value={dev.estimatedMonthlyRevenue ? <MoneyRangeText range={dev.estimatedMonthlyRevenue} className="text-lg sm:text-xl" /> : "Insufficient data"}
          icon={<DollarSign />}
          hint="Sum of estimates for tracked games only. Not official revenue."
        />
        <StatCard label="Growth 7d" value={<Delta value={dev.growth7d} className="text-2xl [&_svg]:size-6" />} icon={<TrendingUp />} hint="Player-weighted average of tracked games." />
      </div>

      {dev.trackedGames.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Tracked experiences</CardTitle>
              <CardDescription>With history, growth and revenue estimates</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <GamesTable games={dev.trackedGames} />
          </CardContent>
        </Card>
      )}

      {dev.games.length > dev.trackedGames.length && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>All public experiences</CardTitle>
              <CardDescription>From Roblox&apos;s public creator games list</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <ul className="divide-y divide-border/60">
              {dev.games.map((g) => (
                <li key={g.universeId}>
                  <Link href={`/games/${g.placeId}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-card-2/60">
                    <span className="truncate font-medium">{g.name}</span>
                    <span className="tabular shrink-0 text-sm text-muted">
                      {formatCompact(g.players)} playing · {formatCompact(g.visits)} visits
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
