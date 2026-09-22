"use client";

import { Calculator, Coins, Gauge, RotateCcw, Sigma, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfidenceBadge } from "@/components/common/confidence-badge";
import { CurrencySelect } from "@/components/common/currency-select";
import { GameIcon } from "@/components/common/game-icon";
import { MoneyRangeText } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DEFAULT_REVENUE_MODEL, type RevenueModelConfig } from "@/config/revenue-model";
import { estimateRevenue, type EstimatorInput } from "@/services/revenue/estimator";
import type { MoneyRange } from "@/types";
import { formatNumber } from "@/utils/format";

export interface EstimatorRow {
  placeId: number;
  name: string;
  iconUrl: string | null;
  input: EstimatorInput;
}

/** FY2025 payouts were mostly exchanged at the legacy $0.0035 rate → earned Robux per engagement hour. */
const LEGACY_DEVEX = 0.0035;
const DEFAULT_ROBUX_PER_HOUR = +(DEFAULT_REVENUE_MODEL.baseUsdPerEngagementHour / LEGACY_DEVEX).toFixed(2);

interface Assumptions {
  robuxPerHour: number;
  devexRate: number;
  useGenre: boolean;
  useSignals: boolean;
  minAvgPlayers: number;
}

const DEFAULTS: Assumptions = {
  robuxPerHour: DEFAULT_ROBUX_PER_HOUR,
  devexRate: 0.0038,
  useGenre: true,
  useSignals: true,
  minAvgPlayers: DEFAULT_REVENUE_MODEL.minAvgPlayers,
};

function toModel(a: Assumptions): RevenueModelConfig {
  return {
    ...DEFAULT_REVENUE_MODEL,
    version: `${DEFAULT_REVENUE_MODEL.version}-custom`,
    baseUsdPerEngagementHour: +(a.robuxPerHour * a.devexRate).toFixed(5),
    devexAdjustment: 1,
    minAvgPlayers: a.minAvgPlayers,
    genreFactors: a.useGenre ? DEFAULT_REVENUE_MODEL.genreFactors : {},
  };
}

function Slider({ id, label, value, min, max, step, onChange, display }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
        <span className="tabular text-xs font-semibold text-fg">{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#4DA3FF]" />
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card-2/50 p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[#4DA3FF]" />
      <span>
        <span className="block text-sm text-fg">{label}</span>
        <span className="block text-xs text-subtle">{description}</span>
      </span>
    </label>
  );
}

const GENRES = Object.keys(DEFAULT_REVENUE_MODEL.genreFactors).sort();

export function RevenueExplorer({ rows }: { rows: EstimatorRow[] }) {
  const [a, setA] = useState<Assumptions>(DEFAULTS);
  const model = useMemo(() => toModel(a), [a]);
  const isDefault = JSON.stringify(a) === JSON.stringify(DEFAULTS);

  const estimates = useMemo(
    () =>
      rows
        .map((r) => ({ row: r, est: estimateRevenue({ ...r.input, gamePassCount: a.useSignals ? r.input.gamePassCount : null }, model) }))
        .sort((x, y) => (y.est.status === "ok" ? y.est.monthly.mid : -1) - (x.est.status === "ok" ? x.est.monthly.mid : -1)),
    [rows, model, a.useSignals],
  );
  const total: MoneyRange | null = estimates.reduce<MoneyRange | null>(
    (acc, { est }) => (est.status === "ok" ? { low: (acc?.low ?? 0) + est.monthly.low, mid: (acc?.mid ?? 0) + est.monthly.mid, high: (acc?.high ?? 0) + est.monthly.high } : acc),
    null,
  );

  // Custom calculator
  const [players, setPlayers] = useState("25000");
  const [genre, setGenre] = useState("Simulation");
  const [passes, setPasses] = useState("8");
  const custom = estimateRevenue(
    {
      avgPlayers: players.trim() === "" ? null : Number(players),
      window: "7d",
      genre,
      gamePassCount: a.useSignals && passes.trim() !== "" ? Number(passes) : null,
      historySamples: 168,
      coverageHours7d: 168,
      source: "live",
    },
    model,
  );

  return (
    <div id="estimator" className="scroll-mt-24 space-y-6">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> Revenue Estimator</CardTitle>
              <CardDescription>Adjust the assumptions — every estimate on this page recalculates.</CardDescription>
            </div>
            {!isDefault && (
              <Button variant="ghost" size="sm" onClick={() => setA(DEFAULTS)}>
                <RotateCcw /> Reset
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <section className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle"><Coins className="size-3.5" /> Robux assumptions</p>
              <Slider id="rph" label="Earned Robux per engagement hour" value={a.robuxPerHour} min={0.5} max={10} step={0.05} onChange={(v) => setA({ ...a, robuxPerHour: v })} display={`${a.robuxPerHour.toFixed(2)} R$`} />
              <p className="text-xs text-subtle">Default {DEFAULT_ROBUX_PER_HOUR} R$ ≈ FY2025 DevEx payouts ÷ hours engaged ÷ $0.0035.</p>
            </section>
            <section className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle"><Sigma className="size-3.5" /> Conversion assumptions</p>
              <Select
                label="DevEx rate"
                value={String(a.devexRate)}
                onValueChange={(v) => setA({ ...a, devexRate: Number(v) })}
                options={[
                  { value: "0.0038", label: "$0.0038 / R$ — standard (since Sep 2025)" },
                  { value: "0.0035", label: "$0.0035 / R$ — legacy rate" },
                  { value: "0.0054", label: "$0.0054 / R$ — US 18+ spend (upper bound)" },
                ]}
              />
              <p className="tabular text-xs text-muted">= ${(a.robuxPerHour * a.devexRate).toFixed(4)} creator earnings per engagement hour</p>
            </section>
            <section className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle"><Calculator className="size-3.5" /> Monetization assumptions</p>
              <Toggle checked={a.useGenre} onChange={(v) => setA({ ...a, useGenre: v })} label="Apply genre factors" description="Editorial multipliers, e.g. Simulation ×1.25, Social ×0.6." />
              <Toggle checked={a.useSignals} onChange={(v) => setA({ ...a, useSignals: v })} label="Use public game-pass signals" description="0 passes ×0.75 … 20+ passes ×1.10." />
            </section>
            <section className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle"><Gauge className="size-3.5" /> Data confidence</p>
              <Slider id="minp" label="Minimum avg. players to estimate" value={a.minAvgPlayers} min={0} max={1000} step={5} onChange={(v) => setA({ ...a, minAvgPlayers: v })} display={formatNumber(a.minAvgPlayers)} />
              <p className="text-xs text-subtle">
                Range width by confidence — high ×{model.rangeByConfidence.high.low}–{model.rangeByConfidence.high.high}, medium ×{model.rangeByConfidence.medium.low}–
                {model.rangeByConfidence.medium.high}, low ×{model.rangeByConfidence.low.low}–{model.rangeByConfidence.low.high}.
              </p>
            </section>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Estimate any experience</CardTitle>
                <CardDescription>Plug in your own numbers (assumes a full 7-day window of live data).</CardDescription>
              </div>
              <CurrencySelect />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="c-players">Average concurrent players</Label>
                  <Input id="c-players" type="number" min={0} inputMode="numeric" value={players} onChange={(e) => setPlayers(e.target.value)} />
                </div>
                <div>
                  <Label>Genre</Label>
                  <Select label="Genre" value={genre} onValueChange={setGenre} options={GENRES.map((g) => ({ value: g, label: g }))} />
                </div>
                <div>
                  <Label htmlFor="c-passes">Public game passes</Label>
                  <Input id="c-passes" type="number" min={0} inputMode="numeric" value={passes} onChange={(e) => setPasses(e.target.value)} />
                </div>
              </div>
              <div className="rounded-2xl border border-accent/30 bg-accent-soft p-5">
                {custom.status === "ok" ? (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted">Estimated range · monthly</p>
                    <MoneyRangeText range={custom.monthly} className="mt-1 block text-3xl font-semibold tracking-tight text-fg" />
                    <div className="mt-3"><ConfidenceBadge confidence={custom.confidence} /></div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      {(["daily", "weekly", "yearly"] as const).map((p) => (
                        <div key={p}>
                          <dt className="capitalize text-subtle">{p}</dt>
                          <dd><MoneyRangeText range={custom[p]} className="text-fg" /></dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="text-sm text-muted">{custom.reason}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Estimated revenue leaderboard</CardTitle>
                <CardDescription>
                  {isDefault ? "Default model" : "Your custom assumptions"} · tracked total{" "}
                  {total ? <MoneyRangeText range={total} className="text-fg" /> : "—"} / month (estimated)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-2 sm:px-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-subtle">
                      <th className="px-5 py-3 font-medium">Game</th>
                      <th className="px-4 py-3 text-right font-medium">Avg. players</th>
                      <th className="px-4 py-3 text-right font-medium">Daily</th>
                      <th className="px-4 py-3 text-right font-medium">Monthly</th>
                      <th className="px-4 py-3 text-right font-medium">Yearly</th>
                      <th className="px-5 py-3 text-right font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map(({ row, est }) => (
                      <tr key={row.placeId} className="border-b border-border/60 last:border-0 hover:bg-card-2/60">
                        <td className="px-5 py-3">
                          <Link href={`/games/${row.placeId}`} className="flex items-center gap-3 hover:text-accent">
                            <GameIcon name={row.name} url={row.iconUrl} size={30} />
                            <span className="max-w-[200px] truncate font-medium">{row.name}</span>
                          </Link>
                        </td>
                        <td className="tabular px-4 py-3 text-right text-muted">
                          {formatNumber(row.input.avgPlayers)}
                          <span className="ml-1 text-[10px] text-subtle">{row.input.window}</span>
                        </td>
                        {est.status === "ok" ? (
                          <>
                            <td className="whitespace-nowrap px-4 py-3 text-right"><MoneyRangeText range={est.daily} /></td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium"><MoneyRangeText range={est.monthly} /></td>
                            <td className="whitespace-nowrap px-4 py-3 text-right"><MoneyRangeText range={est.yearly} /></td>
                            <td className="px-5 py-3 text-right"><ConfidenceBadge confidence={est.confidence} withLabel={false} /></td>
                          </>
                        ) : (
                          <td colSpan={4} className="px-5 py-3 text-right text-xs text-subtle">Insufficient data to estimate revenue</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
