import "./env";

/**
 * Triggers one refresh tier on a running instance:
 *   npm run refresh -- hourly
 * Requires CRON_SECRET and APP_URL (defaults to NEXT_PUBLIC_SITE_URL or localhost:3000).
 */
export async function trigger(tier: string): Promise<boolean> {
  const base = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is not set.");
  const res = await fetch(`${base}/api/cron/refresh?tier=${encodeURIComponent(tier)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.text();
  console.log(`[${new Date().toISOString()}] ${tier} → ${res.status} ${body.slice(0, 500)}`);
  return res.ok;
}

if (process.argv[1]?.endsWith("refresh-once.ts")) {
  const tier = process.argv[2] ?? "realtime";
  if (!["realtime", "hourly", "daily"].includes(tier)) {
    console.error("Usage: npm run refresh -- realtime|hourly|daily");
    process.exit(1);
  }
  trigger(tier)
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
