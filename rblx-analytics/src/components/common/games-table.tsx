"use client";

import { BadgeCheck, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Delta } from "@/components/common/delta";
import { GameIcon } from "@/components/common/game-icon";
import { RevenueCell } from "@/components/common/money";
import { cn } from "@/lib/utils";
import type { GameSummary } from "@/types";
import { formatCompact, formatNumber, likeRatio } from "@/utils/format";

export type GamesTableColumn = "players" | "visits" | "likes" | "growth24h" | "growth7d" | "revenue";

const HEADERS: Record<GamesTableColumn, string> = {
  players: "Players",
  visits: "Visits",
  likes: "Likes",
  growth24h: "Growth 24h",
  growth7d: "Growth 7d",
  revenue: "Est. Revenue / mo",
};

function Cell({ game, col }: { game: GameSummary; col: GamesTableColumn }) {
  switch (col) {
    case "players":
      return <span className="tabular text-fg">{formatNumber(game.stats.players)}</span>;
    case "visits":
      return <span className="tabular text-fg">{formatCompact(game.stats.visits)}</span>;
    case "likes": {
      const ratio = likeRatio(game.stats.likes, game.stats.dislikes);
      return (
        <span className="tabular inline-flex items-center gap-1.5 text-fg">
          {formatCompact(game.stats.likes)}
          {ratio !== null && <span className="text-xs text-muted">({Math.round(ratio * 100)}%)</span>}
        </span>
      );
    }
    case "growth24h":
      return <Delta value={game.growth.players24h} />;
    case "growth7d":
      return <Delta value={game.growth.players7d} />;
    case "revenue":
      return <RevenueCell revenue={game.revenue} />;
  }
}

export function GamesTable({
  games,
  columns = ["players", "visits", "likes", "growth7d", "revenue"],
  showRank = false,
  rankOffset = 0,
  highlight,
}: {
  games: GameSummary[];
  columns?: GamesTableColumn[];
  showRank?: boolean;
  rankOffset?: number;
  highlight?: GamesTableColumn;
}) {
  const router = useRouter();
  return (
    <>
      {/* Desktop / tablet: table with horizontal scroll fallback */}
      <div className="hidden overflow-x-auto md:block">
        <table className={cn("w-full text-sm", columns.length > 3 ? "min-w-[760px]" : "min-w-[480px]")}>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-subtle">
              {showRank && <th className="w-12 px-4 py-3 font-medium">#</th>}
              <th className="px-4 py-3 font-medium">Game</th>
              {columns.map((c) => (
                <th key={c} className={cn("px-4 py-3 text-right font-medium", highlight === c && "text-accent")}>
                  {HEADERS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {games.map((g, i) => (
              <tr
                key={g.meta.placeId}
                onClick={() => router.push(`/games/${g.meta.placeId}`)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-card-2/70"
              >
                {showRank && <td className="tabular px-4 py-3 text-muted">{rankOffset + i + 1}</td>}
                <td className="px-4 py-3">
                  <Link href={`/games/${g.meta.placeId}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <GameIcon name={g.meta.name} url={g.meta.iconUrl} size={36} />
                    <div className="min-w-0">
                      <p className="max-w-[220px] truncate font-medium text-fg hover:text-accent">{g.meta.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted">
                        {g.meta.creator.name}
                        {g.meta.creator.hasVerifiedBadge && <BadgeCheck className="size-3 text-accent" aria-label="Verified creator" />}
                        {g.meta.genre && <span className="text-subtle">· {g.meta.genre}</span>}
                      </p>
                    </div>
                  </Link>
                </td>
                {columns.map((c) => (
                  <td key={c} className="px-4 py-3 text-right">
                    <Cell game={g} col={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <ul className="divide-y divide-border/60 md:hidden">
        {games.map((g, i) => (
          <li key={g.meta.placeId}>
            <Link href={`/games/${g.meta.placeId}`} className="flex gap-3 px-4 py-3.5 active:bg-card-2">
              {showRank && <span className="tabular w-5 pt-2 text-xs text-muted">{rankOffset + i + 1}</span>}
              <GameIcon name={g.meta.name} url={g.meta.iconUrl} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium text-fg">{g.meta.name}</p>
                  <Delta value={g.growth.players24h ?? g.growth.players7d} />
                </div>
                <p className="truncate text-xs text-muted">{g.meta.creator.name}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-subtle">Players</p>
                    <p className="tabular text-fg">{formatCompact(g.stats.players)}</p>
                  </div>
                  <div>
                    <p className="text-subtle">Visits</p>
                    <p className="tabular text-fg">{formatCompact(g.stats.visits)}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-subtle">
                      <ThumbsUp className="size-3" aria-hidden /> Likes
                    </p>
                    <p className="tabular text-fg">{formatCompact(g.stats.likes)}</p>
                  </div>
                </div>
                {columns.includes("revenue") && (
                  <div className="mt-2 text-xs">
                    <span className="text-subtle">Est. revenue / mo: </span>
                    <RevenueCell revenue={g.revenue} />
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
