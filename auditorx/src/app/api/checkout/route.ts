import { NextRequest, NextResponse } from "next/server";
import { appUrl, priceId, stripe } from "@/lib/billing";
import { readSession, writeSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = readSession(req);
  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan === "yearly" ? "yearly" : "monthly";
  const base = appUrl(req.url);

  const s = stripe();
  if (!s) {
    // Pago simulado: sin claves de Stripe se desbloquea Pro al instante.
    session.demoPro = true;
    return writeSession(NextResponse.json({ url: `${base}/?pro=1` }), session);
  }

  const price = priceId(plan);
  if (!price) {
    return NextResponse.json(
      { error: { code: "no_price", message: "Este plan no está disponible." } },
      { status: 400 },
    );
  }

  const checkout = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(session.customerId ? { customer: session.customerId } : {}),
    client_reference_id: session.id,
    locale: "es",
    success_url: `${base}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/`,
  });

  return writeSession(NextResponse.json({ url: checkout.url }), session);
}
