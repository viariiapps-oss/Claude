import { CCAA_NOMBRES, ccaaDisponible } from "./rules";
import type { Ccaa, Ejercicio } from "./types";

/**
 * Cuestionario previo. Decide dos cosas antes de pedir un solo documento:
 * si el caso entra en lo que el motor sabe calcular, y qué documentación
 * hace falta exactamente (nada más).
 */

export type PreguntaId =
  | "trabajo" | "varios_pagadores" | "autonomo" | "prestaciones" | "viviendas" | "alquiler"
  | "acciones" | "cripto" | "capital" | "familia" | "donaciones" | "pensiones"
  | "inmuebles" | "extranjero" | "cambio_residencia"
  // Aclaraciones que solo se preguntan si la respuesta anterior es «sí»:
  | "otra_vivienda" | "alquiler_propietario";

export type Pregunta = { id: PreguntaId; texto: string; ayuda?: string; siSolo?: PreguntaId };

export const PREGUNTAS: Pregunta[] = [
  { id: "trabajo", texto: "¿Has trabajado por cuenta ajena durante el ejercicio?" },
  { id: "varios_pagadores", texto: "¿Has tenido más de un empleador o pagador?", siSolo: "trabajo" },
  { id: "autonomo", texto: "¿Has sido autónomo en algún momento del año?" },
  { id: "prestaciones", texto: "¿Has cobrado paro, pensión u otra prestación?" },
  { id: "viviendas", texto: "¿Tienes alguna vivienda en propiedad?" },
  { id: "otra_vivienda", texto: "¿Tienes algún inmueble además de tu vivienda habitual?", ayuda: "Segunda residencia, piso vacío, garaje o local que no forme parte de tu casa.", siSolo: "viviendas" },
  { id: "alquiler", texto: "¿Has alquilado alguna vivienda?" },
  { id: "alquiler_propietario", texto: "¿La alquilas tú como propietario (cobras la renta)?", ayuda: "Responde «no» si eres el inquilino.", siSolo: "alquiler" },
  { id: "acciones", texto: "¿Has vendido acciones o reembolsado fondos de inversión?" },
  { id: "cripto", texto: "¿Has vendido o permutado criptomonedas?" },
  { id: "capital", texto: "¿Has cobrado dividendos o intereses bancarios?" },
  { id: "familia", texto: "¿Tienes hijos o familiares a tu cargo?" },
  { id: "donaciones", texto: "¿Has hecho donativos a ONG, fundaciones o entidades similares?" },
  { id: "pensiones", texto: "¿Has aportado a un plan de pensiones?" },
  { id: "inmuebles", texto: "¿Has comprado o vendido algún inmueble?" },
  { id: "extranjero", texto: "¿Has tenido ingresos procedentes del extranjero?" },
  { id: "cambio_residencia", texto: "¿Has cambiado de comunidad autónoma o de país de residencia durante el año?" },
];

export type Respuestas = Partial<Record<PreguntaId, boolean>>;

export type TipoDocumento =
  | "certificado_retenciones" | "nomina" | "certificado_prestacion" | "certificado_bancario"
  | "informe_inversiones" | "certificado_donativos" | "certificado_plan_pensiones";

export type DocumentoRequerido = { tipo: TipoDocumento; titulo: string; detalle: string; opcional?: boolean };

export type Evaluacion = {
  /** false si hay algún motivo por el que no podemos preparar este caso. */
  cubierto: boolean;
  motivos: string[];
  documentos: DocumentoRequerido[];
  /** Deducciones u otros extremos que el usuario debe revisar por su cuenta. */
  avisos: string[];
};

/** Preguntas que toca mostrar según lo contestado hasta ahora. */
export function preguntasVisibles(r: Respuestas): Pregunta[] {
  return PREGUNTAS.filter((p) => !p.siSolo || r[p.siSolo] === true);
}

export function cuestionarioCompleto(r: Respuestas): boolean {
  return preguntasVisibles(r).every((p) => typeof r[p.id] === "boolean");
}

export function evaluar(r: Respuestas, ejercicio: Ejercicio, ccaa: Ccaa): Evaluacion {
  const motivos: string[] = [];
  const avisos: string[] = [];
  const documentos: DocumentoRequerido[] = [];

  if (ccaa === "pais_vasco" || ccaa === "navarra") {
    motivos.push(`${CCAA_NOMBRES[ccaa]} tiene su propio IRPF foral, que se declara ante su Hacienda Foral y no ante la Agencia Tributaria.`);
  } else if (!ccaaDisponible(ejercicio, ccaa)) {
    motivos.push(`Todavía no hemos verificado la escala y los mínimos de ${CCAA_NOMBRES[ccaa]} para ${ejercicio}.`);
  }
  if (r.autonomo) motivos.push("Los rendimientos de actividades económicas (autónomos) aún no están cubiertos.");
  if (r.otra_vivienda) motivos.push("La imputación de rentas de inmuebles distintos de la vivienda habitual aún no está cubierta.");
  if (r.alquiler_propietario) motivos.push("Los rendimientos por alquilar un inmueble como propietario aún no están cubiertos.");
  if (r.inmuebles) motivos.push("La compra o venta de inmuebles aún no está cubierta.");
  if (r.extranjero) motivos.push("Los ingresos del extranjero y la doble imposición internacional aún no están cubiertos.");
  if (r.cambio_residencia) motivos.push("Los cambios de residencia durante el ejercicio aún no están cubiertos.");

  if (r.trabajo) {
    documentos.push({
      tipo: "certificado_retenciones",
      titulo: r.varios_pagadores ? "Certificado de retenciones de cada empresa" : "Certificado de retenciones de tu empresa",
      detalle: "Lo entrega la empresa a principios de año. Si no lo tienes, sube tus nóminas del ejercicio (todas).",
    });
  }
  if (r.prestaciones) {
    documentos.push({
      tipo: "certificado_prestacion",
      titulo: "Certificado de la prestación o pensión",
      detalle: "Del SEPE (paro) o de la Seguridad Social (pensión), con el importe íntegro y lo retenido.",
    });
  }
  if (r.capital) {
    documentos.push({
      tipo: "certificado_bancario",
      titulo: "Información fiscal de tu banco",
      detalle: "El resumen anual con intereses, dividendos y retenciones.",
    });
  }
  if (r.acciones || r.cripto) {
    documentos.push({
      tipo: "informe_inversiones",
      titulo: r.cripto && !r.acciones ? "Informe fiscal de tu exchange" : "Informe fiscal de tu bróker o gestora",
      detalle: "Debe mostrar la ganancia o pérdida neta del año ya calculada. No calculamos el coste de adquisición operación a operación.",
    });
  }
  if (r.donaciones) {
    documentos.push({ tipo: "certificado_donativos", titulo: "Certificado de donativos", detalle: "El que emite cada entidad con el importe donado en el año." });
  }
  if (r.pensiones) {
    documentos.push({ tipo: "certificado_plan_pensiones", titulo: "Certificado de aportaciones al plan de pensiones", detalle: "Solo aportaciones tuyas a planes individuales. Las de la empresa siguen otras reglas." });
  }

  if (r.prestaciones) {
    avisos.push("Algunas prestaciones están exentas (nacimiento y cuidado de menor, incapacidad permanente absoluta, hijo a cargo…). No las incluyas como ingreso.");
  }
  if (r.alquiler && !r.alquiler_propietario) {
    avisos.push("Como inquilino puedes tener derecho a una deducción autonómica por alquiler (o a la estatal si tu contrato es anterior a 2015). No la calculamos.");
  }
  if (r.viviendas) {
    avisos.push("Si compraste tu vivienda habitual antes de 2013 puedes conservar la deducción por adquisición. No la calculamos.");
  }
  if (r.familia) {
    avisos.push("Revisa las deducciones por maternidad, familia numerosa y personas con discapacidad a cargo. No las calculamos.");
  }
  if (r.pensiones) {
    avisos.push("Si tu empresa aporta a tu plan de pensiones, el límite de reducción es mayor que el que aplicamos.");
  }

  const sinRentas = !r.trabajo && !r.prestaciones && !r.capital && !r.acciones && !r.cripto;
  if (sinRentas && motivos.length === 0) {
    motivos.push("Con tus respuestas no aparece ninguna renta que declarar.");
  }

  return { cubierto: motivos.length === 0, motivos, documentos, avisos };
}
