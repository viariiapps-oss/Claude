import "server-only";
import { env } from "@/config/env";
import { cache } from "@/lib/cache";
import { repo } from "@/db";
import type { DataStatus } from "@/types";
import { isRobloxCircuitOpen, probeRoblox } from "./roblox/client";

/**
 * Decides whether the app serves LIVE or DEMO data.
 *  DATA_MODE=demo → always demo
 *  DATA_MODE=live → always live (errors surface as "Data unavailable")
 *  DATA_MODE=auto → live when Roblox's public API is reachable, otherwise demo.
 *                   The probe result is cached for 60 s.
 */
export async function getDataStatus(): Promise<DataStatus> {
  const e = env();
  const storage = repo().kind;
  if (e.DATA_MODE === "demo") {
    return { mode: "demo", activeSource: "demo", reason: "DATA_MODE is set to demo.", storage };
  }
  if (e.DATA_MODE === "live") {
    return { mode: "live", activeSource: "live", reason: "DATA_MODE is set to live.", storage };
  }
  return cache.wrap("data-status:auto", 60_000, async () => {
    if (isRobloxCircuitOpen()) {
      return { mode: "auto", activeSource: "demo", reason: "Roblox API temporarily unreachable — showing demo data.", storage } satisfies DataStatus;
    }
    const probe = await probeRoblox();
    return probe.ok
      ? ({ mode: "auto", activeSource: "live", reason: "Connected to Roblox public APIs.", storage } satisfies DataStatus)
      : ({ mode: "auto", activeSource: "demo", reason: `Roblox API unreachable (${probe.error}) — showing demo data.`, storage } satisfies DataStatus);
  });
}
