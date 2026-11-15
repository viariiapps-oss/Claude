import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextRequest, NextResponse } from "next/server";
import { accountFor, consume } from "@/lib/account";
import { systemPrompt, userInstruction } from "@/lib/audit-prompt";
import { type Account, type Audit, AuditSchema, CATEGORIES, type Category } from "@/lib/audit-schema";
import { currentUser } from "@/lib/auth";
import { MOCK_AUDIT } from "@/lib/mock";
import { allow } from "@/lib/rate-limit";
import { readSession, refundToken, writeSession } from "@/lib/session";
import { MOCK } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

// Lee ANTHROPIC_API_KEY del entorno. Se crea una vez por instancia.
let anthropic: Anthropic | null = null;

type Failure = { code: string; message: string };

class AuditError extends Error {
  constructor(public failure: Failure) {
    super(failure.code);
  }
}

function documentBlock(type: string, data: string): Anthropic.ContentBlockParam {
  if (type === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  return { type: "image", source: { type: "base64", media_type: type as ImageType, data } };
}

/**
 * Pide el análisis a Claude en streaming. `onDelta` recibe los trozos de JSON
 * según se generan, para que la interfaz pinte el semáforo y el veredicto sin
 * esperar al final; el valor devuelto es el análisis completo ya validado.
 */
async function runAudit(
  type: string,
  data: string,
  category: Category,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<Audit> {
  if (MOCK) {
    const json = JSON.stringify(MOCK_AUDIT);
    for (let i = 0; i < json.length; i += 40) {
      await new Promise((r) => setTimeout(r, 45));
      onDelta(json.slice(i, i + 40));
    }
    return MOCK_AUDIT;
  }

  anthropic ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });
  const stream = anthropic.messages.stream(
    {
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt(category),
      // "low" prioriza la rapidez; súbelo a "medium" para más profundidad.
      output_config: { effort: "low", format: zodOutputFormat(AuditSchema) },
      messages: [
        {
          role: "user",
          content: [documentBlock(type, data), { type: "text", text: userInstruction(category) }],
        },
      ],
    },
    { signal },
  );
  stream.on("text", onDelta);
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new AuditError({ code: "refused", message: "No podemos analizar este documento." });
  }
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: ReturnType<typeof AuditSchema.safeParse> | null = null;
  try {
    parsed = AuditSchema.safeParse(JSON.parse(text));
  } catch {
    /* JSON cortado: se trata abajo */
  }
  if (message.stop_reason === "max_tokens" || !parsed?.success) {
    throw new AuditError({ code: "incomplete", message: "El análisis quedó incompleto. Inténtalo de nuevo." });
  }
  return parsed.data;
}

function describe(err: unknown): Failure {
  if (err instanceof AuditError) return err.failure;
  if (err instanceof Anthropic.RateLimitError) {
    return { code: "busy", message: "Hay mucha demanda ahora mismo. Prueba en unos segundos." };
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("[audit] 400 de Anthropic:", err.message);
    return {
      code: "unreadable",
      message: "No se pudo procesar el archivo. Si es un PDF protegido o muy largo, prueba con una foto.",
    };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { code: "timeout", message: "El análisis tardó demasiado. Inténtalo de nuevo." };
  }
  console.error("[audit] error inesperado:", err);
  return { code: "server_error", message: "Algo ha fallado al analizar. Inténtalo de nuevo." };
}

export async function POST(req: NextRequest) {
  const session = readSession(req);
  const user = await currentUser();
  let account = await accountFor(user, session);

  const fail = (status: number, code: string, message: string) =>
    writeSession(NextResponse.json({ error: { code, message }, account }, { status }), session);

  if (!allow(req, "audit", 8)) {
    return fail(429, "rate_limited", "Demasiadas peticiones seguidas. Espera un minuto.");
  }

  // 1. Cuota: se comprueba antes de leer el archivo y de gastar tokens.
  if (account.remaining <= 0) {
    return fail(402, "quota_exceeded", "Te has quedado sin auditorías este mes.");
  }

  // 2. Validación del archivo.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "bad_request", "No se pudo leer el archivo enviado.");
  }
  const file = form.get("file");
  const rawCategory = String(form.get("category") ?? "otro");
  const category: Category = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : "otro";

  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "no_file", "Sube un PDF o una imagen del documento.");
  }
  if (file.size > MAX_BYTES) return fail(413, "too_large", "El archivo supera los 10 MB.");
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return fail(415, "bad_type", "Formato no admitido. Usa PDF, JPG, PNG o WebP.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (isPdf && bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return fail(415, "bad_type", "El archivo no parece un PDF válido.");
  }

  // 3. Cobro. Las cabeceras (y la cookie) salen antes que el análisis, así que
  //    al visitante sin cuenta se le descuenta ya y, si algo falla, recibe un
  //    vale de devolución. Al usuario con cuenta se le descuenta solo al final.
  const usedBefore = session.used;
  if (!user) {
    session.used += 1;
    account = { ...account, used: session.used, remaining: account.remaining - 1 };
  }

  // 4. Análisis en streaming (NDJSON). El archivo solo vive en memoria.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          /* el cliente cerró la conexión */
        }
      };
      const refund = (failure: Failure, acct: Account) =>
        send({
          error: failure,
          ...(user
            ? { account: acct }
            : {
                refund: refundToken(session, usedBefore),
                account: { ...acct, used: usedBefore, remaining: acct.remaining + 1 },
              }),
        });

      try {
        const audit = await runAudit(
          file.type,
          bytes.toString("base64"),
          category,
          (d) => send({ d }),
          req.signal,
        );
        if (!audit.documento_legible) {
          refund(
            {
              code: "unreadable",
              message:
                audit.motivo_no_legible ||
                "No hemos podido leer el documento. Prueba con una foto más nítida.",
            },
            account,
          );
        } else {
          audit.puntos_criticos = audit.puntos_criticos.slice(0, 3);
          if (user) account = await consume(user, account);
          send({ done: true, audit, account });
        }
      } catch (err) {
        refund(describe(err), account);
      }
      controller.close();
    },
  });

  return writeSession(
    new NextResponse(body, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    }),
    session,
  );
}
