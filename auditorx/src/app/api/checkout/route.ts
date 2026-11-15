import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { CheckoutError, type Purchase, appUrl, startCheckout } from "@/lib/billing";

const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return error(401, "login_required", "Inicia sesión para comprar.");

  const body = (await req.json().catch(() => null)) as Purchase | null;
  if (!body || (body.kind !== "plan" && body.kind !== "pack" && body.kind !== "renta")) {
    return error(400, "bad_request", "Compra no válida.");
  }
  try {
    return NextResponse.json({ url: await startCheckout(user, body, appUrl(req.url)) });
  } catch (err) {
    if (err instanceof CheckoutError) return error(400, "checkout", err.message);
    console.error("[checkout]", err);
    return error(500, "server_error", "No se pudo iniciar el pago. Inténtalo de nuevo.");
  }
}
