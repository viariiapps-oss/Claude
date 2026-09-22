import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Never import this module from a client component —
 * `server-only` makes the build fail if that happens, so secrets cannot leak
 * into the browser bundle.
 */
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATA_MODE: z.enum(["auto", "live", "demo"]).default("auto"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: optionalString,
  DATABASE_SSL: bool(true),
  SUPABASE_URL: optionalString,
  SUPABASE_ANON_KEY: optionalString,

  ROBLOX_API_KEY: optionalString,
  ROBLOX_ENABLE_OMNI_SEARCH: bool(true),
  ROBLOX_MAX_RPS: z.coerce.number().positive().max(50).default(4),
  ROBLOX_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),

  EXCHANGE_RATE_API_KEY: optionalString,

  ADMIN_PASSWORD: optionalString,
  ADMIN_SESSION_SECRET: optionalString,
  CRON_SECRET: optionalString,

  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  CORS_ALLOWED_ORIGINS: z.string().optional().default("*"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isAdminConfigured(): boolean {
  const e = env();
  return Boolean(e.ADMIN_PASSWORD && e.ADMIN_PASSWORD.length >= 8);
}
