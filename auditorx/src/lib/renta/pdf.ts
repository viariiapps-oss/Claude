import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import { CCAA_NOMBRES } from "./rules";
import type { Entrada, Resultado } from "./types";

/**
 * Informe de cálculo en PDF. Se genera en el navegador: los datos no pasan
 * por el servidor ni se guardan en él.
 */

export type DatosInforme = { nombre: string; nif: string };

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const INK = rgb(0.086, 0.09, 0.106);
const MUTED = rgb(0.42, 0.416, 0.4);
const LINE = rgb(0.85, 0.84, 0.8);
const GREEN = rgb(0.09, 0.64, 0.29);
const RED = rgb(0.86, 0.15, 0.15);

export const euro = (n: number): string =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions) + " €";

/** La fuente estándar del PDF solo admite WinAnsi: se sustituyen los símbolos que no existen en ella. */
function limpio(text: string): string {
  return text
    .replace(/−/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7e¡-ÿ€–—…]/g, "");
}

const MODALIDAD: Record<Resultado["modalidad"], string> = {
  individual: "Tributación individual",
  conjunta_matrimonio: "Tributación conjunta (matrimonio)",
  conjunta_monoparental: "Tributación conjunta (familia monoparental)",
};

export async function generarInforme(datos: DatosInforme, entrada: Entrada, r: Resultado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Informe de cálculo IRPF ${r.ejercicio}`);
  pdf.setCreator("AuditorX");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGIN;
  const width = A4[0] - MARGIN * 2;

  const ensure = (space: number) => {
    if (y - space < MARGIN + 30) {
      page = pdf.addPage(A4);
      y = A4[1] - MARGIN;
    }
  };

  const wrap = (text: string, font: PDFFont, size: number, max: number): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of limpio(text).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > max && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  const text = (t: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const indent = opts.indent ?? 0;
    for (const line of wrap(t, font, size, width - indent)) {
      ensure(size + 4);
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color: opts.color ?? INK });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };

  const rule = () => {
    ensure(10);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.6, color: LINE });
    y -= 8;
  };

  const heading = (t: string) => {
    y -= 10;
    ensure(40);
    text(t.toUpperCase(), { size: 9, font: bold, color: MUTED, gap: 2 });
    rule();
  };

  const row = (label: string, value: string, strong = false) => {
    ensure(18);
    const font = strong ? bold : regular;
    page.drawText(limpio(label), { x: MARGIN, y: y - 10, size: 10, font, color: INK });
    const v = limpio(value);
    page.drawText(v, { x: MARGIN + width - font.widthOfTextAtSize(v, 10), y: y - 10, size: 10, font, color: INK });
    y -= 16;
  };

  /* Cabecera */
  text("Informe de cálculo del IRPF", { size: 20, font: bold, gap: 2 });
  text(`Ejercicio ${r.ejercicio} · ${CCAA_NOMBRES[r.ccaa]} · ${MODALIDAD[r.modalidad]}`, { size: 11, color: MUTED, gap: 6 });
  text(
    "Documento orientativo elaborado por AuditorX. No es el Modelo 100, no es un borrador de la Agencia Tributaria y no se ha presentado ante Hacienda.",
    { size: 9, color: MUTED, gap: 4 },
  );

  /* Resultado */
  y -= 6;
  ensure(70);
  const color = r.signo === "a_devolver" ? GREEN : r.signo === "a_pagar" ? RED : INK;
  page.drawRectangle({ x: MARGIN, y: y - 62, width, height: 62, borderColor: color, borderWidth: 1.5 });
  const etiqueta = r.signo === "a_devolver" ? "A DEVOLVER" : r.signo === "a_pagar" ? "A PAGAR" : "RESULTADO CERO";
  page.drawText(etiqueta, { x: MARGIN + 16, y: y - 26, size: 11, font: bold, color });
  page.drawText(limpio(euro(Math.abs(r.resultado))), { x: MARGIN + 16, y: y - 50, size: 22, font: bold, color });
  y -= 74;

  heading("Contribuyente");
  row("Nombre", datos.nombre || "No indicado");
  row("NIF / NIE", datos.nif || "No indicado");
  row("Fecha de nacimiento", entrada.declarante.fechaNacimiento.split("-").reverse().join("/"));
  row("Descendientes / ascendientes a cargo", `${entrada.descendientes.length} / ${entrada.ascendientes.length}`);

  heading("Resumen");
  const integro = entrada.trabajo.reduce((s, t) => s + t.integro, 0);
  row("Rendimientos íntegros del trabajo", euro(integro));
  row("Rendimiento neto reducido del trabajo", euro(r.rendimientoNetoTrabajo));
  row("Base imponible general", euro(r.baseImponibleGeneral));
  row("Base imponible del ahorro", euro(r.baseImponibleAhorro));
  row("Reducciones", euro(r.reducciones));
  row("Base liquidable general", euro(r.baseLiquidableGeneral));
  row("Base liquidable del ahorro", euro(r.baseLiquidableAhorro));
  row("Mínimo personal y familiar (estatal / autonómico)", `${euro(r.minimoEstatal)} / ${euro(r.minimoAutonomico)}`);
  row("Cuota íntegra estatal", euro(r.cuotaIntegraEstatal));
  row("Cuota íntegra autonómica", euro(r.cuotaIntegraAutonomica));
  row("Deducciones aplicadas", euro(r.deducciones));
  row("Cuota resultante", euro(r.cuotaLiquida));
  row("Retenciones e ingresos a cuenta", euro(r.retenciones));
  rule();
  row(etiqueta.charAt(0) + etiqueta.slice(1).toLowerCase(), euro(Math.abs(r.resultado)), true);

  if (entrada.trabajo.length > 0) {
    heading("Rendimientos del trabajo por pagador");
    for (const t of entrada.trabajo) {
      text(`${t.pagador || "Pagador"}${entrada.modalidad === "conjunta_matrimonio" ? (t.titular === 1 ? " (cónyuge)" : " (declarante)") : ""}`, { font: bold });
      text(`Íntegro ${euro(t.integro)} · Retención ${euro(t.retencion)} · Cotizaciones ${euro(t.cotizaciones)}`, { indent: 10 });
      if (t.fuente) text(`Origen: ${t.fuente}`, { size: 8.5, color: MUTED, indent: 10 });
      y -= 3;
    }
  }

  heading("Desglose del cálculo");
  for (const p of r.pasos) {
    ensure(48);
    row(p.concepto, euro(p.importe), true);
    text(p.formula, { size: 8.5, color: MUTED, indent: 10 });
    text(`Norma: ${p.norma}`, { size: 8.5, color: MUTED, indent: 10 });
    if (p.datos) {
      const datosTxt = Object.entries(p.datos)
        .map(([k, v]) => `${k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}: ${typeof v === "number" ? euro(v) : v}`)
        .join(" · ");
      text(`Datos: ${datosTxt}`, { size: 8.5, color: MUTED, indent: 10 });
    }
    y -= 4;
  }

  if (r.avisos.length > 0) {
    heading("Revisa antes de presentar");
    for (const a of r.avisos) text(`${a.nivel === "revisar" ? "[Revisar]" : "[Nota]"} ${a.texto}`, { size: 9.5, gap: 3 });
  }

  heading("Alcance y límites de este informe");
  for (const linea of [
    "El cálculo lo realiza un motor de reglas con las cuantías publicadas en el BOE para el ejercicio indicado; ninguna cifra la decide una IA. Los importes de partida son los que tú has revisado y confirmado.",
    "Incluye: rendimientos del trabajo, intereses, dividendos, ganancias y pérdidas patrimoniales de la base del ahorro, reducción por tributación conjunta y por planes de pensiones individuales, mínimo personal y familiar, donativos y la deducción por rendimientos del trabajo.",
    "No incluye: deducciones autonómicas, maternidad, familia numerosa, vivienda, alquileres, actividades económicas, inmuebles ni rentas del extranjero. Si te corresponde alguna deducción, el resultado real será más favorable.",
    "Para presentar tu declaración utiliza Renta Web de la Agencia Tributaria y contrasta estas cifras con tus datos fiscales.",
    r.provisional ? `El ejercicio ${r.ejercicio} no está cerrado: las reglas pueden cambiar antes de la campaña.` : "",
    `Generado el ${new Date().toLocaleDateString("es-ES")}.`,
  ]) {
    if (linea) text(linea, { size: 9, color: MUTED, gap: 3 });
  }

  pdf.getPages().forEach((p, i, all) => {
    const label = `AuditorX · Informe orientativo, no oficial · Página ${i + 1} de ${all.length}`;
    p.drawText(label, { x: MARGIN, y: 28, size: 8, font: regular, color: MUTED });
  });

  return pdf.save();
}

/** Comprobación mínima de que el PDF se ha generado bien antes de descartar los documentos. */
export function pdfValido(bytes: Uint8Array): boolean {
  return bytes.length > 1500 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}
