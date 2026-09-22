import "server-only";
import { env } from "@/config/env";
import { singleton } from "@/lib/singleton";
import { MemoryRepository } from "./memory-repository";
import { PostgresRepository } from "./postgres-repository";
import type { Repository } from "./repository";

export type { Repository, StoredGame, StoredDeveloper } from "./repository";

/** Postgres when DATABASE_URL is set (Supabase or any Postgres 14+), otherwise in-memory. */
export function repo(): Repository {
  return singleton("repository", () => {
    const e = env();
    if (e.DATABASE_URL) return new PostgresRepository(e.DATABASE_URL, e.DATABASE_SSL);
    return new MemoryRepository();
  });
}
