import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { leadReport } from "@/lib/leads";

/**
 * Informe de las funciones «próximamente»: clics y correos por función, y la
 * lista de interesados. Protegido con ADMIN_SECRET:
 *   curl -H "Authorization: Bearer $ADMIN_SECRET" https://tu-app/api/admin/leads
 * Añade ?format=csv para descargar los correos.
 */
export async function GET(req: NextRequest) {
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
