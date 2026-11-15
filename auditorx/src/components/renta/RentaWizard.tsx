"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "@/lib/audit-schema";
import { prepareImage } from "@/lib/image";
import { euros } from "@/lib/plans";
import {
  type Campo,
  type DatosPersonales,
  type Documento,
  avisosDocumentos,
  construirEntrada,
  duplicados,
  parseImporte,
} from "@/lib/renta/assemble";
import { CONCEPTOS, CONCEPTO_LABELS, type Concepto, type Extraccion } from "@/lib/renta/extract";
import { type DatosInforme, euro, generarInforme, pdfValido } from "@/lib/renta/pdf";
import { type Respuestas, cuestionarioCompleto, evaluar, preguntasVisibles } from "@/lib/renta/questionnaire";
import { CCAA_NOMBRES, EJERCICIOS, PROVISIONAL } from "@/lib/renta/rules";
import type { Ccaa, Discapacidad, Ejercicio, Entrada, Modalidad, Resultado } from "@/lib/renta/types";
import { ComingSoonModal } from "../ComingSoon";
import { LoginModal } from "../LoginModal";

/** Minutos sin actividad tras los que se borra el expediente de este dispositivo. */
const INACTIVITY_MINUTES = 20;
const DRAFT_KEY = "ax_renta_draft";

type Step = "intro" | "preguntas" | "no_cubierto" | "acceso" | "datos" | "documentos" | "resultado";
type Access = { loggedIn: boolean; pass: { docsLeft: number } | null; credits: number; payments: "live" | "demo" | "off"; price: number };

const DISCAPACIDADES: { id: Discapacidad; label: string }[] = [
  { id: "ninguna", label: "Sin discapacidad reconocida" },
  { id: "33", label: "Del 33 % al 64 %" },
  { id: "33_ayuda", label: "Del 33 % al 64 % con ayuda de terceros o movilidad reducida" },
  { id: "65", label: "65 % o más" },
];
const MODALIDADES: { id: Modalidad; label: string }[] = [
  { id: "individual", label: "Individual" },
  { id: "conjunta_matrimonio", label: "Conjunta con mi cónyuge" },
  { id: "conjunta_monoparental", label: "Conjunta monoparental (yo y mis hijos)" },
];
const DATOS_INICIALES: DatosPersonales = {
  nombre: "", nif: "", fechaNacimiento: "", discapacidad: "ninguna", modalidad: "individual",
  conyugeFechaNacimiento: "", conyugeDiscapacidad: "ninguna", descendientes: [], ascendientes: [], donativosRecurrentes: false,
};

const formatoImporte = (n: number) => euro(n).replace(" €", "");
const uid = () => Math.random().toString(36).slice(2, 10);
const input = "h-11 w-full rounded-xl border border-line bg-card px-3 text-[15px] outline-none focus:border-ink";
const primary = "h-12 w-full rounded-xl bg-ink font-semibold text-paper transition active:scale-[0.99] disabled:opacity-40";
const card = "rounded-2xl border border-line bg-card p-5";

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{text}</span>
      {children}
    </label>
  );
}

export function RentaWizard() {
  const [step, setStep] = useState<Step>("intro");
  const [ejercicio, setEjercicio] = useState<Ejercicio>(2025);
  const [ccaa, setCcaa] = useState<Ccaa | "">("");
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [datos, setDatos] = useState<DatosPersonales>(DATOS_INICIALES);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [revisado, setRevisado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [entradaFinal, setEntradaFinal] = useState<Entrada | null>(null);
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [borrado, setBorrado] = useState<string>("");
  const [access, setAccess] = useState<Access | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [dialog, setDialog] = useState<"login" | "soon" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const evaluacion = useMemo(() => (ccaa ? evaluar(respuestas, ejercicio, ccaa) : null), [respuestas, ejercicio, ccaa]);
  const avisosDocs = useMemo(() => avisosDocumentos(docs, ejercicio), [docs, ejercicio]);
  const repetidos = useMemo(() => duplicados(docs), [docs]);

  /* ── Privacidad: todo vive en memoria y se borra al terminar o por inactividad ── */
  const wipe = useCallback(
    (motivo: "descarga" | "inactividad" | "manual", conservarResultado: boolean) => {
      const n = docs.length;
      setDocs([]);
      setDatos(DATOS_INICIALES);
      setRespuestas({});
      setRevisado(false);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* sin almacenamiento */
      }
      if (!conservarResultado) {
        setResultado(null);
        setEntradaFinal(null);
        setPdf(null);
        setStep("intro");
      }
      fetch("/api/renta/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docs: n, motivo }),
      }).catch(() => {});
      setBorrado(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    },
    [docs.length],
  );

  useEffect(() => {
    if (step === "intro") return;
    let timer = window.setTimeout(() => wipe("inactividad", false), INACTIVITY_MINUTES * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => wipe("inactividad", false), INACTIVITY_MINUTES * 60_000);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [step, wipe]);

  /* ── Carga inicial: acceso, cuenta y respuestas guardadas antes de iniciar sesión o pagar ── */
  const loadAccess = useCallback(async () => {
    const a = (await fetch("/api/renta/access").then((r) => r.json())) as Access;
    setAccess(a);
    return a;
  }, []);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setAccount(d.account)).catch(() => {});
    loadAccess()
      .then((a) => {
        try {
          const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
          if (draft) {
            setEjercicio(draft.ejercicio);
            setCcaa(draft.ccaa);
            setRespuestas(draft.respuestas);
            setStep(a.pass ? "datos" : "acceso");
          }
        } catch {
          /* borrador ilegible: se empieza de cero */
        }
      })
      .catch(() => {});
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [loadAccess]);

  /** Solo se guardan las respuestas sí/no, para no perderlas al iniciar sesión o pagar. */
  const guardarBorrador = () => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ejercicio, ccaa, respuestas }));
    } catch {
      /* sin almacenamiento */
    }
  };

  async function abrirExpediente() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/renta/access", { method: "POST" });
      const data = await res.json();
      if (res.status === 402) {
        guardarBorrador();
        const pago = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "renta" }),
        }).then((r) => r.json());
        if (pago.url) return void (window.location.href = pago.url);
        throw new Error(pago.error?.message);
      }
      if (!res.ok) throw new Error(data.error?.message);
      setAccess(data);
      setStep("datos");
    } catch (e) {
      setError((e instanceof Error && e.message) || "No se pudo abrir el expediente.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Documentos ── */
  async function subir(files: FileList | null) {
    if (!files) return;
    setError("");
    for (const original of Array.from(files)) {
      const id = uid();
      setDocs((d) => [...d, { id, nombre: original.name, estado: "leyendo", ext: null, campos: [], titular: 0 }]);
      try {
        const body = new FormData();
        body.set("file", await prepareImage(original));
        const res = await fetch("/api/renta/extract", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error?.message || "No se pudo leer.");
        const { campos, ...ext } = data.extraccion as Extraccion;
        if (!ext.legible) throw new Error(ext.motivo || "No se ha podido leer el documento.");
        setDocs((d) =>
          d.map((x) => (x.id === id ? { ...x, estado: "ok", ext, campos: campos.map((c) => ({ ...c, id: uid() })) } : x)),
        );
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : "No se pudo leer.";
        setDocs((d) => d.map((x) => (x.id === id ? { ...x, estado: "error", error: mensaje } : x)));
      }
    }
    setRevisado(false);
    loadAccess().catch(() => {});
  }

  const editarCampo = (docId: string, campoId: string, patch: Partial<Campo>) => {
    setDocs((d) => d.map((x) => (x.id === docId ? { ...x, campos: x.campos.map((c) => (c.id === campoId ? { ...c, ...patch } : c)) } : x)));
    setRevisado(false);
  };

  const [manual, setManual] = useState<{ concepto: Concepto; importe: string; emisor: string }>({ concepto: "retribuciones_integras", importe: "", emisor: "" });
  function anadirManual() {
    const importe = parseImporte(manual.importe);
    if (Number.isNaN(importe)) return setError("Escribe un importe válido, por ejemplo 1.234,56.");
    setError("");
    const nombre = manual.emisor.trim() || "Dato introducido a mano";
    setDocs((d) => {
      const existente = d.find((x) => x.ext === null && x.nombre === nombre);
      const campo: Campo = { id: uid(), concepto: manual.concepto, importe, cita: "" };
      return existente
        ? d.map((x) => (x === existente ? { ...x, campos: [...x.campos, campo] } : x))
        : [...d, { id: uid(), nombre, estado: "ok", ext: null, campos: [campo], titular: 0 }];
    });
    setManual((m) => ({ ...m, importe: "" }));
    setRevisado(false);
  }

  /* ── Cálculo y PDF ── */
  async function calcular() {
    if (!ccaa) return;
    setBusy(true);
    setError("");
    try {
      const entrada = construirEntrada(ejercicio, ccaa, datos, docs);
      const res = await fetch("/api/renta/calculate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entrada) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || "No se pudo calcular.");
      setEntradaFinal(entrada);
      setResultado(data.resultado);
      setPdf(null);
      setStep("resultado");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e instanceof Error && e.message) || "No se pudo calcular.");
    } finally {
      setBusy(false);
    }
  }

  const guardarArchivo = (bytes: Uint8Array) => {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    Object.assign(document.createElement("a"), { href: url, download: `informe-irpf-${resultado?.ejercicio}.pdf` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  async function descargar() {
    if (!resultado || !entradaFinal) return;
    if (pdf) return guardarArchivo(pdf);
    setBusy(true);
    setError("");
    try {
      const info: DatosInforme = { nombre: datos.nombre, nif: datos.nif };
      const bytes = await generarInforme(info, entradaFinal, resultado);
      // Los documentos solo se descartan cuando el informe existe y es válido.
      if (!pdfValido(bytes)) throw new Error("El informe no se ha generado correctamente.");
      setPdf(bytes);
      guardarArchivo(bytes);
      wipe("descarga", true);
    } catch (e) {
      setError((e instanceof Error && e.message) || "No se pudo generar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Pantallas ── */
  const visibles = preguntasVisibles(respuestas);
  const datosCompletos =
    /^\d{4}-\d{2}-\d{2}$/.test(datos.fechaNacimiento) &&
    (datos.modalidad !== "conjunta_matrimonio" || /^\d{4}-\d{2}-\d{2}$/.test(datos.conyugeFechaNacimiento)) &&
    datos.descendientes.every((h) => h.fechaNacimiento) &&
    datos.ascendientes.every((a) => a.fechaNacimiento);
  const hayCifras = docs.some((d) => d.estado === "ok" && d.campos.length > 0);
  const leyendo = docs.some((d) => d.estado === "leyendo");

  return (
    <>
      <nav className="flex items-center justify-between gap-2">
        <a href="/" className="text-lg font-black tracking-tight">
          Auditor<span className="text-stop">X</span> <span className="font-medium text-muted">· Renta</span>
        </a>
        <span className="rounded-full bg-warn px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#16171b]">Beta</span>
      </nav>

      {error && (
        <p className="mt-4 rounded-xl bg-stop/10 px-4 py-3 text-sm text-stop" role="alert">
          {error}
        </p>
      )}

      {step === "intro" && (
        <section className="mt-8">
          <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight">
            Tu renta, calculada <span className="text-stop">con cada cifra justificada</span>
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Respondes unas preguntas, subes tus certificados o nóminas y obtienes un informe en PDF con el resultado y
            el desglose completo, citando la norma de cada paso.
          </p>
          {borrado && (
            <p className="mt-4 rounded-xl bg-go/10 px-4 py-3 text-sm" role="status">
              Expediente borrado de este dispositivo a las {borrado}.
            </p>
          )}
          <ul className="mt-6 flex flex-col gap-3 text-[15px] leading-relaxed">
            <li className={card}>
              <strong>Qué es.</strong> Un informe de cálculo orientativo. No es el Modelo 100 ni un borrador oficial, y
              no presentamos nada ante Hacienda: la declaración la presentas tú en Renta Web.
            </li>
            <li className={card}>
              <strong>Qué cubre hoy.</strong> Nóminas, paro y pensiones, intereses, dividendos, ventas de acciones,
              fondos y cripto, hijos y ascendientes, planes de pensiones y donativos, en Andalucía, Cataluña, Madrid y
              Comunitat Valenciana. Autónomos, alquileres e inmuebles llegarán más adelante.
            </li>
            <li className={card}>
              <strong>Tus documentos no se guardan.</strong> Se leen al momento y se descartan. Los datos viven solo en
              esta pestaña y se borran al descargar el informe o tras {INACTIVITY_MINUTES} minutos sin actividad.
            </li>
          </ul>
          <button onClick={() => setStep("preguntas")} className={`${primary} mt-6`}>
            Empezar
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            {access && access.payments !== "off" ? `${euros(access.price)} por declaración. Antes de pagar sabrás si tu caso está cubierto.` : "Gratis durante la fase de pruebas."}
          </p>
        </section>
      )}

      {step === "preguntas" && (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="text-2xl font-black tracking-tight">Cuéntanos tu año</h1>
          <div className={`${card} grid gap-4 sm:grid-cols-2`}>
            <Label text="Ejercicio">
              <select className={input} value={ejercicio} onChange={(e) => setEjercicio(Number(e.target.value) as Ejercicio)}>
                {EJERCICIOS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {PROVISIONAL[y] ? " (provisional)" : ""}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="Comunidad donde resides">
              <select className={input} value={ccaa} onChange={(e) => setCcaa(e.target.value as Ccaa)}>
                <option value="">Elige…</option>
                {(Object.keys(CCAA_NOMBRES) as Ccaa[]).map((c) => (
                  <option key={c} value={c}>
                    {CCAA_NOMBRES[c]}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          <ol className="flex flex-col gap-2">
            {visibles.map((p) => (
              <li key={p.id} className={`${card} flex items-center justify-between gap-4 !p-4`}>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium leading-snug">{p.texto}</p>
                  {p.ayuda && <p className="mt-0.5 text-xs text-muted">{p.ayuda}</p>}
                </div>
                <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={p.texto}>
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      role="radio"
                      aria-checked={respuestas[p.id] === v}
                      onClick={() => setRespuestas((r) => ({ ...r, [p.id]: v }))}
                      className={`h-10 w-12 rounded-full text-sm font-semibold ${respuestas[p.id] === v ? "bg-ink text-paper" : "border border-line"}`}
                    >
                      {v ? "Sí" : "No"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <button
            disabled={!ccaa || !cuestionarioCompleto(respuestas)}
            onClick={() => {
              if (!evaluacion?.cubierto) return setStep("no_cubierto");
              setStep(access?.pass ? "datos" : "acceso");
              window.scrollTo({ top: 0 });
            }}
            className={primary}
          >
            Continuar
          </button>
        </section>
      )}

      {step === "no_cubierto" && evaluacion && (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="text-2xl font-black tracking-tight">Todavía no podemos preparar tu caso</h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Preferimos decírtelo ahora a darte un resultado que no podamos garantizar. No te hemos cobrado nada.
          </p>
          <ul className={`${card} flex flex-col gap-2 text-[15px] leading-relaxed`}>
            {evaluacion.motivos.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
          <button onClick={() => setDialog("soon")} className={primary}>
            Avísame cuando esté disponible
          </button>
          <button onClick={() => setStep("preguntas")} className="text-sm text-muted underline underline-offset-4">
            Volver al cuestionario
          </button>
        </section>
      )}

      {step === "acceso" && evaluacion && (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="text-2xl font-black tracking-tight">Tu caso está cubierto</h1>
          <div className={card}>
            <p className="text-sm font-semibold">Vas a necesitar:</p>
            <ul className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed">
              {evaluacion.documentos.map((d) => (
                <li key={d.tipo}>
                  <strong>{d.titulo}.</strong> <span className="text-muted">{d.detalle}</span>
                </li>
              ))}
            </ul>
          </div>
          {!access ? (
            <p className="animate-lamp text-sm text-muted">Comprobando tu cuenta…</p>
          ) : !access.loggedIn ? (
            <>
              <p className="text-[15px] leading-relaxed text-muted">Para continuar necesitas una cuenta.</p>
              <button
                onClick={() => {
                  guardarBorrador();
                  setDialog("login");
                }}
                className={primary}
              >
                Entrar o crear cuenta
              </button>
            </>
          ) : (
            <button onClick={abrirExpediente} disabled={busy} className={primary}>
              {busy
                ? "Un momento…"
                : access.payments !== "off" && access.credits === 0
                  ? `Pagar ${euros(access.price)} y continuar`
                  : "Continuar"}
            </button>
          )}
        </section>
      )}

      {step === "datos" && (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="text-2xl font-black tracking-tight">Tus datos</h1>
          <div className={`${card} grid gap-4 sm:grid-cols-2`}>
            <Label text="Nombre y apellidos (opcional, para el informe)">
              <input className={input} value={datos.nombre} autoComplete="name" onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
            </Label>
            <Label text="NIF o NIE (opcional, para el informe)">
              <input className={input} value={datos.nif} onChange={(e) => setDatos({ ...datos, nif: e.target.value.toUpperCase() })} />
            </Label>
            <Label text="Fecha de nacimiento">
              <input type="date" className={input} value={datos.fechaNacimiento} onChange={(e) => setDatos({ ...datos, fechaNacimiento: e.target.value })} />
            </Label>
            <Label text="Discapacidad">
              <select className={input} value={datos.discapacidad} onChange={(e) => setDatos({ ...datos, discapacidad: e.target.value as Discapacidad })}>
                {DISCAPACIDADES.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </Label>
            <div className="sm:col-span-2">
              <Label text="Cómo declaras">
                <select className={input} value={datos.modalidad} onChange={(e) => setDatos({ ...datos, modalidad: e.target.value as Modalidad })}>
                  {MODALIDADES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </Label>
            </div>
            {datos.modalidad === "conjunta_matrimonio" && (
              <>
                <Label text="Fecha de nacimiento de tu cónyuge">
                  <input type="date" className={input} value={datos.conyugeFechaNacimiento} onChange={(e) => setDatos({ ...datos, conyugeFechaNacimiento: e.target.value })} />
                </Label>
                <Label text="Discapacidad de tu cónyuge">
                  <select className={input} value={datos.conyugeDiscapacidad} onChange={(e) => setDatos({ ...datos, conyugeDiscapacidad: e.target.value as Discapacidad })}>
                    {DISCAPACIDADES.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </Label>
              </>
            )}
          </div>

          {respuestas.familia && (
            <>
              <div className={card}>
                <p className="font-semibold">Hijos</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Menores de 25 años (o con discapacidad), que vivan contigo y no tengan rentas superiores a 8.000 €.
                </p>
                {datos.descendientes.map((h, i) => (
                  <div key={i} className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                    <Label text={`Fecha de nacimiento (hijo ${i + 1})`}>
                      <input type="date" className={input} value={h.fechaNacimiento} onChange={(e) => setDatos({ ...datos, descendientes: datos.descendientes.map((x, j) => (j === i ? { ...x, fechaNacimiento: e.target.value } : x)) })} />
                    </Label>
                    <Label text="Discapacidad">
                      <select className={input} value={h.discapacidad} onChange={(e) => setDatos({ ...datos, descendientes: datos.descendientes.map((x, j) => (j === i ? { ...x, discapacidad: e.target.value as Discapacidad } : x)) })}>
                        {DISCAPACIDADES.map((d) => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </select>
                    </Label>
                    {datos.modalidad === "individual" && (
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input type="checkbox" checked={h.compartido} onChange={(e) => setDatos({ ...datos, descendientes: datos.descendientes.map((x, j) => (j === i ? { ...x, compartido: e.target.checked } : x)) })} />
                        Convive también con su otro progenitor (el mínimo se reparte al 50 %)
                      </label>
                    )}
                    <button onClick={() => setDatos({ ...datos, descendientes: datos.descendientes.filter((_, j) => j !== i) })} className="justify-self-start text-sm text-stop underline underline-offset-4">
                      Quitar
                    </button>
                  </div>
                ))}
                <button onClick={() => setDatos({ ...datos, descendientes: [...datos.descendientes, { fechaNacimiento: "", discapacidad: "ninguna", compartido: false }] })} className="mt-3 h-10 rounded-full border border-line px-4 text-sm font-semibold">
                  Añadir hijo
                </button>
              </div>
              <div className={card}>
                <p className="font-semibold">Padres o abuelos a tu cargo</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Mayores de 65 años (o con discapacidad), que vivan contigo al menos medio año y no tengan rentas
                  superiores a 8.000 €.
                </p>
                {datos.ascendientes.map((a, i) => (
                  <div key={i} className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-3">
                    <Label text="Fecha de nacimiento">
                      <input type="date" className={input} value={a.fechaNacimiento} onChange={(e) => setDatos({ ...datos, ascendientes: datos.ascendientes.map((x, j) => (j === i ? { ...x, fechaNacimiento: e.target.value } : x)) })} />
                    </Label>
                    <Label text="Discapacidad">
                      <select className={input} value={a.discapacidad} onChange={(e) => setDatos({ ...datos, ascendientes: datos.ascendientes.map((x, j) => (j === i ? { ...x, discapacidad: e.target.value as Discapacidad } : x)) })}>
                        {DISCAPACIDADES.map((d) => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                      </select>
                    </Label>
                    <Label text="Hijos que conviven con él/ella">
                      <input type="number" min={1} max={10} className={input} value={a.contribuyentesConDerecho} onChange={(e) => setDatos({ ...datos, ascendientes: datos.ascendientes.map((x, j) => (j === i ? { ...x, contribuyentesConDerecho: Math.max(1, Number(e.target.value) || 1) } : x)) })} />
                    </Label>
                    <button onClick={() => setDatos({ ...datos, ascendientes: datos.ascendientes.filter((_, j) => j !== i) })} className="justify-self-start text-sm text-stop underline underline-offset-4">
                      Quitar
                    </button>
                  </div>
                ))}
                <button onClick={() => setDatos({ ...datos, ascendientes: [...datos.ascendientes, { fechaNacimiento: "", discapacidad: "ninguna", contribuyentesConDerecho: 1 }] })} className="mt-3 h-10 rounded-full border border-line px-4 text-sm font-semibold">
                  Añadir ascendiente
                </button>
              </div>
            </>
          )}

          <button disabled={!datosCompletos} onClick={() => { setStep("documentos"); window.scrollTo({ top: 0 }); }} className={primary}>
            Continuar
          </button>
        </section>
      )}

      {step === "documentos" && evaluacion && (
        <section className="mt-6 flex flex-col gap-4">
          <h1 className="text-2xl font-black tracking-tight">Tus documentos</h1>
          <div className={card}>
            <ul className="flex flex-col gap-2 text-[15px] leading-relaxed">
              {evaluacion.documentos.map((d) => (
                <li key={d.tipo}>
                  <strong>{d.titulo}.</strong> <span className="text-muted">{d.detalle}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => fileInput.current?.click()} disabled={leyendo} className={`${primary} mt-4`}>
              {leyendo ? "Leyendo…" : "Subir documentos"}
            </button>
            <input ref={fileInput} type="file" multiple hidden accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => { void subir(e.target.files); e.target.value = ""; }} />
            <p className="mt-2 text-center text-xs text-muted">
              PDF o foto, máx. 10 MB cada uno.{access?.pass ? ` Te quedan ${access.pass.docsLeft} lecturas.` : ""}
            </p>
          </div>

          {docs.map((d) => (
            <article key={d.id} className={`${card} ${repetidos.has(d.id) ? "!border-warn" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.ext?.emisor || d.nombre}</p>
                  <p className="truncate text-xs text-muted">
                    {d.ext ? `${d.nombre} · ${d.ext.periodo_texto || d.ext.periodo}` : "Introducido a mano"}
                  </p>
                </div>
                <button onClick={() => { setDocs((x) => x.filter((y) => y.id !== d.id)); setRevisado(false); }} className="shrink-0 text-sm text-stop underline underline-offset-4">
                  Quitar
                </button>
              </div>
              {d.estado === "leyendo" && <p className="mt-3 animate-lamp text-sm text-muted">Leyendo el documento…</p>}
              {d.estado === "error" && <p className="mt-3 text-sm text-stop">{d.error} Puedes añadir sus datos a mano más abajo.</p>}
              {repetidos.has(d.id) && <p className="mt-3 text-sm font-medium">Parece repetido: quítalo si ya está arriba.</p>}
              {d.ext?.avisos.map((a) => (
                <p key={a} className="mt-2 rounded-lg bg-warn/20 px-3 py-2 text-sm">{a}</p>
              ))}
              {datos.modalidad === "conjunta_matrimonio" && d.estado === "ok" && (
                <div className="mt-3">
                  <Label text="¿De quién es?">
                    <select className={input} value={d.titular} onChange={(e) => setDocs((x) => x.map((y) => (y.id === d.id ? { ...y, titular: Number(e.target.value) as 0 | 1 } : y)))}>
                      <option value={0}>Mío</option>
                      <option value={1}>De mi cónyuge</option>
                    </select>
                  </Label>
                </div>
              )}
              {d.campos.map((c) => (
                <div key={c.id} className="mt-3 border-t border-line pt-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium">{CONCEPTO_LABELS[c.concepto]}</span>
                    <input
                      inputMode="decimal"
                      aria-label={CONCEPTO_LABELS[c.concepto]}
                      className="h-10 w-32 rounded-lg border border-line bg-card px-2 text-right text-[15px] tabular-nums outline-none focus:border-ink"
                      defaultValue={formatoImporte(c.importe)}
                      onBlur={(e) => {
                        const v = parseImporte(e.target.value);
                        if (Number.isNaN(v)) e.target.value = formatoImporte(c.importe);
                        else if (v !== c.importe) editarCampo(d.id, c.id, { importe: v });
                      }}
                    />
                    <button aria-label="Quitar dato" onClick={() => { setDocs((x) => x.map((y) => (y.id === d.id ? { ...y, campos: y.campos.filter((z) => z.id !== c.id) } : y))); setRevisado(false); }} className="size-8 shrink-0 rounded-full text-lg text-muted hover:bg-paper">
                      ×
                    </button>
                  </div>
                  {c.cita && <p className="mt-1 border-l-2 border-line pl-2 text-xs italic text-muted">{c.cita}</p>}
                </div>
              ))}
            </article>
          ))}

          <div className={card}>
            <p className="font-semibold">Añadir un dato a mano</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select aria-label="Concepto" className={input} value={manual.concepto} onChange={(e) => setManual({ ...manual, concepto: e.target.value as Concepto })}>
                {CONCEPTOS.map((c) => (
                  <option key={c} value={c}>{CONCEPTO_LABELS[c]}</option>
                ))}
              </select>
              <input aria-label="Pagador o entidad" placeholder="Pagador o entidad" className={input} value={manual.emisor} onChange={(e) => setManual({ ...manual, emisor: e.target.value })} />
              <input aria-label="Importe" inputMode="decimal" placeholder="Importe (€)" className={input} value={manual.importe} onChange={(e) => setManual({ ...manual, importe: e.target.value })} />
            </div>
            <button onClick={anadirManual} className="mt-3 h-10 rounded-full border border-line px-4 text-sm font-semibold">
              Añadir
            </button>
          </div>

          {respuestas.donaciones && (
            <label className={`${card} flex items-start gap-2 text-sm`}>
              <input type="checkbox" className="mt-0.5" checked={datos.donativosRecurrentes} onChange={(e) => setDatos({ ...datos, donativosRecurrentes: e.target.checked })} />
              Llevo al menos tres años donando a la misma entidad un importe igual o mayor
            </label>
          )}

          {avisosDocs.map((a) => (
            <p key={a} className="rounded-xl bg-warn/25 px-4 py-3 text-sm">{a}</p>
          ))}

          <label className={`${card} flex items-start gap-2 text-[15px]`}>
            <input type="checkbox" className="mt-1" checked={revisado} disabled={!hayCifras || leyendo} onChange={(e) => setRevisado(e.target.checked)} />
            He revisado cada cifra con mis documentos y son correctas
          </label>
          <button disabled={!revisado || busy || leyendo} onClick={calcular} className={primary}>
            {busy ? "Calculando…" : "Calcular mi renta"}
          </button>
          <button onClick={() => setStep("datos")} className="text-sm text-muted underline underline-offset-4">
            Volver a mis datos
          </button>
        </section>
      )}

      {step === "resultado" && resultado && (
        <section className="mt-6 flex flex-col gap-4">
          <div className={`rounded-3xl border-2 p-6 text-center ${resultado.signo === "a_devolver" ? "border-go" : resultado.signo === "a_pagar" ? "border-stop" : "border-ink"}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              {resultado.signo === "a_devolver" ? "Te sale a devolver" : resultado.signo === "a_pagar" ? "Te sale a pagar" : "Resultado cero"}
            </p>
            <p className={`mt-1 text-5xl font-black tracking-tight ${resultado.signo === "a_devolver" ? "text-go" : resultado.signo === "a_pagar" ? "text-stop" : ""}`}>
              {euro(Math.abs(resultado.resultado))}
            </p>
            <p className="mt-2 text-sm text-muted">
              Ejercicio {resultado.ejercicio} · {CCAA_NOMBRES[resultado.ccaa]}
              {resultado.provisional ? " · provisional" : ""}
            </p>
          </div>

          <button onClick={descargar} disabled={busy} className="h-14 w-full rounded-2xl bg-stop text-lg font-bold text-white disabled:opacity-60">
            {busy ? "Generando…" : pdf ? "Descargar de nuevo el PDF" : "Descargar informe en PDF"}
          </button>
          {pdf && borrado && (
            <p className="rounded-xl bg-go/10 px-4 py-3 text-sm leading-relaxed" role="status">
              Informe generado. Tus documentos y los datos leídos de ellos se han borrado de este dispositivo a las{" "}
              {borrado}. El informe sigue disponible hasta que cierres esta pestaña.
            </p>
          )}

          <div className={card}>
            <dl className="flex flex-col text-[15px]">
              {[
                ["Base liquidable general", resultado.baseLiquidableGeneral],
                ["Base liquidable del ahorro", resultado.baseLiquidableAhorro],
                ["Cuota íntegra estatal", resultado.cuotaIntegraEstatal],
                ["Cuota íntegra autonómica", resultado.cuotaIntegraAutonomica],
                ["Deducciones", resultado.deducciones],
                ["Cuota resultante", resultado.cuotaLiquida],
                ["Retenciones", resultado.retenciones],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium tabular-nums">{euro(v as number)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={card}>
            <p className="font-semibold">Revisa antes de presentar</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm leading-relaxed">
              {[...resultado.avisos.map((a) => a.texto), ...(evaluacion?.avisos ?? [])].map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          </div>

          <details className={card}>
            <summary className="cursor-pointer font-semibold">Ver el cálculo paso a paso</summary>
            <ol className="mt-3 flex flex-col gap-3">
              {resultado.pasos.map((p) => (
                <li key={p.id} className="border-t border-line pt-3 text-sm">
                  <p className="flex justify-between gap-4 font-semibold">
                    <span>{p.concepto}</span>
                    <span className="tabular-nums">{euro(p.importe)}</span>
                  </p>
                  <p className="mt-1 text-muted">{p.formula}</p>
                  <p className="text-xs text-muted">{p.norma}</p>
                </li>
              ))}
            </ol>
          </details>

          <p className="text-xs leading-relaxed text-muted">
            Informe orientativo. No es una declaración oficial ni se ha presentado ante Hacienda. Preséntala en Renta
            Web de la Agencia Tributaria y contrasta las cifras con tus datos fiscales.
          </p>
          <button onClick={() => wipe("manual", false)} className="text-sm text-muted underline underline-offset-4">
            Borrar todo y salir
          </button>
        </section>
      )}

      {dialog === "login" && account && <LoginModal account={account} initialMode="register" onClose={() => setDialog(null)} />}
      {dialog === "soon" && <ComingSoonModal feature="renta" defaultEmail={account?.user?.email ?? ""} onClose={() => setDialog(null)} />}
    </>
  );
}
