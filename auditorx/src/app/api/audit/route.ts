import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT, userInstruction } from "@/lib/audit-prompt";
import { AuditSchema, CATEGORIES, type Audit, type Category } from "@/lib/audit-schema";
import { accountFor, hasQuota } from "@/lib/billing";
import { MOCK_AUDIT } from "@/lib/mock";
import { allow } from "@/lib/rate-limit";
import { readSession, writeSession, type Session } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

// Lee ANTHROPIC_API_KEY del entorno. Se crea una vez por instancia.
let anthropic: Anthropic | null = null;

async function fail(session: Session, status: number, code: string, message: string) {
  const account = await accountFor(session).catch(() => undefined);
  return writeSession(NextResponse.json({ error: { code, message }, account }, { status }), session);
}

function documentBlock(type: string, data: string): Anthropic.ContentBlockParam {
  if (type === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  return { type: "image", source: { type: "base64", media_type: type as ImageType, data } };
}

async function runAudit(type: string, data: string, category: Category): Promise<Audit> {
  if (process.env.AUDITORX_MOCK === "1") {
    await new Promise((r) => setTimeout(r, 1500));
    return MOCK_AUDIT;
  }

  anthropic ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    // "low" mantiene la respuesta por debajo de ~10 s; súbelo a "medium" si
    // prefieres más profundidad a cambio de latencia.
    output_config: { effort: "low", format: zodOutputFormat(AuditSchema) },
    messages: [
      {
        role: "user",
        content: [documentBlock(type, data), { type: "text", text: userInstruction(category) }],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new AuditError("refused");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) throw new AuditError("incomplete");
  return response.parsed_output;
}

class AuditError extends Error {
  constructor(public kind: "refused" | "incomplete") {
    super(kind);
  }
}

export async function POST(req: NextRequest) {
  const session = readSession(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(ip)) {
    return fail(session, 429, "rate_limited", "Demasiadas peticiones seguidas. Espera un minuto.");
  }

  // 1. Cuota: se comprueba antes de leer el archivo y de gastar tokens.
  const account = await accountFor(session);
  if (!hasQuota(account)) {
    return fail(
      session,
      402,
      "quota_exceeded",
      account.pro
        ? "Has agotado tus auditorías de este mes."
        : "Has usado tus auditorías gratuitas de este mes.",
    );
  }

  // 2. Validación del archivo.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(session, 400, "bad_request", "No se pudo leer el archivo enviado.");
  }
  const file = form.get("file");
  const rawCategory = String(form.get("category") ?? "otro");
  const category: Category = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : "otro";

  if (!(file instanceof File) || file.size === 0) {
    return fail(session, 400, "no_file", "Sube un PDF o una imagen del documento.");
  }
  if (file.size > MAX_BYTES) {
    return fail(session, 413, "too_large", "El archivo supera los 10 MB.");
  }
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return fail(session, 415, "bad_type", "Formato no admitido. Usa PDF, JPG, PNG o WebP.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (isPdf && bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return fail(session, 415, "bad_type", "El archivo no parece un PDF válido.");
  }

  // 3. Análisis con Claude. El archivo solo vive en memoria durante la petición.
  let audit: Audit;
  try {
    audit = await runAudit(file.type, bytes.toString("base64"), category);
  } catch (err) {
    if (err instanceof AuditError) {
      return err.kind === "refused"
        ? fail(session, 422, "refused", "No podemos analizar este documento.")
        : fail(session, 502, "incomplete", "El análisis quedó incompleto. Inténtalo de nuevo.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return fail(session, 503, "busy", "Hay mucha demanda ahora mismo. Prueba en unos segundos.");
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("[audit] 400 de Anthropic:", err.message);
      return fail(
        session,
        422,
        "unreadable",
        "No se pudo procesar el archivo. Si es un PDF protegido o muy largo, prueba con una foto.",
      );
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return fail(session, 504, "timeout", "El análisis tardó demasiado. Inténtalo de nuevo.");
    }
    console.error("[audit] error inesperado:", err);
    return fail(session, 500, "server_error", "Algo ha fallado al analizar. Inténtalo de nuevo.");
  }

  if (!audit.documento_legible) {
    return fail(
      session,
      422,
      "unreadable",
      audit.motivo_no_legible || "No hemos podido leer el documento. Prueba con una foto más nítida.",
    );
  }

  // 4. Solo los análisis entregados consumen cuota.
  session.used += 1;
  audit.puntos_criticos = audit.puntos_criticos.slice(0, 3);
  return writeSession(
    NextResponse.json({ audit, account: { ...account, used: session.used } }),
    session,
  );
}
