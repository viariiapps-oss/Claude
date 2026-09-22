"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART } from "./chart-theme";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/** Vertical bars with per-bar hover tooltip; rounded data-ends, 2px gaps. */
export function SimpleBarChart({
  data,
  formatValue,
  formatTick,
  height = 260,
  color = CHART.accent,
}: {
  data: BarDatum[];
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  height?: number;
  color?: string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={formatTick} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            cursor={{ fill: "rgb(77 163 255 / 0.06)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-border bg-card-2/95 px-3 py-2 text-xs shadow-2xl">
                  <p className="text-muted">{String(payload[0].payload.label)}</p>
                  <p className="tabular mt-0.5 font-medium text-fg">{formatValue(Number(payload[0].value))}</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={500}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for comparing one metric across entities (colour follows the entity). */
export function HorizontalBars({
  data,
  formatValue,
  height,
}: {
  data: BarDatum[];
  formatValue: (v: number) => string;
  height?: number;
}) {
  const h = height ?? Math.max(120, data.length * 44 + 16);
  return (
    <div style={{ height: h }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="label" width={120} tick={{ fill: CHART.text, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgb(77 163 255 / 0.06)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-border bg-card-2/95 px-3 py-2 text-xs shadow-2xl">
                  <p className="text-muted">{String(payload[0].payload.label)}</p>
                  <p className="tabular mt-0.5 font-medium text-fg">{formatValue(Number(payload[0].value))}</p>
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            animationDuration={500}
            label={{ position: "right", fill: CHART.text, fontSize: 11, formatter: (v: unknown) => formatValue(Number(v)) }}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? CHART.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
