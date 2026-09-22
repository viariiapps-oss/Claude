import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdmin, verifyCronSecret } from "@/lib/admin-auth";
import { runRefresh } from "@/services/refresh.service";

export const maxDuration = 60;

const query = z.object({ tier: z.enum(["realtime", "hourly", "daily"]).default("realtime") });

/**
 * GET /api/cron/refresh?tier=realtime|hourly|daily
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel Cron) or an admin session.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get("authorization")) && !(await isAdmin())) {
    return NextResponse.json({ error: { status: 401, message: "Unauthorized" } }, { status: 401 });
  }
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: { status: 400, message: "Invalid tier" } }, { status: 400 });
  const result = await runRefresh(parsed.data.tier);
  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}
