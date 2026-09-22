import { describe, expect, it } from "vitest";
import { DEFAULT_REVENUE_MODEL } from "@/config/revenue-model";
import { estimateRevenue, type EstimatorInput } from "@/services/revenue/estimator";

const base: EstimatorInput = {
  avgPlayers: 10_000,
  window: "7d",
  genre: "Simulation",
  gamePassCount: 10,
  historySamples: 168,
  coverageHours7d: 168,
  source: "live",
};

describe("revenue estimator", () => {
  it("returns 'insufficient' when players are unavailable — never a made-up number", () => {
    const r = estimateRevenue({ ...base, avgPlayers: null });
    expect(r.status).toBe("insufficient");
  });

  it("returns 'insufficient' below the minimum player threshold", () => {
    const r = estimateRevenue({ ...base, avgPlayers: DEFAULT_REVENUE_MODEL.minAvgPlayers - 1 });
    expect(r.status).toBe("insufficient");
  });

  it("follows the documented formula and produces an ordered range", () => {
    const r = estimateRevenue(base);
    if (r.status !== "ok") throw new Error("expected ok");
    const expectedMid = 10_000 * 24 * 0.0121 * 1.086 * 1.25 * 1.05;
    expect(r.daily.mid).toBeCloseTo(expectedMid, 4);
    expect(r.daily.low).toBeLessThan(r.daily.mid);
    expect(r.daily.high).toBeGreaterThan(r.daily.mid);
    expect(r.monthly.mid).toBeCloseTo(r.daily.mid * 30.4375, 4);
    expect(r.yearly.mid).toBeCloseTo(r.daily.mid * 365.25, 4);
    expect(r.currency).toBe("USD");
  });

  it("scales linearly with players", () => {
    const a = estimateRevenue(base);
    const b = estimateRevenue({ ...base, avgPlayers: 20_000 });
    if (a.status !== "ok" || b.status !== "ok") throw new Error("expected ok");
    expect(b.daily.mid / a.daily.mid).toBeCloseTo(2, 6);
  });

  it("gives lower confidence and a wider range with less data", () => {
    const good = estimateRevenue(base);
    const poor = estimateRevenue({ ...base, window: "current", coverageHours7d: 0, historySamples: 0, gamePassCount: null, genre: null });
    if (good.status !== "ok" || poor.status !== "ok") throw new Error("expected ok");
    expect(good.confidence).toBe("high");
    expect(poor.confidence).toBe("low");
    expect(poor.daily.high / poor.daily.low).toBeGreaterThan(good.daily.high / good.daily.low);
  });

  it("never reports high confidence for demo data", () => {
    const r = estimateRevenue({ ...base, source: "demo" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.confidence).not.toBe("high");
  });
});
