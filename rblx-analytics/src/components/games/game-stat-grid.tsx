import { Eye, Heart, Percent, ThumbsUp, TrendingUp, Users } from "lucide-react";
import { Delta } from "@/components/common/delta";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { GameDetail } from "@/types";
import { formatCompact, formatDate, formatNumber, formatPercent } from "@/utils/format";

function Stat({
  label,
  value,
  icon: Icon,
  sub,
  title,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  sub?: React.ReactNode;
  title?: string;
}) {
  const body = (
    <Card className="p-4 sm:p-5" tabIndex={title ? 0 : undefined}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        <Icon className="size-4 text-accent" aria-hidden />
      </div>
      <p className="tabular mt-2 truncate text-xl font-semibold tracking-tight text-fg sm:text-2xl">{value}</p>
      {sub && <div className="mt-1 min-h-4 text-xs text-subtle">{sub}</div>}
    </Card>
  );
  return title ? <Tooltip content={title}>{body}</Tooltip> : body;
}

export function GameStatGrid({ game }: { game: GameDetail }) {
  const { stats, growth, peak } = game;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <Stat label="Current players" value={formatNumber(stats.players)} icon={Users} sub={<Delta value={growth.players24h} />} title="Concurrent players now. Change: average of the last 24h vs the previous 24h." />
      <Stat
        label="Peak players"
        value={formatNumber(peak.peakPlayers)}
        icon={TrendingUp}
        sub={peak.peakAt ? `on ${formatDate(peak.peakAt)}` : "No history yet"}
        title={peak.trackedSince ? `Highest value we recorded since ${formatDate(peak.trackedSince)}. Roblox does not publish all-time peaks.` : "Peaks are computed from stored history."}
      />
      <Stat label="Total visits" value={formatCompact(stats.visits, 2)} icon={Eye} sub={growth.visitsGained24h !== null ? `+${formatCompact(growth.visitsGained24h)} in 24h` : undefined} />
      <Stat label="Favorites" value={formatCompact(stats.favorites, 2)} icon={Heart} sub={<Delta value={growth.favorites7d} digits={2} />} title="Change over 7 days." />
      <Stat label="Likes" value={formatCompact(stats.likes, 2)} icon={ThumbsUp} sub={stats.dislikes !== null ? `${formatCompact(stats.dislikes)} dislikes` : undefined} />
      <Stat label="Like ratio" value={game.likeRatio !== null ? formatPercent(game.likeRatio * 100, 1, false) : "—"} icon={Percent} sub="likes / (likes + dislikes)" />
    </div>
  );
}
