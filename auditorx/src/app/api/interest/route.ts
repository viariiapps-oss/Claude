import { NextRequest, NextResponse } from "next/server";
import { isFeature, recordClick, recordLead } from "@/lib/leads";
import { allow } from "@/lib/rate-limit";
import { storeReady } from "@/lib/store";

/**
 * Funciones «próximamente». Sin `email` registra el clic (mide interés); con
 * `email` apunta a la persona para avisarla y reservarle el descuento.
 */
export async function POST(req: NextRequest) {
  const { feature, email, choice } = (await req.json().catch(() => ({}))) as {
    feature?: string;
    email?: string;
    choice?: string;
  };
  if (!isFeature(feature)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!allow(req, "interest", 20)) return NextResponse.json({ ok: false }, { status: 429 });
  if (!storeReady) {
    return NextResponse.json(
      { ok: false, message: "Ahora mismo no podemos guardar tu correo. Vuelve a intentarlo más tarde." },
      { status: 503 },
    );
  }

  if (email === undefined) {
    await recordClick(feature);
    return NextResponse.json({ ok: true });
  }
  if (typeof email !== "string" || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ ok: false, message: "Ese correo no parece válido." }, { status: 400 });
  }
  await recordLead(feature, email, typeof choice === "string" ? choice : undefined);
  return NextResponse.json({ ok: true });
}
