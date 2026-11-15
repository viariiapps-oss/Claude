import type { NextRequest } from "next/server";

/**
 * Freno básico por IP en memoria. Protege de ráfagas dentro de una misma
 * instancia; no sustituye a un límite compartido si el tráfico crece.
 */
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export function allow(req: NextRequest, bucket: string, max: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  const ok = recent.length < max;
  if (ok) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return ok;
}
