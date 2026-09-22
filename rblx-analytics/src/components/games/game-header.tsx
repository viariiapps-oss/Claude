/* eslint-disable @next/next/no-img-element -- Roblox CDN thumbnails */
import { BadgeCheck, ExternalLink, GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { GameIcon } from "@/components/common/game-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GameDetail } from "@/types";
import { formatDate, formatNumber } from "@/utils/format";
import { developerId } from "@/utils/ids";

export function GameHeader({ game }: { game: GameDetail }) {
  const { meta, stats } = game;
  const active = (stats.players ?? 0) > 0;
  const facts: [string, React.ReactNode][] = [
    ["Creator", <Link key="c" href={`/developers/${developerId(meta.creator.type, meta.creator.id)}`} className="text-accent hover:underline">{meta.creator.name}</Link>],
    ["Group", meta.creator.type === "Group" ? meta.creator.name : <span key="g" className="text-subtle">— (user-owned)</span>],
    ["Roblox Game ID", <span key="p" className="tabular">{meta.placeId}</span>],
    ["Universe ID", <span key="u" className="tabular">{meta.universeId}</span>],
    ["Created", formatDate(meta.createdAt)],
    ["Updated", formatDate(meta.updatedAt)],
    ["Genre", meta.genre ?? "—"],
    ["Server size", meta.maxPlayers ? `${formatNumber(meta.maxPlayers)} players` : "—"],
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative h-36 sm:h-52">
        {meta.thumbnailUrl ? (
          <img src={meta.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(80%_120%_at_20%_0%,rgb(77_163_255/0.35),transparent_60%),radial-gradient(60%_100%_at_100%_100%,rgb(139_141_255/0.25),transparent_60%)]" />
        )}
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
      </div>
      <div className="relative -mt-16 px-5 pb-6 sm:-mt-20 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <GameIcon name={meta.name} url={meta.iconUrl} size={112} className="rounded-2xl shadow-2xl ring-4 ring-card" />
            <div className="min-w-0 pb-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <DataSourceBadge source={game.source} />
                <Badge variant={active ? "success" : "default"}>{active ? "Active" : "No players online"}</Badge>
                {meta.genre && <Badge>{meta.genre}</Badge>}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-4xl">{meta.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                by {meta.creator.name}
                {meta.creator.hasVerifiedBadge && <BadgeCheck className="size-4 text-accent" aria-label="Verified" />}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/compare?ids=${meta.placeId}`}>
                <GitCompareArrows /> Compare
              </Link>
            </Button>
            <Button asChild>
              <a href={`https://www.roblox.com/games/${meta.placeId}`} target="_blank" rel="noopener noreferrer">
                Open on Roblox <ExternalLink />
              </a>
            </Button>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-5 text-sm sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-subtle">{k}</dt>
              <dd className="mt-0.5 truncate text-fg">{v}</dd>
            </div>
          ))}
        </dl>
        {meta.description && (
          <p className="mt-5 line-clamp-3 max-w-3xl whitespace-pre-line text-sm text-muted">{meta.description}</p>
        )}
      </div>
    </section>
  );
}
