"use client";

import { BadgeCheck, Building2, User } from "lucide-react";
import Link from "next/link";
import { Delta } from "@/components/common/delta";
import { MoneyRangeText } from "@/components/common/money";
import type { DeveloperSummary } from "@/types";
import { formatCompact } from "@/utils/format";

export function DevelopersTable({ developers }: { developers: DeveloperSummary[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-subtle">
              <th className="px-5 py-3 font-medium">Creator</th>
              <th className="px-4 py-3 text-right font-medium">Games</th>
              <th className="px-4 py-3 text-right font-medium">Total visits</th>
              <th className="px-4 py-3 text-right font-medium">Total players</th>
              <th className="px-4 py-3 text-right font-medium">Est. revenue / mo</th>
              <th className="px-5 py-3 text-right font-medium">Growth 7d</th>
            </tr>
          </thead>
          <tbody>
            {developers.map((d) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-card-2/60">
                <td className="px-5 py-3">
                  <Link href={`/developers/${d.id}`} className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl border border-border bg-card-2 text-muted">
                      {d.type === "Group" ? <Building2 className="size-4" /> : <User className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 font-medium text-fg hover:text-accent">
                        {d.name}
                        {d.hasVerifiedBadge && <BadgeCheck className="size-3.5 text-accent" aria-label="Verified" />}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {d.type} · top: {d.topGame?.name ?? "—"}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="tabular px-4 py-3 text-right">{d.gameCount}</td>
                <td className="tabular px-4 py-3 text-right">{formatCompact(d.totalVisits)}</td>
                <td className="tabular px-4 py-3 text-right">{formatCompact(d.totalPlayers)}</td>
                <td className="px-4 py-3 text-right">
                  {d.estimatedMonthlyRevenue ? <MoneyRangeText range={d.estimatedMonthlyRevenue} /> : <span className="text-xs text-subtle">Insufficient data</span>}
                </td>
                <td className="px-5 py-3 text-right"><Delta value={d.growth7d} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border/60 md:hidden">
        {developers.map((d) => (
          <li key={d.id}>
            <Link href={`/developers/${d.id}`} className="block px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{d.name}</p>
                <Delta value={d.growth7d} />
              </div>
              <p className="text-xs text-muted">{d.type} · {d.gameCount} game{d.gameCount === 1 ? "" : "s"}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-subtle">Visits</p><p className="tabular">{formatCompact(d.totalVisits)}</p></div>
                <div><p className="text-subtle">Players</p><p className="tabular">{formatCompact(d.totalPlayers)}</p></div>
                <div><p className="text-subtle">Est. / mo</p>{d.estimatedMonthlyRevenue ? <MoneyRangeText range={d.estimatedMonthlyRevenue} /> : "—"}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
