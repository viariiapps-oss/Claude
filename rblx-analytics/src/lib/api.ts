import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/config/env";
import { limiter } from "./rate-limit";

/**
 * Shared plumbing for route handlers: per-IP rate limiting, CORS, uniform
 * JSON errors and Zod validation of query strings.
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const allowed = env().CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin");
  let allow: string | null = null;
  if (allowed.includes("*")) allow = "*";
  else if (origin && allowed.includes(origin)) allow = origin;
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allow) h["Access-Control-Allow-Origin"] = allow;
  return h;
}

export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid query parameters", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return parsed.data;
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<unknown>;

export function apiHandler<C = unknown>(
  handler: Handler<C>,
  opts: { limitPerMinute?: number; cacheSeconds?: number; name?: string } = {},
) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    const cors = corsHeaders(req);
    const limit = opts.limitPerMinute ?? env().API_RATE_LIMIT_PER_MINUTE;
    const rl = limiter(opts.name ?? "api", limit, 60_000).check(clientIp(req));
    const rlHeaders = {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
    };
    if (!rl.ok) {
      return NextResponse.json(
        { error: { status: 429, message: "Too many requests — please slow down." } },
        { status: 429, headers: { ...cors, ...rlHeaders, "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }
    try {
      const data = await handler(req, ctx);
      const cacheHeader = opts.cacheSeconds
        ? `public, s-maxage=${opts.cacheSeconds}, stale-while-revalidate=${opts.cacheSeconds * 2}`
        : "no-store";
      return NextResponse.json(data, { headers: { ...cors, ...rlHeaders, "Cache-Control": cacheHeader } });
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json(
          { error: { status: e.status, message: e.message, details: e.details } },
          { status: e.status, headers: { ...cors, ...rlHeaders } },
        );
      }
      console.error("[api]", e);
      return NextResponse.json(
        { error: { status: 500, message: "Internal server error" } },
        { status: 500, headers: { ...cors, ...rlHeaders } },
      );
    }
  };
}

export function optionsHandler() {
  return async (req: NextRequest) => new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export const placeIdParam = z.string().regex(/^\d{1,20}$/, "Must be a numeric Roblox game (place) ID").transform(Number);
