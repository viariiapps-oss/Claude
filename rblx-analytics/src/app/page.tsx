import { ArrowRight, BarChart3, Flame, GitCompareArrows, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { GamesTable } from "@/components/common/games-table";
import { GlobalStatsGrid } from "@/components/dashboard/global-stats-grid";
import { HeroSearch } from "@/components/home/hero-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGlobalStats, listGameSummaries } from "@/services/games.service";
import { rank } from "@/services/rankings.service";

export default async function HomePage() {
  const [{ games, source }, stats] = await Promise.all([listGameSummaries(), getGlobalStats()]);
  const trending = rank(games, "trending", 5);
  const mostPlayed = rank(games, "most-played", 5);

  return (
    <div className="space-y-14">
      <section className="relative -mx-4 -mt-6 overflow-hidden px-4 pb-6 pt-14 text-center sm:-mx-6 sm:-mt-10 sm:px-6 sm:pt-20">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative animate-fade-in">
          <div className="mb-5 flex justify-center">
            <DataSourceBadge source={source} />
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-fg sm:text-6xl">
            Roblox Game{" "}
            <span className="bg-gradient-to-r from-[#7cc0ff] via-accent to-[#8b8dff] bg-clip-text text-transparent">Intelligence</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            Explore player activity, visits, growth and estimated revenue across Roblox experiences.
          </p>
          <div className="mt-9">
            <HeroSearch />
          </div>
        </div>
      </section>

      <section aria-labelledby="overview">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="overview" className="text-lg font-semibold tracking-tight">Platform overview</h2>
            <p className="text-sm text-muted">Across all tracked experiences</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              Open dashboard <ArrowRight />
            </Link>
          </Button>
        </div>
        <GlobalStatsGrid stats={stats} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><Flame className="size-4 text-accent" /> Trending now</CardTitle>
              <CardDescription>Largest 24h change in average players</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href="/trending">All rankings <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <GamesTable games={trending} columns={["players", "growth24h", "revenue"]} showRank highlight="growth24h" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Most played</CardTitle>
              <CardDescription>Concurrent players right now</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href="/games">Explore games <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <GamesTable games={mostPlayed} columns={["players", "visits", "revenue"]} showRank highlight="players" />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { href: "/compare", icon: GitCompareArrows, title: "Compare up to 4 games", body: "Players, visits, growth and revenue estimates side by side." },
          { href: "/revenue", icon: BarChart3, title: "Revenue estimator", body: "Tune the assumptions and see ranges update in any currency." },
          { href: "/about#methodology", icon: ShieldCheck, title: "Transparent methodology", body: "Every estimate shows its inputs, range and confidence." },
        ].map(({ href, icon: Icon, title, body }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full p-6 transition-all group-hover:-translate-y-0.5 group-hover:border-accent/40">
              <Icon className="size-5 text-accent" aria-hidden />
              <p className="mt-4 font-medium text-fg">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
