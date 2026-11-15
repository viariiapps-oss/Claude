import { NextRequest, NextResponse } from "next/server";
import { appUrl, fulfill } from "@/lib/billing";

/**
 * Stripe redirige aquí tras el pago. No se confía en la URL: `fulfill`
 * consulta la sesión de Checkout en Stripe y entrega la compra una sola vez.
 */
export async function GET(req: NextRequest) {
  const base = appUrl(req.url);
  const id = req.nextUrl.searchParams.get("session_id");
  try {
    const kind = id ? await fulfill(id) : null;
    return NextResponse.redirect(`${base}/?ok=${kind ?? "0"}`);
  } catch (err) {
    console.error("[checkout/confirm]", err);
    return NextResponse.redirect(`${base}/?ok=0`);
  }
}
