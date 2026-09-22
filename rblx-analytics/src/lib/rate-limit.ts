import { singleton } from "./singleton";

/**
 * Token bucket used to throttle OUTGOING calls to third-party APIs so we never
 * burst Roblox or the FX provider.
 */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  private queue: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private ratePerSec: number,
    private capacity: number,
  ) {
    this.tokens = capacity;
  }

  private refill() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.ratePerSec);
    this.last = now;
  }

  private drain = () => {
    this.timer = null;
    this.refill();
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      this.queue.shift()!();
    }
    if (this.queue.length > 0) {
      const wait = Math.ceil(((1 - this.tokens) / this.ratePerSec) * 1000);
      this.timer = setTimeout(this.drain, Math.max(wait, 10));
    }
  };

  take(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (!this.timer) this.drain();
    });
  }
}

/**
 * Fixed-window limiter for INCOMING requests keyed by client IP.
 * In-memory → per instance. For multi-region production traffic, swap for a
 * shared store (Redis/Upstash) behind the same interface.
 */
export class WindowLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  check(key: string): { ok: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let h = this.hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, h);
      if (this.hits.size > 10_000) this.gc(now);
    }
    h.count += 1;
    return { ok: h.count <= this.limit, remaining: Math.max(0, this.limit - h.count), resetAt: h.resetAt };
  }

  private gc(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

export function limiter(name: string, limit: number, windowMs: number): WindowLimiter {
  return singleton(`limiter:${name}:${limit}:${windowMs}`, () => new WindowLimiter(limit, windowMs));
}
