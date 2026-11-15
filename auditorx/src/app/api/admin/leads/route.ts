import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { leadReport } from "@/lib/leads";

/**
 * Informe de las funciones «próximamente». Solo lo ve el dueño, y hacen falta
 * las dos cosas a la vez:
 *   1. tener la sesión iniciada con el correo de ADMIN_EMAIL, y
 *   2. conocer la clave ADMIN_SECRET.
 * El correo solo no basta: el registro con contraseña no verifica la
 * dirección, así que otra persona podría registrarse antes con ese correo.
 * Para cualquier otro visitante la ruta responde 404, como si no existiera.
 */
export async function GET(req: NextRequest) {
  const owner = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const user = await currentUser();
  if (!owner || user?.email.toLowerCase() !== owner) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  const secret = process.env.ADMIN_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    secret &&
    secret.length >= 16 &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const report = await leadReport();
  if (req.nextUrl.searchParams.get("format") === "csv") {
    const rows = report.leads.map((l) => [l.email, l.features.join("|"), l.at, l.used ? "si" : "no"].join(","));
    return new NextResponse(["email,funciones,fecha,descuento_usado", ...rows].join("\n"), {
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  }
  return NextResponse.json(report);
}
