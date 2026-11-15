import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { appUrl, portalUrl } from "@/lib/billing";

/** Portal de cliente de Stripe: cancelar, cambiar tarjeta, ver facturas. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  const url = user ? await portalUrl(user.id, appUrl(req.url)) : null;
  if (!url) {
    return NextResponse.json(
      { error: { code: "no_customer", message: "No hay ninguna compra asociada a esta cuenta." } },
      { status: 400 },
    );
  }
  return NextResponse.json({ url });
}
