import type { Ccaa, Ejercicio } from "./types";

/**
 * Reglas fiscales por ejercicio. Cada cifra de este archivo está copiada del
 * texto consolidado publicado en boe.es en la fecha indicada en `consultado`.
 * No se reutilizan cifras de un ejercicio en otro: cada ejercicio declara las
 * suyas, aunque coincidan.
 *
 * Para añadir un ejercicio o una comunidad: copiar las tablas tal cual
 * aparecen en la norma (incluida la columna «cuota íntegra»), indicar la
 * fuente y ejecutar `npm test`: las pruebas comprueban que las cuotas
 * acumuladas de cada escala cuadran con las publicadas.
 */

export type Fuente = {
  norma: string;
  url: string;
  /** Desde cuándo surte efectos la redacción usada (fecha), o nota si solo consta que está vigente. */
  vigencia: string;
  /** Fecha en que se comprobó el texto en el BOE. */
  consultado: string;
};

/** Fila de escala tal como se publica: base hasta, cuota íntegra, tipo aplicable al resto. */
export type Tramo = { desde: number; cuota: number; tipo: number };

export type Minimos = {
  contribuyente: number;
  mas65: number;
  mas75: number;
  descendientes: [number, number, number, number];
  menor3: number;
  ascendiente: number;
  ascendienteMas75: number;
  discapacidad33: number;
  discapacidad65: number;
  asistencia: number;
  /** Solo si la comunidad fija para los descendientes una cuantía distinta de la general. */
  discapacidadDescendiente33?: number;
  discapacidadDescendiente65?: number;
};

export type ReglasEstatales = {
  escalaGeneral: Tramo[];
  escalaAhorro: Tramo[];
  /** Art. 76 LIRPF: la escala autonómica del ahorro la fija la ley estatal. */
  escalaAhorroAutonomica: Tramo[];
  minimos: Minimos;
  otrosGastosTrabajo: number;
  incrementoDiscapacidadActivo: { general: number; cualificada: number };
  limiteDefensaJuridica: number;
  reduccionTrabajo: {
    limiteOtrasRentas: number;
    tramo1Hasta: number;
    tramo1Importe: number;
    tramo2Hasta: number;
    tramo2Coef: number;
    tramo3Hasta: number;
    tramo3Importe: number;
    tramo3Coef: number;
  };
  /** D.A. 61.ª LIRPF: deducción por obtención de rendimientos del trabajo. */
  deduccionTrabajo: { importe: number; hasta: number; limite: number; coef: number; limiteOtrasRentas: number };
  reduccionConjunta: { matrimonio: number; monoparental: number };
  pensiones: { limite: number; porcentaje: number };
  donativos: { tramo: number; tipoTramo: number; tipoResto: number; tipoRecurrente: number; limiteBase: number };
  compensacionAhorro: number;
  obligacion: { unPagador: number; variosPagadores: number; umbralSegundoPagador: number };
  /** Art. 85: porcentaje sobre el valor catastral. */
  imputacionInmuebles: { general: number; revisado: number };
  /** Art. 23.1.b: porcentaje máximo de amortización del inmueble alquilado. */
  amortizacionInmueble: number;
  maternidad: number;
  familiaNumerosa: { general: number; especial: number; porHijoExceso: number };
  discapacidadACargo: number;
  /** Art. 68.4: deducción por rentas obtenidas en Ceuta o Melilla. */
  deduccionCeutaMelilla: number;
  fuentes: Record<string, Fuente>;
};

export type ReglasAutonomicas = {
  nombre: string;
  escalaGeneral: Tramo[];
  /** null: la comunidad no ha modificado los mínimos y se aplican los estatales. */
  minimos: Minimos | null;
  /** Advertencia que acompaña siempre al resultado de esta comunidad. */
  nota?: string;
  fuentes: Record<string, Fuente>;
};

const CONSULTADO = "2026-11-15";
const LIRPF = "https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764";

const MINIMOS_ESTATALES: Minimos = {
  contribuyente: 5550, mas65: 1150, mas75: 1400,
  descendientes: [2400, 2700, 4000, 4500], menor3: 2800,
  ascendiente: 1150, ascendienteMas75: 1400,
  discapacidad33: 3000, discapacidad65: 9000, asistencia: 3000,
};

const ESCALA_GENERAL_ESTATAL: Tramo[] = [
  { desde: 0, cuota: 0, tipo: 9.5 },
  { desde: 12450, cuota: 1182.75, tipo: 12 },
  { desde: 20200, cuota: 2112.75, tipo: 15 },
  { desde: 35200, cuota: 4362.75, tipo: 18.5 },
  { desde: 60000, cuota: 8950.75, tipo: 22.5 },
  { desde: 300000, cuota: 62950.75, tipo: 24.5 },
];

// Arts. 66 y 76 LIRPF, redacción con efectos desde el 1-1-2025 (Ley 7/2024).
const ESCALA_AHORRO: Tramo[] = [
  { desde: 0, cuota: 0, tipo: 9.5 },
  { desde: 6000, cuota: 570, tipo: 10.5 },
  { desde: 50000, cuota: 5190, tipo: 11.5 },
  { desde: 200000, cuota: 22440, tipo: 13.5 },
  { desde: 300000, cuota: 35940, tipo: 15 },
];

function fuentesEstatales(deduccionTrabajo: Fuente): Record<string, Fuente> {
  const f = (norma: string, vigencia: string): Fuente => ({ norma, url: LIRPF, vigencia, consultado: CONSULTADO });
  return {
    gastosTrabajo: f("Art. 19.2 Ley 35/2006", "Redacción vigente en la fecha de consulta"),
    reduccionTrabajo: f("Art. 20 Ley 35/2006 (RDL 4/2024)", "2024-01-01"),
    compensacionAhorro: f("Art. 49 Ley 35/2006", "Redacción vigente en la fecha de consulta"),
    pensiones: f("Arts. 51 y 52 Ley 35/2006", "Redacción vigente en la fecha de consulta"),
    minimos: f("Arts. 56 a 61 Ley 35/2006", "2015-01-01"),
    escalaGeneral: f("Art. 63.1 Ley 35/2006 (Ley 11/2020)", "2021-01-01"),
    escalaAhorro: f("Arts. 66.1 y 76 Ley 35/2006 (Ley 7/2024)", "2025-01-01"),
    conjunta: f("Art. 84.2 Ley 35/2006", "Redacción vigente en la fecha de consulta"),
    obligacion: f("Art. 96 Ley 35/2006", "Redacción vigente en la fecha de consulta"),
    imputacion: { norma: "Art. 85 Ley 35/2006 (Ley 26/2014; la redacción nueva no rige hasta 2027)", url: `${LIRPF}&tn=1&p=20141128`, vigencia: "2015-01-01", consultado: CONSULTADO },
    alquiler: { norma: "Arts. 22 y 23.1 Ley 35/2006 y arts. 13 y 14 del Reglamento (RD 439/2007)", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820", vigencia: "Redacción vigente en la fecha de consulta", consultado: CONSULTADO },
    reduccionAlquiler: { norma: "Art. 23.2 Ley 35/2006 y D.T. 38.ª (redacciones vigentes a 31-12-2021 y a 31-12-2025)", url: `${LIRPF}&tn=1&p=20251224`, vigencia: "2024-01-01", consultado: CONSULTADO },
    maternidad: f("Art. 81 Ley 35/2006 (Ley 31/2022)", "2023-01-01"),
    familiares: f("Art. 81 bis Ley 35/2006", "Redacción vigente en la fecha de consulta"),
    ceutaMelilla: f("Art. 68.4 y D.A. 32.ª Ley 35/2006", "2015-01-01"),
    donativos: {
      norma: "Art. 19 Ley 49/2002 (RDL 6/2023) y art. 69.1 Ley 35/2006",
      url: "https://www.boe.es/buscar/act.php?id=BOE-A-2002-25039",
      vigencia: "Redacción vigente en la fecha de consulta",
      consultado: CONSULTADO,
    },
    deduccionTrabajo,
  };
}

function estatales(deduccion: ReglasEstatales["deduccionTrabajo"], fuenteDeduccion: Fuente): ReglasEstatales {
  return {
    escalaGeneral: ESCALA_GENERAL_ESTATAL,
    escalaAhorro: ESCALA_AHORRO,
    escalaAhorroAutonomica: ESCALA_AHORRO,
    minimos: MINIMOS_ESTATALES,
    otrosGastosTrabajo: 2000,
    incrementoDiscapacidadActivo: { general: 3500, cualificada: 7750 },
    limiteDefensaJuridica: 300,
    reduccionTrabajo: {
      limiteOtrasRentas: 6500,
      tramo1Hasta: 14852, tramo1Importe: 7302,
      tramo2Hasta: 17673.52, tramo2Coef: 1.75,
      tramo3Hasta: 19747.5, tramo3Importe: 2364.34, tramo3Coef: 1.14,
    },
    deduccionTrabajo: deduccion,
    reduccionConjunta: { matrimonio: 3400, monoparental: 2150 },
    pensiones: { limite: 1500, porcentaje: 30 },
    donativos: { tramo: 250, tipoTramo: 80, tipoResto: 40, tipoRecurrente: 45, limiteBase: 10 },
    compensacionAhorro: 25,
    obligacion: { unPagador: 22000, variosPagadores: 15876, umbralSegundoPagador: 1500 },
    imputacionInmuebles: { general: 2, revisado: 1.1 },
    amortizacionInmueble: 3,
    maternidad: 1200,
    familiaNumerosa: { general: 1200, especial: 2400, porHijoExceso: 600 },
    discapacidadACargo: 1200,
    deduccionCeutaMelilla: 60,
    fuentes: fuentesEstatales(fuenteDeduccion),
  };
}

export const ESTATALES: Record<Ejercicio, ReglasEstatales> = {
  2025: estatales(
    { importe: 340, hasta: 16576, limite: 18276, coef: 0.2, limiteOtrasRentas: 6500 },
    { norma: "D.A. 61.ª Ley 35/2006 (Ley 5/2025)", url: `${LIRPF}&tn=1&p=20250725`, vigencia: "2025-01-01", consultado: CONSULTADO },
  ),
  2026: estatales(
    { importe: 590.89, hasta: 17094, limite: 20048.45, coef: 0.2, limiteOtrasRentas: 6500 },
    { norma: "D.A. 61.ª Ley 35/2006 (RDL 5/2026)", url: LIRPF, vigencia: "2026-01-01", consultado: CONSULTADO },
  ),
};

/** Ejercicios cuyas reglas aún pueden cambiar antes del cierre del año. */
export const PROVISIONAL: Record<Ejercicio, boolean> = { 2025: false, 2026: true };

/* ── Comunidades autónomas ──────────────────────────────────────────────── */

const fuenteCcaa = (norma: string, id: string, vigencia: string, extra = ""): Fuente => ({
  norma,
  url: `https://www.boe.es/buscar/act.php?id=${id}${extra}`,
  vigencia,
  consultado: CONSULTADO,
});

const ANDALUCIA: ReglasAutonomicas = {
  nombre: "Andalucía",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9.5 },
    { desde: 13000, cuota: 1235, tipo: 12 },
    { desde: 21100, cuota: 2207, tipo: 15 },
    { desde: 35200, cuota: 4322, tipo: 18.5 },
    { desde: 60000, cuota: 8910, tipo: 22.5 },
  ],
  minimos: {
    contribuyente: 5790, mas65: 1200, mas75: 1460,
    descendientes: [2510, 2820, 4170, 4700], menor3: 2920,
    ascendiente: 1200, ascendienteMas75: 1460,
    discapacidad33: 3130, discapacidad65: 9390, asistencia: 3130,
  },
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 23 Ley 5/2021 de Andalucía (DL 7/2022)", "BOE-A-2021-17915", "2022-01-01"),
    minimos: fuenteCcaa("Art. 23 bis Ley 5/2021 de Andalucía (DL 7/2022)", "BOE-A-2021-17915", "2022-01-01"),
  },
};

const MADRID: ReglasAutonomicas = {
  nombre: "Comunidad de Madrid",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 8.5 },
    { desde: 13362.22, cuota: 1135.79, tipo: 10.7 },
    { desde: 19004.63, cuota: 1739.53, tipo: 12.8 },
    { desde: 35425.68, cuota: 3841.42, tipo: 17.4 },
    { desde: 57320.4, cuota: 7651.1, tipo: 20.5 },
  ],
  minimos: {
    contribuyente: 5956.65, mas65: 1234.26, mas75: 1502.58,
    descendientes: [2575.85, 2897.83, 4400, 4950], menor3: 3005.16,
    ascendiente: 1234.26, ascendienteMas75: 1502.58,
    discapacidad33: 3219.81, discapacidad65: 9659.44, asistencia: 3219.81,
  },
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 1 DLeg. 1/2010 de Madrid (Ley 13/2023)", "BOCM-m-2010-90068", "2023-01-01"),
    minimos: fuenteCcaa("Arts. 2 a 2 quater DLeg. 1/2010 de Madrid (Ley 13/2023)", "BOCM-m-2010-90068", "2023-01-01"),
  },
};

const CATALUNA: ReglasAutonomicas = {
  nombre: "Cataluña",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9.5 },
    { desde: 12500, cuota: 1187.5, tipo: 12.5 },
    { desde: 22000, cuota: 2375, tipo: 16 },
    { desde: 33000, cuota: 4135, tipo: 19 },
    { desde: 53000, cuota: 7935, tipo: 21.5 },
    { desde: 90000, cuota: 15890, tipo: 23.5 },
    { desde: 120000, cuota: 22940, tipo: 24.5 },
    { desde: 175000, cuota: 36415, tipo: 25.5 },
  ],
  // Art. 611-2: mínimo del contribuyente de 5.550 € con carácter general, igual al estatal.
  minimos: null,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 611-1 Código tributario de Catalunya, libro sexto (DL 5/2025)", "BOE-A-2024-6951", "2025-01-01"),
    minimos: fuenteCcaa("Art. 611-2 Código tributario de Catalunya, libro sexto", "BOE-A-2024-6951", "Redacción vigente en la fecha de consulta"),
  },
};

const MINIMOS_VALENCIA: Minimos = {
  contribuyente: 6105, mas65: 1265, mas75: 1540,
  descendientes: [2640, 2970, 4400, 4950], menor3: 3080,
  ascendiente: 1265, ascendienteMas75: 1540,
  discapacidad33: 3300, discapacidad65: 9900, asistencia: 3300,
};

const VALENCIA_2025: ReglasAutonomicas = {
  nombre: "Comunitat Valenciana",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9 },
    { desde: 12000, cuota: 1080, tipo: 12 },
    { desde: 22000, cuota: 2280, tipo: 15 },
    { desde: 32000, cuota: 3780, tipo: 17.5 },
    { desde: 42000, cuota: 5530, tipo: 20 },
    { desde: 52000, cuota: 7530, tipo: 22.5 },
    { desde: 62000, cuota: 9780, tipo: 25 },
    { desde: 72000, cuota: 12280, tipo: 26.5 },
    { desde: 100000, cuota: 19700, tipo: 27.5 },
    { desde: 150000, cuota: 33450, tipo: 28.5 },
    { desde: 200000, cuota: 47700, tipo: 29.5 },
  ],
  minimos: MINIMOS_VALENCIA,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 2 Ley 13/1997 de la Comunitat Valenciana (redacción vigente a 29-12-2025)", "BOE-A-1998-8202", "2023-01-01", "&tn=1&p=20251229"),
    minimos: fuenteCcaa("Art. 2 bis Ley 13/1997 de la Comunitat Valenciana", "BOE-A-1998-8202", "Redacción vigente a 29-12-2025", "&tn=1&p=20251229"),
  },
};

const VALENCIA_2026: ReglasAutonomicas = {
  nombre: "Comunitat Valenciana",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 8.8 },
    { desde: 12000, cuota: 1056, tipo: 11.7 },
    { desde: 22000, cuota: 2226, tipo: 14.6 },
    { desde: 32000, cuota: 3686, tipo: 17 },
    { desde: 42000, cuota: 5386, tipo: 19.4 },
    { desde: 52000, cuota: 7326, tipo: 21.9 },
    { desde: 62000, cuota: 9516, tipo: 24.4 },
    { desde: 72000, cuota: 11956, tipo: 26.1 },
    { desde: 100000, cuota: 19264, tipo: 27.35 },
    { desde: 150000, cuota: 32939, tipo: 28.35 },
    { desde: 200000, cuota: 47114, tipo: 29.35 },
  ],
  minimos: MINIMOS_VALENCIA,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 2 Ley 13/1997 de la Comunitat Valenciana (Ley 5/2026)", "BOE-A-1998-8202", "2026-01-01"),
    minimos: fuenteCcaa("Art. 2 bis Ley 13/1997 de la Comunitat Valenciana", "BOE-A-1998-8202", "Redacción vigente en la fecha de consulta"),
  },
};

const V = "Redacción vigente en la fecha de consulta";

const GALICIA: ReglasAutonomicas = {
  nombre: "Galicia",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9 },
    { desde: 12985.35, cuota: 1168.68, tipo: 11.65 },
    { desde: 21068.6, cuota: 2110.38, tipo: 14.9 },
    { desde: 35200, cuota: 4215.96, tipo: 18.4 },
    { desde: 60000, cuota: 8779.16, tipo: 22.5 },
  ],
  minimos: {
    contribuyente: 5789, mas65: 1199, mas75: 1460,
    descendientes: [2503, 2816, 4172, 4694], menor3: 2920,
    ascendiente: 1199, ascendienteMas75: 1460,
    discapacidad33: 3129, discapacidad65: 9387, asistencia: 3129,
  },
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 4 DLeg. 1/2011 de Galicia (Ley 7/2022)", "BOE-A-2011-18161", "2022-01-01"),
    minimos: fuenteCcaa("Art. 4 bis DLeg. 1/2011 de Galicia (Ley 7/2022)", "BOE-A-2011-18161", "2022-01-01"),
  },
};

const CASTILLA_Y_LEON: ReglasAutonomicas = {
  nombre: "Castilla y León",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9 },
    { desde: 12450, cuota: 1120.5, tipo: 12 },
    { desde: 20200, cuota: 2050.5, tipo: 14 },
    { desde: 35200, cuota: 4150.5, tipo: 18.5 },
    { desde: 53407.2, cuota: 7518.83, tipo: 21.5 },
  ],
  // El art. 1 bis fija cuantías propias, que coinciden con las estatales.
  minimos: MINIMOS_ESTATALES,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 1 DLeg. 1/2013 de Castilla y León (Ley 2/2022)", "BOCL-h-2013-90254", "2022-01-01"),
    minimos: fuenteCcaa("Art. 1 bis DLeg. 1/2013 de Castilla y León (Ley 10/2014)", "BOCL-h-2013-90254", "2015-01-01"),
  },
};

const ARAGON: ReglasAutonomicas = {
  nombre: "Aragón",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9.5 },
    { desde: 13072.5, cuota: 1241.89, tipo: 12 },
    { desde: 21210, cuota: 2218.39, tipo: 15 },
    { desde: 36960, cuota: 4580.89, tipo: 18.5 },
    { desde: 52500, cuota: 7455.79, tipo: 20.5 },
    { desde: 60000, cuota: 8993.29, tipo: 23 },
    { desde: 80000, cuota: 13593.29, tipo: 24 },
    { desde: 90000, cuota: 15993.29, tipo: 25 },
    { desde: 130000, cuota: 25993.29, tipo: 25.5 },
  ],
  minimos: null,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 110-1 DLeg. 1/2005 de Aragón (Ley 17/2023)", "BOA-d-2005-90006", "2023-01-01"),
    minimos: fuenteCcaa("Aragón no ha modificado los mínimos (arts. 56 a 61 Ley 35/2006)", "BOA-d-2005-90006", V),
  },
};

const MURCIA: ReglasAutonomicas = {
  nombre: "Región de Murcia",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9.5 },
    { desde: 12450, cuota: 1182.75, tipo: 11.2 },
    { desde: 20200, cuota: 2050.75, tipo: 13.3 },
    { desde: 34000, cuota: 3886.15, tipo: 17.9 },
    { desde: 60000, cuota: 8540.15, tipo: 22.5 },
  ],
  minimos: null,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 2 DLeg. 1/2010 de la Región de Murcia (Ley 14/2018), aplicable desde 2023", "BOE-A-2011-10542", "2023-01-01"),
    minimos: fuenteCcaa("La Región de Murcia no ha modificado los mínimos (arts. 56 a 61 Ley 35/2006)", "BOE-A-2011-10542", V),
  },
};

const CASTILLA_LA_MANCHA: ReglasAutonomicas = {
  nombre: "Castilla-La Mancha",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9.5 },
    { desde: 12450, cuota: 1182.75, tipo: 12 },
    { desde: 20200, cuota: 2112.75, tipo: 15 },
    { desde: 35200, cuota: 4362.75, tipo: 18.5 },
    { desde: 60000, cuota: 8950.75, tipo: 22.5 },
  ],
  minimos: null,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 13 bis Ley 8/2013 de Castilla-La Mancha (Ley 9/2014)", "BOE-A-2014-1368", "2015-01-01"),
    minimos: fuenteCcaa("Castilla-La Mancha no ha modificado los mínimos (arts. 56 a 61 Ley 35/2006)", "BOE-A-2014-1368", V),
  },
};

const BALEARES: ReglasAutonomicas = {
  nombre: "Illes Balears",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9 },
    { desde: 10000, cuota: 900, tipo: 11.25 },
    { desde: 18000, cuota: 1800, tipo: 14.25 },
    { desde: 30000, cuota: 3510, tipo: 17.5 },
    { desde: 48000, cuota: 6660, tipo: 19 },
    { desde: 70000, cuota: 10840, tipo: 21.75 },
    { desde: 90000, cuota: 15190, tipo: 22.75 },
    { desde: 120000, cuota: 22015, tipo: 23.75 },
    { desde: 175000, cuota: 35077.5, tipo: 24.75 },
  ],
  // El art. 2 no da cifras: incrementa un 10 % los mínimos por edad del
  // contribuyente, por el 2.º, 3.º y 4.º descendiente, por ascendientes y por
  // discapacidad. Estas cuantías son las estatales con ese 10 % aplicado.
  minimos: {
    contribuyente: 5550, mas65: 1265, mas75: 1540,
    descendientes: [2400, 2970, 4400, 4950], menor3: 2800,
    ascendiente: 1265, ascendienteMas75: 1540,
    discapacidad33: 3300, discapacidad65: 9900, asistencia: 3300,
  },
  nota: "En Illes Balears la ley no publica las cuantías de los mínimos, sino un incremento del 10 % sobre las estatales. Si tienes más de 65 años, varios hijos, ascendientes a cargo o discapacidad, comprueba esos mínimos en Renta Web.",
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 1 DLeg. 1/2014 de las Illes Balears (Ley 12/2023)", "BOE-A-2014-6925", "2024-01-01"),
    minimos: fuenteCcaa("Art. 2 DLeg. 1/2014 de las Illes Balears (Ley 11/2023): incremento del 10 %", "BOE-A-2014-6925", V),
  },
};

const CANARIAS: ReglasAutonomicas = {
  nombre: "Canarias",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9 },
    { desde: 13748, cuota: 1237.32, tipo: 11.5 },
    { desde: 19422, cuota: 1889.83, tipo: 14 },
    { desde: 35924, cuota: 4200.11, tipo: 18.5 },
    { desde: 57566, cuota: 8203.88, tipo: 23.5 },
    { desde: 93268, cuota: 16593.85, tipo: 25 },
    { desde: 123745, cuota: 24213.1, tipo: 26 },
  ],
  minimos: {
    contribuyente: 5606, mas65: 1162, mas75: 1414,
    descendientes: [2424, 2727, 4040, 4545], menor3: 2828,
    ascendiente: 1162, ascendienteMas75: 1414,
    discapacidad33: 3030, discapacidad65: 9090, asistencia: 3030,
  },
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 18 bis DLeg. 1/2009 de Canarias (Ley 9/2025)", "BOC-j-2009-90008", "2025-01-01"),
    minimos: fuenteCcaa("Art. 18 quater DLeg. 1/2009 de Canarias (Ley 5/2024)", "BOC-j-2009-90008", "2024-01-01"),
  },
};

const CANTABRIA: ReglasAutonomicas = {
  nombre: "Cantabria",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 8.5 },
    { desde: 13000, cuota: 1105, tipo: 11 },
    { desde: 21000, cuota: 1985, tipo: 14.5 },
    { desde: 35200, cuota: 4044, tipo: 18 },
    { desde: 60000, cuota: 8508, tipo: 22.5 },
    { desde: 90000, cuota: 15258, tipo: 24.5 },
  ],
  minimos: null,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 1 DLeg. 62/2008 de Cantabria (Ley 3/2023)", "BOCT-c-2008-90028", "2024-01-01"),
    minimos: fuenteCcaa("Cantabria no ha modificado los mínimos (arts. 56 a 61 Ley 35/2006)", "BOCT-c-2008-90028", V),
  },
};

const EXTREMADURA_2025: ReglasAutonomicas = {
  nombre: "Extremadura",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 8 },
    { desde: 12450, cuota: 996, tipo: 10 },
    { desde: 20200, cuota: 1771, tipo: 16 },
    { desde: 24200, cuota: 2411, tipo: 17.5 },
    { desde: 35200, cuota: 4336, tipo: 21 },
    { desde: 60000, cuota: 9544, tipo: 23.5 },
    { desde: 80200, cuota: 14291, tipo: 24 },
    { desde: 99200, cuota: 18851, tipo: 24.5 },
    { desde: 120200, cuota: 23996, tipo: 25 },
  ],
  minimos: null,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 1 DLeg. 1/2018 de Extremadura (DL 4/2023)", "BOE-A-2018-8159", "2023-01-01", "&tn=1&p=20230915"),
    minimos: fuenteCcaa("Extremadura no ha modificado los mínimos (arts. 56 a 61 Ley 35/2006)", "BOE-A-2018-8159", V),
  },
};

const EXTREMADURA_2026: ReglasAutonomicas = {
  ...EXTREMADURA_2025,
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 7.75 },
    { desde: 12450, cuota: 964.88, tipo: 9.75 },
    { desde: 20200, cuota: 1720.5, tipo: 16 },
    { desde: 24200, cuota: 2360.5, tipo: 17.5 },
    { desde: 35200, cuota: 4285.5, tipo: 21 },
    { desde: 60000, cuota: 9493.5, tipo: 23.5 },
    { desde: 80200, cuota: 14240.5, tipo: 24 },
    { desde: 99200, cuota: 18800.5, tipo: 24.5 },
    { desde: 120200, cuota: 23945.5, tipo: 25 },
  ],
  fuentes: {
    ...EXTREMADURA_2025.fuentes,
    escalaGeneral: fuenteCcaa("Art. 1 DLeg. 1/2018 de Extremadura (Ley 2/2026)", "BOE-A-2018-8159", "2026-01-01"),
  },
};

const LA_RIOJA: ReglasAutonomicas = {
  nombre: "La Rioja",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 8 },
    { desde: 12450, cuota: 996, tipo: 10.6 },
    { desde: 20200, cuota: 1817.5, tipo: 13.6 },
    { desde: 35200, cuota: 3857.5, tipo: 17.8 },
    { desde: 40000, cuota: 4711.9, tipo: 18.3 },
    { desde: 50000, cuota: 6541.9, tipo: 19 },
    { desde: 60000, cuota: 8441.9, tipo: 24.5 },
    { desde: 120000, cuota: 23141.9, tipo: 27 },
  ],
  // Art. 31 bis: solo cambia el mínimo por discapacidad de descendientes
  // (3.300 € y 9.900 €); los gastos de asistencia no se modifican.
  minimos: { ...MINIMOS_ESTATALES, discapacidadDescendiente33: 3300, discapacidadDescendiente65: 9900 },
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 31 Ley 10/2017 de La Rioja (Ley 13/2023)", "BOE-A-2017-13750", "2024-01-01"),
    minimos: fuenteCcaa("Art. 31 bis Ley 10/2017 de La Rioja (Ley 2/2018)", "BOE-A-2017-13750", "2018-01-01"),
  },
};

// Ley 3/2025 del Principado de Asturias, en vigor desde el 3-12-2025: se
// aplica a los períodos impositivos iniciados desde entonces (2026).
const ASTURIAS_2026: ReglasAutonomicas = {
  nombre: "Principado de Asturias",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 9 },
    { desde: 12450, cuota: 1120.5, tipo: 12 },
    { desde: 17707.2, cuota: 1751.36, tipo: 14 },
    { desde: 33007.2, cuota: 3893.36, tipo: 19.2 },
    { desde: 53407.2, cuota: 7810.16, tipo: 21.5 },
    { desde: 70000, cuota: 11377.62, tipo: 22.5 },
    { desde: 90000, cuota: 15877.62, tipo: 25 },
    { desde: 175000, cuota: 37127.62, tipo: 26 },
  ],
  minimos: {
    contribuyente: 6105, mas65: 1265, mas75: 1540,
    descendientes: [2640, 2970, 4400, 4950], menor3: 3080,
    ascendiente: 1265, ascendienteMas75: 1540,
    discapacidad33: 3300, discapacidad65: 9900, asistencia: 3300,
  },
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 2 DLeg. 2/2014 del Principado de Asturias (Ley 3/2025)", "BOE-A-2015-945", "2025-12-03"),
    minimos: fuenteCcaa("Arts. 2 bis a 2 quinquies DLeg. 2/2014 del Principado de Asturias (Ley 3/2025)", "BOE-A-2015-945", "2025-12-03"),
  },
};

// Redacción anterior a la Ley 3/2025. Esa ley entró en vigor el 3-12-2025 y,
// conforme al art. 10.2 de la Ley General Tributaria, se aplica a los períodos
// impositivos iniciados desde entonces: 2026 en adelante.
const ASTURIAS_2025: ReglasAutonomicas = {
  nombre: "Principado de Asturias",
  escalaGeneral: [
    { desde: 0, cuota: 0, tipo: 10 },
    { desde: 12450, cuota: 1245, tipo: 12 },
    { desde: 17707.2, cuota: 1875.86, tipo: 14 },
    { desde: 33007.2, cuota: 4017.86, tipo: 18.5 },
    { desde: 53407.2, cuota: 7791.86, tipo: 21.5 },
    { desde: 70000, cuota: 11359.32, tipo: 22.5 },
    { desde: 90000, cuota: 15859.32, tipo: 25 },
    { desde: 175000, cuota: 37109.32, tipo: 25.5 },
  ],
  minimos: null,
  fuentes: {
    escalaGeneral: fuenteCcaa("Art. 2 DLeg. 2/2014 del Principado de Asturias (Ley 11/2014) y art. 10.2 Ley 58/2003", "BOE-A-2015-945", "2015-01-01", "&tn=1&p=20141231"),
    minimos: fuenteCcaa("Asturias no tenía mínimos propios antes de la Ley 3/2025 (arts. 56 a 61 Ley 35/2006)", "BOE-A-2015-945", "2015-01-01", "&tn=1&p=20141231"),
  },
};

// D.A. 32.ª: los residentes en Ceuta o Melilla aplican como escala autonómica la del art. 65.
const escalaArt65: Tramo[] = [
  { desde: 0, cuota: 0, tipo: 9.5 },
  { desde: 12450, cuota: 1182.75, tipo: 12 },
  { desde: 20200, cuota: 2112.75, tipo: 15 },
  { desde: 35200, cuota: 4362.75, tipo: 18.5 },
  { desde: 60000, cuota: 8950.75, tipo: 22.5 },
];
const ciudadAutonoma = (nombre: string): ReglasAutonomicas => ({
  nombre,
  escalaGeneral: escalaArt65,
  minimos: null,
  fuentes: {
    escalaGeneral: { norma: "D.A. 32.ª y art. 65 Ley 35/2006", url: LIRPF, vigencia: "2015-01-01", consultado: CONSULTADO },
    minimos: { norma: "Arts. 56 a 61 Ley 35/2006", url: LIRPF, vigencia: "2015-01-01", consultado: CONSULTADO },
  },
});

const COMUNES = {
  ceuta: ciudadAutonoma("Ceuta"), melilla: ciudadAutonoma("Melilla"),
  andalucia: ANDALUCIA, aragon: ARAGON, baleares: BALEARES, canarias: CANARIAS, cantabria: CANTABRIA,
  castilla_la_mancha: CASTILLA_LA_MANCHA, castilla_y_leon: CASTILLA_Y_LEON, cataluna: CATALUNA,
  galicia: GALICIA, madrid: MADRID, murcia: MURCIA, la_rioja: LA_RIOJA,
};

/**
 * Solo aparecen las comunidades cuyas tablas se han comprobado en el BOE para
 * ese ejercicio. Para las demás el motor se niega a calcular: es preferible a
 * dar un resultado con cifras sin verificar. País Vasco y Navarra quedan
 * fuera por tener IRPF foral.
 */
export const AUTONOMICAS: Record<Ejercicio, Partial<Record<Ccaa, ReglasAutonomicas>>> = {
  2025: { ...COMUNES, asturias: ASTURIAS_2025, extremadura: EXTREMADURA_2025, valencia: VALENCIA_2025 },
  2026: { ...COMUNES, asturias: ASTURIAS_2026, extremadura: EXTREMADURA_2026, valencia: VALENCIA_2026 },
};

export const CCAA_NOMBRES: Record<Ccaa, string> = {
  andalucia: "Andalucía", aragon: "Aragón", asturias: "Asturias", baleares: "Illes Balears",
  canarias: "Canarias", cantabria: "Cantabria", castilla_la_mancha: "Castilla-La Mancha",
  castilla_y_leon: "Castilla y León", cataluna: "Cataluña", extremadura: "Extremadura",
  galicia: "Galicia", madrid: "Comunidad de Madrid", murcia: "Región de Murcia",
  la_rioja: "La Rioja", valencia: "Comunitat Valenciana", ceuta: "Ceuta", melilla: "Melilla",
  pais_vasco: "País Vasco", navarra: "Navarra",
};

export const EJERCICIOS: Ejercicio[] = [2025, 2026];

export function ccaaDisponible(ejercicio: Ejercicio, ccaa: Ccaa): boolean {
  return Boolean(AUTONOMICAS[ejercicio][ccaa]);
}
