import { NextRequest, NextResponse } from "next/server";
import { accountFor } from "@/lib/account";
import { currentUser } from "@/lib/auth";
import { readSession, writeSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = readSession(req);
  const account = await accountFor(await currentUser(), session);
  return writeSession(NextResponse.json({ account }), session);
}
