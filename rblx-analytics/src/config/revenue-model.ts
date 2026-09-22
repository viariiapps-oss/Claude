/**
 * Revenue estimation model — every number here is an explicit, documented
 * assumption. Nothing in this file is an official Roblox figure for any
 * individual experience. Adjust values here (or at runtime on /revenue) and
 * the whole app re-computes.
 *
 * Model (per experience):
 *
 *   engagementHoursPerDay = avgConcurrentPlayers × 24
 *   dailyCreatorEarningsUSD = engagementHoursPerDay
 *                             × baseUsdPerEngagementHour
 *                             × devexAdjustment
 *                             × genreFactor
 *                             × monetizationFactor
 *   range = [mid × lowMultiplier, mid × highMultiplier]   (width depends on confidence)
 *
 * What is being estimated: creator earnings expressed in USD at the DevEx
 * exchange rate (i.e. what the developer could cash out), NOT gross player
 * spending and NOT Roblox's own revenue.
 */

export interface RevenueModelConfig {
  version: string;
  /** Platform-wide creator payout per engagement hour (USD). */
  baseUsdPerEngagementHour: number;
  baseSource: string;
  /** Multiplier for DevEx rate changes after the anchor period. */
  devexAdjustment: number;
  devexNote: string;
  /** Experiences below this average CCU are not estimated (too noisy). */
  minAvgPlayers: number;
  genreFactors: Record<string, number>;
  defaultGenreFactor: number;
  rangeByConfidence: Record<"low" | "medium" | "high", { low: number; high: number }>;
  confidenceThresholds: { medium: number; high: number };
}

export const DEFAULT_REVENUE_MODEL: RevenueModelConfig = {
  version: "2026.09-1",
  // FY2025: Developer Exchange fees $1,503.1M ÷ 124B hours engaged ≈ $0.0121 / hour.
  // Source: Roblox Q4 & FY2025 financial results (ir.roblox.com).
  baseUsdPerEngagementHour: 0.0121,
  baseSource:
    "Roblox FY2025 results: $1,503.1M Developer Exchange fees ÷ 124B hours engaged ≈ $0.0121 per engagement hour (platform average).",
  // Standard DevEx rate moved from $0.0035 to $0.0038 per Robux on 2025-09-05.
  // FY2025 payouts were mostly at the old rate, so we scale by 0.0038 / 0.0035 ≈ 1.086.
  devexAdjustment: 1.086,
  devexNote:
    "Standard DevEx rate: $0.0038 per earned Robux since 5 Sep 2025 (previously $0.0035). A higher US 18+ rate also exists and is not modelled per-player.",
  minAvgPlayers: 25,
  // Editorial assumptions — relative monetization intensity per genre (1.0 = platform average).
  genreFactors: {
    Simulation: 1.25,
    RPG: 1.15,
    Survival: 1.05,
    Strategy: 1.0,
    "Roleplay & Avatar Sim": 0.95,
    Action: 0.95,
    Shooter: 0.9,
    Adventure: 1.0,
    "Sports & Racing": 0.85,
    "Party & Casual": 0.8,
    "Obby & Platformer": 0.7,
    Puzzle: 0.7,
    Social: 0.6,
    Entertainment: 0.7,
    Education: 0.5,
    Shopping: 0.9,
  },
  defaultGenreFactor: 1.0,
  rangeByConfidence: {
    high: { low: 0.75, high: 1.3 },
    medium: { low: 0.55, high: 1.6 },
    low: { low: 0.35, high: 2.2 },
  },
  confidenceThresholds: { medium: 40, high: 85 },
};

/** Monetization factor from public game-pass signals (assumption, documented on /about). */
export function monetizationFactorFromPasses(passCount: number | null): number {
  if (passCount === null) return 1.0;
  if (passCount === 0) return 0.75;
  if (passCount <= 5) return 0.95;
  if (passCount <= 20) return 1.05;
  return 1.1;
}
