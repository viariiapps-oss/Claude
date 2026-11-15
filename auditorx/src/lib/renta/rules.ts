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
  fuentes: Record<string, Fuente>;
};

export type ReglasAutonomicas = {
  nombre: string;
  escalaGeneral: Tramo[];
  /** null: la comunidad no ha modificado los mínimos y se aplican los estatales. */
  minimos: Minimos | null;
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

/**
 * Solo aparecen las comunidades cuyas tablas se han comprobado en el BOE para
 * ese ejercicio. Para las demás el motor se niega a calcular: es preferible a
 * dar un resultado con cifras sin verificar.
 */
export const AUTONOMICAS: Record<Ejercicio, Partial<Record<Ccaa, ReglasAutonomicas>>> = {
  2025: { andalucia: ANDALUCIA, madrid: MADRID, cataluna: CATALUNA, valencia: VALENCIA_2025 },
  2026: { andalucia: ANDALUCIA, madrid: MADRID, cataluna: CATALUNA, valencia: VALENCIA_2026 },
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
