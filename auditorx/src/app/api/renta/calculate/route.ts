import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";
import { getPass } from "@/lib/renta/access";
import { RentaError, calcular } from "@/lib/renta/engine";
import { EntradaSchema } from "@/lib/renta/schema";

const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

/** Ejecuta el motor fiscal. No guarda ni registra la entrada ni el resultado. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return error(401, "login_required", "Inicia sesión para continuar.");
  if (!allow(req, "renta-calc", 30)) return error(429, "rate_limited", "Demasiados cálculos seguidos. Espera un minuto.");
  if (!(await getPass(user.id))) return error(402, "no_pass", "No tienes un expediente de Renta abierto.");

  const parsed = EntradaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(400, "bad_request", "Hay datos que faltan o no son válidos. Revisa el formulario.");
  try {
    return NextResponse.json({ resultado: calcular(parsed.data) });
  } catch (err) {
    if (err instanceof RentaError) return error(422, "not_computable", err.message);
    console.error("[renta/calculate]", err instanceof Error ? err.name : "error");
    return error(500, "server_error", "No se pudo completar el cálculo.");
  }
}
