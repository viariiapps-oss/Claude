import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";
import { useDoc } from "@/lib/renta/access";
import { EXTRACT_SYSTEM, type Extraccion, ExtraccionSchema } from "@/lib/renta/extract";
import { MOCK } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.RENTA_MODEL || process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

let anthropic: Anthropic | null = null;

const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

const MOCK_EXTRACCION: Extraccion = {
  legible: true, motivo: "", tipo: "certificado_retenciones", ejercicio: 2025, periodo: "anual", periodo_texto: "Ejercicio 2025",
  emisor: "Ejemplo Servicios, S.L.", emisor_nif: "B00000000", titular: "Persona de Ejemplo",
  campos: [
    { concepto: "retribuciones_integras", importe: 30000, cita: "Retribuciones dinerarias: importe íntegro satisfecho 30.000,00" },
    { concepto: "retenciones_irpf", importe: 4800, cita: "Retenciones practicadas 4.800,00" },
    { concepto: "cotizaciones_seguridad_social", importe: 1905, cita: "Gastos fiscalmente deducibles: cotizaciones a la Seguridad Social 1.905,00" },
  ],
  avisos: [],
};

/**
 * Lee un documento fiscal y devuelve sus datos. El archivo se procesa en
 * memoria y no se guarda: ni en disco, ni en la base de datos, ni en los
 * registros. Lo que devuelve tampoco se almacena en el servidor.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return error(401, "login_required", "Inicia sesión para continuar.");
  if (!allow(req, "renta-extract", 12)) return error(429, "rate_limited", "Demasiados documentos seguidos. Espera un minuto.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, "bad_request", "No se pudo leer el archivo enviado.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return error(400, "no_file", "Sube un PDF o una imagen.");
  if (file.size > MAX_BYTES) return error(413, "too_large", "El archivo supera los 10 MB.");
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return error(415, "bad_type", "Formato no admitido. Usa PDF, JPG, PNG o WebP.");
  }

  if (!(await useDoc(user.id))) {
    return error(402, "no_pass", "No tienes un expediente de Renta abierto o has agotado las lecturas de documentos.");
  }
  if (MOCK) return NextResponse.json({ extraccion: MOCK_EXTRACCION });

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const block: Anthropic.ContentBlockParam = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: file.type as (typeof IMAGE_TYPES)[number], data } };

  try {
    anthropic ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: EXTRACT_SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(ExtraccionSchema) },
      messages: [{ role: "user", content: [block, { type: "text", text: "Transcribe los datos fiscales de este documento." }] }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return error(422, "unreadable", "No se pudo leer este documento. Puedes introducir los datos a mano.");
    }
    const extraccion = response.parsed_output;
    // Nunca se aceptan importes negativos o no numéricos, vengan de donde vengan.
    extraccion.campos = extraccion.campos.filter((c) => Number.isFinite(c.importe) && c.importe >= 0);
    return NextResponse.json({ extraccion });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return error(503, "busy", "Hay mucha demanda ahora mismo. Prueba en unos segundos.");
    if (err instanceof Anthropic.BadRequestError) return error(422, "unreadable", "No se pudo procesar el archivo. Prueba con una foto o introduce los datos a mano.");
    // Solo se registra el tipo de error, nunca el contenido del documento.
    console.error("[renta/extract]", err instanceof Error ? err.name : "error");
    return error(500, "server_error", "Algo ha fallado al leer el documento. Inténtalo de nuevo.");
  }
}
