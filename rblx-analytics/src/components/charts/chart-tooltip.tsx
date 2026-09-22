"use client";


export interface TooltipRow {
  key: string;
  label: string;
  color: string;
}

/** Shared tooltip card: time header + one row per series (text in ink, swatch carries identity). */
export function ChartTooltip({
  active,
  payload,
  label,
  rows,
  formatValue,
  formatLabel,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown }[];
  label?: string | number;
  rows: TooltipRow[];
  formatValue: (v: number, key: string) => string;
  formatLabel: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(payload.map((p) => [String(p.dataKey), p.value as number | null | undefined]));
  return (
    <div className="min-w-40 rounded-xl border border-border bg-card-2/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur">
      <p className="mb-1.5 font-medium text-muted">{formatLabel(label ?? "")}</p>
      <ul className="space-y-1">
        {rows.map((r) => {
          const v = byKey.get(r.key);
          if (v === undefined || v === null) return null;
          return (
            <li key={r.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />
                {r.label}
              </span>
              <span className="tabular font-medium text-fg">{formatValue(Number(v), r.key)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
