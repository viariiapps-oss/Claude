"use client";

import type { ReactNode } from "react";
import { Delta } from "@/components/common/delta";
import { Sparkline } from "@/components/charts/sparkline";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  changePct,
  changeLabel,
  series,
  hint,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  /** A rendered icon element, e.g. <Users /> (elements, unlike components, can cross the server→client boundary). */
  icon: ReactNode;
  changePct?: number | null;
  changeLabel?: string;
  series?: { v: number }[];
  hint?: string;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("group relative overflow-hidden p-5 transition-colors hover:border-border-strong", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
            {label}
            {hint && (
              <Tooltip content={hint}>
                <button type="button" className="grid size-4 place-items-center rounded-full border border-border text-[9px] text-subtle hover:text-fg" aria-label={`About ${label}`}>
                  ?
                </button>
              </Tooltip>
            )}
          </p>
          <div className="tabular mt-2 truncate text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{value}</div>
        </div>
        <div aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent-soft text-accent [&_svg]:size-5">
          {icon}
        </div>
      </div>
      {changePct !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <Delta value={changePct ?? null} />
          {changeLabel && <span className="text-xs text-subtle">{changeLabel}</span>}
        </div>
      )}
      {series && series.length > 1 && (
        <div className="-mx-5 -mb-5 mt-3">
          <Sparkline data={series} height={44} />
        </div>
      )}
      {footer && <div className="mt-3 text-xs text-muted">{footer}</div>}
    </Card>
  );
}
