import type { Concepto, Extraccion } from "./extract";
import type { Ascendiente, Ccaa, Descendiente, Discapacidad, Ejercicio, Entrada, Modalidad, RendimientoTrabajo } from "./types";

/**
 * Convierte lo que el usuario ha revisado en pantalla (documentos leídos y
 * datos personales) en la entrada del motor. No hay IA aquí: solo sumas y
 * agrupaciones deterministas.
 */

export type Campo = { id: string; concepto: Concepto; importe: number; cita: string };

export type Documento = {
  id: string;
  nombre: string;
  estado: "leyendo" | "ok" | "error";
  error?: string;
  /** null en los datos introducidos a mano. */
  ext: Omit<Extraccion, "campos"> | null;
  campos: Campo[];
  titular: 0 | 1;
};

export type DatosPersonales = {
  nombre: string;
  nif: string;
  fechaNacimiento: string;
  discapacidad: Discapacidad;
  modalidad: Modalidad;
  conyugeFechaNacimiento: string;
  conyugeDiscapacidad: Discapacidad;
  descendientes: Descendiente[];
  ascendientes: Ascendiente[];
  donativosRecurrentes: boolean;
};

const TRABAJO: Concepto[] = ["retribuciones_integras", "prestacion_integra", "retenciones_irpf", "cotizaciones_seguridad_social"];

const total = (docs: Documento[], concepto: Concepto, titular?: 0 | 1): number =>
  Math.round(
    docs
      .filter((d) => titular === undefined || d.titular === titular)
      .flatMap((d) => d.campos)
      .filter((c) => c.concepto === concepto)
      .reduce((s, c) => s + c.importe, 0) * 100,
  ) / 100;

const emisorDe = (d: Documento) => d.ext?.emisor?.trim() || d.nombre;
const claveEmisor = (d: Documento) => `${d.titular}|${(d.ext?.emisor_nif || emisorDe(d)).trim().toLowerCase()}`;

/** Documentos repetidos: mismo emisor, mismo periodo y mismas cifras. */
export function duplicados(docs: Documento[]): Set<string> {
  const vistos = new Map<string, string>();
  const repetidos = new Set<string>();
  for (const d of docs) {
    if (d.estado !== "ok" || !d.ext) continue;
    const firma = [claveEmisor(d), d.ext.tipo, d.ext.periodo_texto, ...d.campos.map((c) => `${c.concepto}:${c.importe}`).sort()].join("#");
    if (vistos.has(firma)) repetidos.add(d.id);
    else vistos.set(firma, d.id);
  }
  return repetidos;
}

/** Avisos sobre la documentación que conviene resolver antes de calcular. */
export function avisosDocumentos(docs: Documento[], ejercicio: Ejercicio): string[] {
  const avisos: string[] = [];
  const ok = docs.filter((d) => d.estado === "ok");
  if (duplicados(ok).size > 0) avisos.push("Hay documentos que parecen repetidos. Quita los que sobren para no sumar dos veces.");
  for (const d of ok) {
    if (d.ext && d.ext.ejercicio > 0 && d.ext.ejercicio !== ejercicio) {
      avisos.push(`«${d.nombre}» parece del ejercicio ${d.ext.ejercicio}, no de ${ejercicio}.`);
    }
  }
  const nominas = new Map<string, { emisor: string; n: number; anual: boolean }>();
  for (const d of ok) {
    if (!d.ext || !d.campos.some((c) => TRABAJO.includes(c.concepto))) continue;
    const g = nominas.get(claveEmisor(d)) ?? { emisor: emisorDe(d), n: 0, anual: false };
    if (d.ext.periodo === "anual") g.anual = true;
    else g.n += 1;
    nominas.set(claveEmisor(d), g);
  }
  for (const g of nominas.values()) {
    if (g.anual && g.n > 0) avisos.push(`De ${g.emisor} has subido un certificado anual y además nóminas: se están sumando las dos cosas. Deja solo el certificado.`);
    else if (!g.anual && g.n > 0 && g.n < 12) avisos.push(`De ${g.emisor} hay ${g.n} ${g.n === 1 ? "nómina" : "nóminas"}. Comprueba que están todas las del año (pagas extra incluidas).`);
  }
  return avisos;
}

export function construirEntrada(ejercicio: Ejercicio, ccaa: Ccaa, datos: DatosPersonales, docs: Documento[]): Entrada {
  const ok = docs.filter((d) => d.estado === "ok");
  const conjuntaMatrimonio = datos.modalidad === "conjunta_matrimonio";

  // Un rendimiento del trabajo por pagador y titular: suma sus nóminas o toma su certificado.
  const grupos = new Map<string, Documento[]>();
  for (const d of ok) {
    if (!d.campos.some((c) => TRABAJO.includes(c.concepto))) continue;
    grupos.set(claveEmisor(d), [...(grupos.get(claveEmisor(d)) ?? []), d]);
  }
  const trabajo: RendimientoTrabajo[] = [...grupos.entries()].map(([clave, grupo]) => {
    const salario = total(grupo, "retribuciones_integras");
    const prestacion = total(grupo, "prestacion_integra");
    const tipo = grupo.find((d) => d.ext)?.ext?.tipo;
    const fuentes = grupo.flatMap((d) => d.campos.filter((c) => TRABAJO.includes(c.concepto) && c.cita).map((c) => `${d.nombre}: «${c.cita}»`));
    return {
      id: clave,
      titular: conjuntaMatrimonio ? grupo[0].titular : 0,
      clase: salario >= prestacion ? "salario" : tipo === "certificado_prestacion" && /pensi/i.test(emisorDe(grupo[0])) ? "pension" : "desempleo",
      pagador: emisorDe(grupo[0]),
      integro: Math.round((salario + prestacion) * 100) / 100,
      retencion: total(grupo, "retenciones_irpf"),
      cotizaciones: total(grupo, "cotizaciones_seguridad_social"),
      fuente: fuentes.slice(0, 3).join(" · ").slice(0, 300) || undefined,
    };
  });

  return {
    ejercicio,
    ccaa,
    modalidad: datos.modalidad,
    declarante: { fechaNacimiento: datos.fechaNacimiento, discapacidad: datos.discapacidad },
    conyuge: conjuntaMatrimonio ? { fechaNacimiento: datos.conyugeFechaNacimiento, discapacidad: datos.conyugeDiscapacidad } : undefined,
    descendientes: datos.descendientes.map((h) => ({ ...h, compartido: datos.modalidad === "individual" && h.compartido })),
    ascendientes: datos.ascendientes,
    trabajo,
    cuotasSindicales: total(ok, "cuota_sindical"),
    defensaJuridica: 0,
    intereses: total(ok, "intereses"),
    dividendos: total(ok, "dividendos"),
    retencionesCapital: total(ok, "retenciones_capital"),
    gananciasPatrimoniales: Math.round((total(ok, "ganancia_patrimonial_neta") - total(ok, "perdida_patrimonial_neta")) * 100) / 100,
    retencionesGanancias: total(ok, "retenciones_ganancias"),
    aportacionesPensiones: [total(ok, "aportacion_plan_pensiones", conjuntaMatrimonio ? 0 : undefined), conjuntaMatrimonio ? total(ok, "aportacion_plan_pensiones", 1) : 0],
    donativos: total(ok, "donativo"),
    donativosRecurrentes: datos.donativosRecurrentes,
  };
}

/**
 * Interpreta un importe escrito a la española: «1.234,56», «2.540» (el punto
 * separa millares) o «1234,5». También admite «1234.56». Devuelve NaN si no
 * es un importe válido.
 */
export function parseImporte(texto: string): number {
  const t = texto.trim().replace(/\s|€/g, "");
  if (!t) return Number.NaN;
  let normal: string;
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, "");
  else normal = t;
  return /^\d+(\.\d+)?$/.test(normal) ? Math.round(Number(normal) * 100) / 100 : Number.NaN;
}
