import { NextRequest, NextResponse } from "next/server";
import { fulfill, invalidatePlan, stripe } from "@/lib/billing";

/**
 * Webhook de Stripe (opcional, recomendado). Entrega la compra aunque el
 * usuario cierre la pestaña antes de volver, y refleja las cancelaciones al
 * momento. Eventos: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted.
 */
export async function POST(req: NextRequest) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!s || !secret || !signature) return NextResponse.json({ error: "no configurado" }, { status: 400 });

  let event;
  try {
    event = s.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "firma no válida" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    await fulfill(event.data.object.id);
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const userId = event.data.object.metadata.userId;
    if (userId) await invalidatePlan(userId);
  }
  return NextResponse.json({ received: true });
}
