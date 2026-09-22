"use client";

import { DollarSign, Eye, Gamepad2, Users } from "lucide-react";
import { MoneyRangeText } from "@/components/common/money";
import type { GlobalStats } from "@/types";
import { formatCompact } from "@/utils/format";
import { StatCard } from "./stat-card";

export function GlobalStatsGrid({ stats }: { stats: GlobalStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total Games Tracked"
        value={stats.gamesTracked.toLocaleString("en-US")}
        icon={<Gamepad2 />}
        hint="Experiences in the tracked set. Add more from the admin panel (live mode)."
        footer="Experiences refreshed every 5 minutes"
      />
      <StatCard
        label="Total Players Online"
        value={formatCompact(stats.playersOnline.value, 2)}
        icon={<Users />}
        changePct={stats.playersOnline.changePct}
        changeLabel={stats.playersOnline.changeLabel}
        series={stats.playersOnline.series}
        hint="Sum of concurrent players across tracked experiences (not all of Roblox)."
      />
      <StatCard
        label="Total Visits"
        value={formatCompact(stats.totalVisits.value, 2)}
        icon={<Eye />}
        changePct={stats.totalVisits.changePct}
        changeLabel={stats.totalVisits.changeLabel}
        series={stats.totalVisits.series}
        hint="All-time visits reported by Roblox, summed across tracked experiences."
      />
      <StatCard
        label="Est. Monthly Revenue"
        value={
          stats.estimatedMonthlyRevenue.range ? (
            <MoneyRangeText range={stats.estimatedMonthlyRevenue.range} className="text-xl sm:text-2xl" />
          ) : (
            "Unavailable"
          )
        }
        icon={<DollarSign />}
        changePct={stats.estimatedMonthlyRevenue.changePct}
        changeLabel={stats.estimatedMonthlyRevenue.changeLabel}
        series={stats.estimatedMonthlyRevenue.series}
        hint="ESTIMATED creator earnings (USD at DevEx rate) summed across tracked games. Not official revenue."
      />
    </div>
  );
}

export function GlobalStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-44 rounded-2xl border border-border bg-card p-5">
          <div className="h-3 w-28 animate-shimmer rounded bg-[linear-gradient(90deg,#121827_0px,#1a2236_160px,#121827_320px)] bg-[length:800px_100%]" />
          <div className="mt-4 h-7 w-36 animate-shimmer rounded bg-[linear-gradient(90deg,#121827_0px,#1a2236_160px,#121827_320px)] bg-[length:800px_100%]" />
        </div>
      ))}
    </div>
  );
}
