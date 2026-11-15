import { NextRequest, NextResponse } from "next/server";
import { RegisterError, authProviders, registerUser } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";

const error = (status: number, message: string) => NextResponse.json({ error: { message } }, { status });

/** Crea una cuenta con correo y contraseña. El cliente inicia sesión después. */
export async function POST(req: NextRequest) {
  if (!authProviders.includes("password")) return error(503, "El registro todavía no está activado.");
  if (!allow(req, "register", 5)) return error(429, "Demasiados intentos. Espera un minuto.");

  const { email, password } = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  try {
    await registerUser(email, password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RegisterError) return error(400, err.message);
    console.error("[register]", err);
    return error(500, "No se pudo crear la cuenta. Inténtalo de nuevo.");
  }
}
