import { DEFAULT_REVENUE_MODEL, monetizationFactorFromPasses, type RevenueModelConfig } from "@/config/revenue-model";
import type { Confidence, DataSource, MoneyRange, RevenueEstimate } from "@/types";

/**
 * Pure revenue estimator — no I/O, safe on server and client (the /revenue
 * playground runs it in the browser with user-tuned assumptions).
 * See src/config/revenue-model.ts for the formula and sources.
 */
export interface EstimatorInput {
  /** Average concurrent players over `window`. `null` → cannot estimate. */
  avgPlayers: number | null;
  window: "7d" | "24h" | "current";
  genre: string | null;
  gamePassCount: number | null;
  historySamples: number;
  coverageHours7d: number;
  source: DataSource;
  now?: number;
}

const scale = (r: MoneyRange, k: number): MoneyRange => ({ low: r.low * k, mid: r.mid * k, high: r.high * k });

export function scoreConfidence(input: EstimatorInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const coverage = Math.min(1, input.coverageHours7d / 168);
  score += Math.round(coverage * 40);
  reasons.push(
    coverage >= 0.9
      ? "Full 7-day player history available"
      : coverage > 0
        ? `Partial history (${Math.round(coverage * 100)}% of the last 7 days)`
        : "No stored player history — based on a single current reading",
  );

  if (input.window === "7d") score += 15;
  else if (input.window === "24h") score += 8;

  if (input.gamePassCount !== null) {
    score += 15;
    reasons.push(`Public monetization signal: ${input.gamePassCount} game pass${input.gamePassCount === 1 ? "" : "es"}`);
  } else {
    reasons.push("No public monetization signals collected yet");
  }

  if (input.genre) {
    score += 10;
  } else {
    reasons.push("Genre unknown — platform-average monetization assumed");
  }

  if (input.source === "live") score += 10;
  else reasons.push("Demo data — synthetic inputs, illustration only");

  const avg = input.avgPlayers ?? 0;
  if (avg >= 1000) score += 10;
  else if (avg >= 100) score += 5;
  else reasons.push("Small player base — estimates are noisy");

  reasons.push("Developer products, Premium Payouts and private deals are not publicly observable");
  return { score: Math.min(100, score), reasons };
}

export function confidenceFromScore(score: number, model: RevenueModelConfig = DEFAULT_REVENUE_MODEL): Confidence {
  if (score >= model.confidenceThresholds.high) return "high";
  if (score >= model.confidenceThresholds.medium) return "medium";
  return "low";
}

export function estimateRevenue(input: EstimatorInput, model: RevenueModelConfig = DEFAULT_REVENUE_MODEL): RevenueEstimate {
  const computedAt = new Date(input.now ?? Date.now()).toISOString();
  if (input.avgPlayers === null || !Number.isFinite(input.avgPlayers)) {
    return {
      status: "insufficient",
      reason: "Insufficient data to estimate revenue — player counts are unavailable.",
      modelVersion: model.version,
      computedAt,
    };
  }
  if (input.avgPlayers < model.minAvgPlayers) {
    return {
      status: "insufficient",
      reason: `Insufficient data to estimate revenue — average concurrent players (${Math.round(input.avgPlayers)}) is below the ${model.minAvgPlayers}-player minimum.`,
      modelVersion: model.version,
      computedAt,
    };
  }

  const genreFactor = (input.genre && model.genreFactors[input.genre]) || model.defaultGenreFactor;
  const monetizationFactor = monetizationFactorFromPasses(input.gamePassCount);
  const hoursPerDay = input.avgPlayers * 24;
  const mid = hoursPerDay * model.baseUsdPerEngagementHour * model.devexAdjustment * genreFactor * monetizationFactor;

  const { score, reasons } = scoreConfidence(input);
  // Synthetic (demo) inputs can never justify high confidence.
  const scored = confidenceFromScore(score, model);
  const confidence: Confidence = input.source !== "live" && scored === "high" ? "medium" : scored;
  const width = model.rangeByConfidence[confidence];
  const daily: MoneyRange = { low: mid * width.low, mid, high: mid * width.high };

  return {
    status: "ok",
    currency: "USD",
    daily,
    weekly: scale(daily, 7),
    monthly: scale(daily, 30.4375),
    yearly: scale(daily, 365.25),
    confidence,
    confidenceScore: score,
    confidenceReasons: reasons,
    inputs: {
      avgPlayers: input.avgPlayers,
      avgPlayersWindow: input.window,
      engagementHoursPerDay: hoursPerDay,
      baseUsdPerHour: model.baseUsdPerEngagementHour,
      genre: input.genre,
      genreFactor,
      monetizationFactor,
      devexAdjustment: model.devexAdjustment,
      historySamples: input.historySamples,
      historyCoverageHours: input.coverageHours7d,
      hasMonetizationSignals: input.gamePassCount !== null,
      gamePassCount: input.gamePassCount,
      source: input.source,
    },
    modelVersion: model.version,
    computedAt,
  };
}
