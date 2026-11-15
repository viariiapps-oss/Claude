import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logPurge } from "@/lib/renta/access";

/**
 * El navegador avisa de que ha descartado los documentos y datos del
 * expediente. El servidor no tenía nada guardado; solo anota el hecho.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { docs?: number; motivo?: string };
  const docs = Number.isInteger(body.docs) && body.docs! >= 0 && body.docs! < 1000 ? body.docs! : 0;
  const motivo = ["descarga", "inactividad", "manual"].includes(body.motivo ?? "") ? body.motivo! : "manual";
  await logPurge(user.id, docs, motivo);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
