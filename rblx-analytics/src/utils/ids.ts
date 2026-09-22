import type { CreatorType } from "@/types";

export function developerId(type: CreatorType, robloxId: number): string {
  return `${type === "Group" ? "group" : "user"}-${robloxId}`;
}

export function parseDeveloperId(id: string): { type: CreatorType; robloxId: number } | null {
  const m = /^(group|user)-(\d{1,20})$/.exec(id);
  if (!m) return null;
  const robloxId = Number(m[2]);
  if (!Number.isSafeInteger(robloxId) || robloxId <= 0) return null;
  return { type: m[1] === "group" ? "Group" : "User", robloxId };
}

/**
 * Interprets free-form search input. Accepts:
 *  - a roblox.com game URL → place ID
 *  - a bare numeric ID     → place or universe ID
 *  - anything else         → text query
 */
export function parseGameInput(raw: string):
  | { kind: "url"; placeId: number }
  | { kind: "id"; id: number }
  | { kind: "text"; query: string } {
  const input = raw.trim();
  const url = /roblox\.com\/(?:[a-z]{2}\/)?games\/(\d{1,20})/i.exec(input);
  if (url) return { kind: "url", placeId: Number(url[1]) };
  if (/^\d{1,20}$/.test(input)) {
    const n = Number(input);
    if (Number.isSafeInteger(n) && n > 0) return { kind: "id", id: n };
  }
  return { kind: "text", query: input };
}

export function parsePositiveId(raw: string): number | null {
  if (!/^\d{1,20}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
