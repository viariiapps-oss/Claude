import { NextRequest, NextResponse } from "next/server";
import { appUrl, stripe } from "@/lib/billing";
import { readSession, writeSession } from "@/lib/session";

/** Portal de cliente de Stripe: cancelar, cambiar tarjeta, ver facturas. */
export async function POST(req: NextRequest) {
  const session = readSession(req);
  const s = stripe();
  const base = appUrl(req.url);

  if (!s) {
    session.demoPro = false; // en modo simulado, "gestionar" = cancelar
    return writeSession(NextResponse.json({ url: `${base}/` }), session);
  }
  if (!session.customerId) {
    return NextResponse.json(
      { error: { code: "no_customer", message: "No hay ninguna suscripción en este dispositivo." } },
      { status: 400 },
    );
  }
  const portal = await s.billingPortal.sessions.create({
    customer: session.customerId,
    return_url: `${base}/`,
  });
  return NextResponse.json({ url: portal.url });
}
