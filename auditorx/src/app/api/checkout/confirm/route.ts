import { NextRequest, NextResponse } from "next/server";
import { appUrl, stripe } from "@/lib/billing";
import { readSession, writeSession } from "@/lib/session";

/**
 * Stripe redirige aquí tras el pago. Se verifica la sesión de Checkout contra
 * la API de Stripe (no se confía en la URL) y se vincula el cliente a la cookie.
 */
export async function GET(req: NextRequest) {
  const base = appUrl(req.url);
  const session = readSession(req);
  const s = stripe();
  const id = req.nextUrl.searchParams.get("session_id");
  if (!s || !id) return NextResponse.redirect(`${base}/`);

  try {
    const checkout = await s.checkout.sessions.retrieve(id);
    const customerId = typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
    if (checkout.status === "complete" && customerId) {
      session.customerId = customerId;
      session.pro = undefined;
      session.proCheckedAt = undefined; // fuerza la comprobación en Stripe
      return writeSession(NextResponse.redirect(`${base}/?pro=1`), session);
    }
  } catch (err) {
    console.error("[checkout/confirm]", err);
  }
  return NextResponse.redirect(`${base}/?pro=0`);
}
