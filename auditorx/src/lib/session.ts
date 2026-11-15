import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE = "ax_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Session = {
  id: string;
  /** Mes al que pertenece el contador, "2026-11" */
  month: string;
  used: number;
  customerId?: string;
  /** Resultado cacheado de la última comprobación en Stripe */
  pro?: boolean;
  proCheckedAt?: number;
  /** Solo en modo de pago simulado (sin claves de Stripe) */
  demoPro?: boolean;
};

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET no está configurada (mínimo 16 caracteres).");
  }
  return "dev-only-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
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
  if (!payload || !mac) return fresh();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return fresh();
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (s.month !== currentMonth()) {
      s.month = currentMonth();
      s.used = 0;
    }
    return s;
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
