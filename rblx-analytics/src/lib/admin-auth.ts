import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env, isAdminConfigured } from "@/config/env";

export const ADMIN_COOKIE = "rblx_admin";
const SESSION_TTL_S = 8 * 3600;

function secret(): string {
  const e = env();
  // A dedicated secret is recommended; otherwise derive one from the password.
  return e.ADMIN_SESSION_SECRET ?? createHash("sha256").update(`rblx-admin:${e.ADMIN_PASSWORD ?? ""}`).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyPassword(candidate: string): boolean {
  if (!isAdminConfigured()) return false;
  return safeEqual(candidate, env().ADMIN_PASSWORD!);
}

export function createSessionToken(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_TTL_S })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !isAdminConfigured()) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number };
    return typeof exp === "number" && exp * 1000 > now;
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
}

export async function setAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

/** Cron endpoints accept `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically). */
export function verifyCronSecret(header: string | null): boolean {
  const s = env().CRON_SECRET;
  if (!s || !header) return false;
  return safeEqual(header, `Bearer ${s}`);
}
