import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Cookie firmada para visitantes sin cuenta: guarda un id anónimo y el
 * contador de auditorías gratuitas del mes. Los usuarios con cuenta llevan
 * su uso en el almacén (ver account.ts).
 */
const COOKIE = "ax_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Session = { id: string; month: string; used: number };

export function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET no está configurada (mínimo 16 caracteres).");
  }
  return "dev-only-secret-change-me";
}

export function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verify(payload: string, mac: string): boolean {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function fresh(): Session {
  return { id: randomUUID(), month: currentMonth(), used: 0 };
}

export function readSession(req: NextRequest): Session {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return fresh();
  const [payload, mac] = raw.split(".");
  if (!payload || !mac || !verify(payload, mac)) return fresh();
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (s.month !== currentMonth()) {
      s.month = currentMonth();
      s.used = 0;
    }
    return { id: s.id, month: s.month, used: s.used };
  } catch {
    return fresh();
  }
}

export function writeSession<T extends NextResponse>(res: T, session: Session): T {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  res.cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}

/**
 * Vale de devolución: si un análisis falla después de descontar la auditoría
 * gratuita, el cliente lo canjea en /api/refund. Solo sirve para devolver el
 * contador al valor exacto que tenía antes, así que reutilizarlo no da nada.
 */
export function refundToken(session: Session, usedBefore: number): string {
  return `${usedBefore}.${sign(`refund.${session.id}.${session.month}.${usedBefore}`)}`;
}

export function redeemRefund(session: Session, token: string): boolean {
  const [n, mac] = token.split(".");
  const usedBefore = Number(n);
  if (!mac || !Number.isInteger(usedBefore)) return false;
  if (!verify(`refund.${session.id}.${session.month}.${usedBefore}`, mac)) return false;
  if (session.used !== usedBefore + 1) return false;
  session.used = usedBefore;
  return true;
}
