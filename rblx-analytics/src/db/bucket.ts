import type { HistoryPoint } from "@/types";

export interface RawSample {
  t: number;
  players: number | null;
  visits: number | null;
  favorites: number | null;
  likes: number | null;
}

/**
 * Buckets raw samples: players are averaged, cumulative counters (visits,
 * favorites, likes) take the last value in the bucket. Buckets without samples
 * are omitted — gaps are never interpolated or invented.
 */
export function bucketSamples(samples: RawSample[], fromMs: number, bucketSeconds: number): HistoryPoint[] {
  const size = bucketSeconds * 1000;
  const buckets = new Map<number, { sum: number; n: number; last: RawSample }>();
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  for (const s of sorted) {
    const key = fromMs + Math.floor((s.t - fromMs) / size) * size;
    const b = buckets.get(key) ?? { sum: 0, n: 0, last: s };
    if (s.players !== null) {
      b.sum += s.players;
      b.n += 1;
    }
    b.last = s;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, b]) => ({
      t: new Date(key).toISOString(),
      players: b.n > 0 ? Math.round(b.sum / b.n) : null,
      visits: b.last.visits,
      favorites: b.last.favorites,
      likes: b.last.likes,
    }));
}
