import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { paymentsMode } from "@/lib/billing";
import { RENTA_PRICE } from "@/lib/plans";
import { getPass, openPass, rentaCreditsKey } from "@/lib/renta/access";
import { store } from "@/lib/store";

async function status(userId: string | null) {
  const payments = paymentsMode();
  if (!userId) return { loggedIn: false, pass: null, credits: 0, payments, price: RENTA_PRICE };
  const [pass, credits] = await Promise.all([getPass(userId), store.get<number>(rentaCreditsKey(userId))]);
  return { loggedIn: true, pass, credits: Math.max(0, credits ?? 0), payments, price: RENTA_PRICE };
}

export async function GET() {
  const user = await currentUser();
  return NextResponse.json(await status(user?.id ?? null));
}

/**
 * Abre el expediente. Con pagos activos consume una compra de Renta; sin
 * ellos (fase de pruebas) es gratuito, pero siempre exige cuenta.
 */
export async function POST(_req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "login_required", message: "Inicia sesión para continuar." } }, { status: 401 });
  }
  const current = await getPass(user.id);
  if (current && current.docsLeft > 0) return NextResponse.json(await status(user.id));

  if (paymentsMode() !== "off") {
    const left = await store.incrby(rentaCreditsKey(user.id), -1);
    if (left < 0) {
      await store.incrby(rentaCreditsKey(user.id), 1);
      return NextResponse.json({ error: { code: "payment_required", message: "Necesitas comprar el informe de la Renta." } }, { status: 402 });
    }
  }
  await openPass(user.id);
  return NextResponse.json(await status(user.id));
}
