"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearAdminSession, isAdmin, setAdminSession, verifyPassword } from "@/lib/admin-auth";
import { cache } from "@/lib/cache";
import { limiter } from "@/lib/rate-limit";
import { repo } from "@/db";
import { getDataStatus } from "@/services/data-status";
import { importLiveGame, refreshLiveGames } from "@/services/live.service";
import { runRefresh } from "@/services/refresh.service";
import { parseGameInput } from "@/utils/ids";

export interface ActionResult {
  ok: boolean;
  message: string;
}

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

export async function loginAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter("admin-login", 5, 60_000).check(ip).ok) {
    return { ok: false, message: "Too many attempts. Wait a minute and try again." };
  }
  const password = z.string().min(1).max(200).safeParse(form.get("password"));
  if (!password.success || !verifyPassword(password.data)) {
    return { ok: false, message: "Incorrect password." };
  }
  await setAdminSession();
  revalidatePath("/admin");
  return { ok: true, message: "Signed in." };
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  revalidatePath("/admin");
}

export async function addGameAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = z.string().trim().min(1).max(300).safeParse(form.get("game"));
  if (!raw.success) return { ok: false, message: "Enter a Roblox game ID or roblox.com URL." };
  const parsed = parseGameInput(raw.data);
  if (parsed.kind === "text") return { ok: false, message: "Enter a numeric game (place) ID or a roblox.com/games/… URL." };
  const status = await getDataStatus();
  if (status.activeSource !== "live") {
    return { ok: false, message: "Adding games needs live data. Set DATA_MODE=live or auto with Roblox reachable." };
  }
  try {
    const id = parsed.kind === "url" ? parsed.placeId : parsed.id;
    const game = await importLiveGame(id, { track: true });
    if (!game) return { ok: false, message: `No public experience found for ${id}.` };
    cache.deletePrefix("live:");
    revalidatePath("/admin");
    return { ok: true, message: `Now tracking “${game.name}”.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to add game." };
  }
}

export async function removeGameAction(universeId: number): Promise<ActionResult> {
  await requireAdmin();
  const id = z.number().int().positive().safeParse(universeId);
  if (!id.success) return { ok: false, message: "Invalid game." };
  await repo().deleteGame(id.data);
  cache.deletePrefix("live:");
  revalidatePath("/admin");
  return { ok: true, message: "Game removed from tracking (history deleted)." };
}

export async function refreshGameAction(universeId: number): Promise<ActionResult> {
  await requireAdmin();
  try {
    const n = await refreshLiveGames([universeId], { withMedia: true, force: true });
    revalidatePath("/admin");
    return n ? { ok: true, message: "Refreshed." } : { ok: false, message: "Roblox returned no data for this game." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Refresh failed." };
  }
}

export async function runTierAction(tier: "realtime" | "hourly" | "daily"): Promise<ActionResult> {
  await requireAdmin();
  const t = z.enum(["realtime", "hourly", "daily"]).parse(tier);
  const r = await runRefresh(t);
  cache.delete("data-status:auto");
  revalidatePath("/admin");
  if (r.skipped) return { ok: true, message: r.skipped };
  return { ok: r.ok, message: r.ok ? r.details.join(" ") || "Done." : `Failed: ${r.error}` };
}
