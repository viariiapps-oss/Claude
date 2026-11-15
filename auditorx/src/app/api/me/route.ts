import { NextRequest, NextResponse } from "next/server";
import { accountFor } from "@/lib/billing";
import { readSession, writeSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = readSession(req);
  const account = await accountFor(session);
  return writeSession(NextResponse.json({ account }), session);
}
