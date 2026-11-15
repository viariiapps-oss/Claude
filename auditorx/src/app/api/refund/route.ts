import { NextRequest, NextResponse } from "next/server";
import { readSession, redeemRefund, writeSession } from "@/lib/session";

/** Devuelve la auditoría gratuita descontada cuando el análisis falló. */
export async function POST(req: NextRequest) {
  const session = readSession(req);
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  const ok = typeof token === "string" && redeemRefund(session, token);
  return writeSession(NextResponse.json({ ok }), session);
}
