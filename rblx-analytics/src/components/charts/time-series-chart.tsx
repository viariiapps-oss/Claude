"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, type TooltipRow } from "./chart-tooltip";
import { CHART } from "./chart-theme";

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

export type TimeRow = { t: string } & Record<string, number | string | null>;

export function formatAxisTime(t: string, spanMs: number): string {
  const d = new Date(t);
  if (spanMs <= 2 * 86_400_000) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  if (spanMs <= 120 * 86_400_000) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function formatTooltipTime(t: string | number, spanMs: number): string {
  const d = new Date(t);
  return spanMs <= 8 * 86_400_000
    ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC"
    : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * Line/area time series with a crosshair tooltip. One y-axis only; a legend
 * is rendered for ≥ 2 series.
 */
export function TimeSeriesChart({
  data,
  series,
  formatValue,
  formatTick,
  height = 280,
  variant = "area",
  zeroBaseline = false,
}: {
  data: TimeRow[];
  series: SeriesDef[];
  formatValue: (v: number, key: string) => string;
  formatTick: (v: number) => string;
  height?: number;
  variant?: "area" | "line";
  zeroBaseline?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const span = data.length > 1 ? new Date(data[data.length - 1].t).getTime() - new Date(data[0].t).getTime() : 0;
  const rows: TooltipRow[] = series;
  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid stroke={CHART.grid} vertical={false} />
      <XAxis
        dataKey="t"
        tickFormatter={(t: string) => formatAxisTime(t, span)}
        tick={{ fill: CHART.axis, fontSize: 11 }}
        axisLine={{ stroke: CHART.grid }}
        tickLine={false}
        minTickGap={32}
      />
      <YAxis
        tickFormatter={formatTick}
        tick={{ fill: CHART.axis, fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        width={52}
        domain={zeroBaseline ? [0, "auto"] : ["auto", "auto"]}
      />
      <Tooltip
        cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
        content={(p) => (
          <ChartTooltip
            active={p.active}
            payload={p.payload}
            label={p.label as string | number | undefined}
            rows={rows} formatValue={formatValue} formatLabel={(l) => formatTooltipTime(l, span)} />
        )}
      />
      {series.length >= 2 && (
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(v: string) => <span style={{ color: CHART.text, fontSize: 12 }}>{v}</span>}
        />
      )}
    </>
  );

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {variant === "area" ? (
          <AreaChart {...common}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`g-${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {axes}
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#g-${id}-${s.key})`}
                dot={false}
                activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
                connectNulls={false}
                animationDuration={500}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {axes}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
                connectNulls
                animationDuration={500}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
