/** Tipos del módulo de Renta (IRPF). Importes en euros con céntimos. */

export type Ejercicio = 2025 | 2026;

/** Comunidades de régimen común. País Vasco y Navarra tienen IRPF foral propio y quedan fuera. */
export type Ccaa =
  | "andalucia" | "aragon" | "asturias" | "baleares" | "canarias" | "cantabria"
  | "castilla_la_mancha" | "castilla_y_leon" | "cataluna" | "extremadura" | "galicia"
  | "madrid" | "murcia" | "la_rioja" | "valencia" | "ceuta" | "melilla"
  | "pais_vasco" | "navarra";

export type Modalidad = "individual" | "conjunta_matrimonio" | "conjunta_monoparental";

/**
 * ninguna · "33": del 33 % al 64 % · "33_ayuda": del 33 % al 64 % con ayuda de
 * terceras personas o movilidad reducida · "65": igual o superior al 65 %.
 */
export type Discapacidad = "ninguna" | "33" | "33_ayuda" | "65";

export type Persona = { fechaNacimiento: string; discapacidad: Discapacidad };

export type Descendiente = Persona & {
  /** true si el mínimo se reparte con el otro progenitor (declaraciones individuales). */
  compartido: boolean;
};

export type Ascendiente = Persona & {
  /** Nº de contribuyentes con derecho al mínimo por este ascendiente (se prorratea). */
  contribuyentesConDerecho: number;
};

export type ClaseTrabajo = "salario" | "desempleo" | "pension";

export type RendimientoTrabajo = {
  id: string;
  /** 0 = declarante, 1 = cónyuge (solo en tributación conjunta). */
  titular: 0 | 1;
  clase: ClaseTrabajo;
  pagador: string;
  integro: number;
  retencion: number;
  /** Cotizaciones a la Seguridad Social o mutualidades a cargo del trabajador. */
  cotizaciones: number;
  /** Documento del que salen las cifras, para poder verificarlas. */
  fuente?: string;
};

export type Entrada = {
  ejercicio: Ejercicio;
  ccaa: Ccaa;
  modalidad: Modalidad;
  declarante: Persona;
  conyuge?: Persona;
  descendientes: Descendiente[];
  ascendientes: Ascendiente[];
  trabajo: RendimientoTrabajo[];
  cuotasSindicales: number;
  defensaJuridica: number;
  intereses: number;
  dividendos: number;
  retencionesCapital: number;
  /** Saldo neto de ganancias y pérdidas por transmisiones (acciones, fondos, cripto). */
  gananciasPatrimoniales: number;
  retencionesGanancias: number;
  /** Aportaciones individuales a planes de pensiones: [declarante, cónyuge]. */
  aportacionesPensiones: [number, number];
  donativos: number;
  /** Mismo o mayor donativo a la misma entidad en los dos ejercicios anteriores. */
  donativosRecurrentes: boolean;
};

/** Un paso del cálculo, con todo lo necesario para justificarlo. */
export type Paso = {
  id: string;
  concepto: string;
  importe: number;
  formula: string;
  norma: string;
  /** Datos de entrada usados en este paso. */
  datos?: Record<string, number | string>;
};

export type Aviso = { nivel: "info" | "revisar"; texto: string };

export type Resultado = {
  ejercicio: Ejercicio;
  ccaa: Ccaa;
  modalidad: Modalidad;
  /** true si las reglas del ejercicio aún pueden cambiar (año no cerrado). */
  provisional: boolean;
  rendimientoNetoTrabajo: number;
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  reducciones: number;
  baseLiquidableGeneral: number;
  baseLiquidableAhorro: number;
  minimoEstatal: number;
  minimoAutonomico: number;
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  deducciones: number;
  cuotaLiquida: number;
  retenciones: number;
  /** Positivo: a pagar. Negativo: a devolver. */
  resultado: number;
  signo: "a_pagar" | "a_devolver" | "cero";
  pasos: Paso[];
  avisos: Aviso[];
};
