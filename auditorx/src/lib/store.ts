import { Redis } from "@upstash/redis";

/**
 * Almacén clave-valor para usuarios, créditos, uso y correos de interesados.
 * En producción usa Upstash Redis (integración de Vercel). En desarrollo, o
 * con AUDITORX_MOCK=1, cae a un Map en memoria para poder probar sin nada.
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  /** Devuelve false si se pidió `nx` y la clave ya existía. */
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  getdel<T>(key: string): Promise<T | null>;
  incrby(key: string, by: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const MOCK = process.env.AUDITORX_MOCK === "1";

/** true cuando los datos sobreviven entre peticiones (o estamos en desarrollo). */
export const storeReady = Boolean(url && token) || MOCK || process.env.NODE_ENV !== "production";

function redisStore(redis: Redis): Store {
  return {
    get: (k) => redis.get(k),
    async set(k, v, opts) {
      const res = await redis.set(k, v, {
        ...(opts?.ex ? { ex: opts.ex } : {}),
        ...(opts?.nx ? { nx: true } : {}),
      } as never);
      return res === "OK";
    },
    async del(k) {
      await redis.del(k);
    },
    getdel: (k) => redis.getdel(k),
    incrby: (k, by) => redis.incrby(k, by),
    async expire(k, seconds) {
      await redis.expire(k, seconds);
    },
    async sadd(k, m) {
      await redis.sadd(k, m);
    },
    smembers: (k) => redis.smembers(k),
  };
}

function memoryStore(): Store {
  const data = new Map<string, { v: unknown; exp?: number }>();
  const live = (k: string) => {
    const e = data.get(k);
    if (e?.exp && e.exp < Date.now()) data.delete(k);
    return data.get(k);
  };
  return {
    async get<T>(k: string) {
      return (live(k)?.v as T) ?? null;
    },
    async set(k, v, opts) {
      if (opts?.nx && live(k)) return false;
      data.set(k, { v: structuredClone(v), exp: opts?.ex ? Date.now() + opts.ex * 1000 : undefined });
      return true;
    },
    async del(k) {
      data.delete(k);
    },
    async getdel<T>(k: string) {
      const v = (live(k)?.v as T) ?? null;
      data.delete(k);
      return v;
    },
    async incrby(k, by) {
      const e = live(k);
      const n = Number(e?.v ?? 0) + by;
      data.set(k, { v: n, exp: e?.exp });
      return n;
    },
    async expire(k, seconds) {
      const e = live(k);
      if (e) e.exp = Date.now() + seconds * 1000;
    },
    async sadd(k, m) {
      const s = new Set((live(k)?.v as string[]) ?? []);
      s.add(m);
      data.set(k, { v: [...s] });
    },
    async smembers(k) {
      return (live(k)?.v as string[]) ?? [];
    },
  };
}

// globalThis: una sola instancia aunque Next recargue módulos en desarrollo.
const g = globalThis as { __axStore?: Store };
export const store: Store = (g.__axStore ??= url && token ? redisStore(new Redis({ url, token })) : memoryStore());
