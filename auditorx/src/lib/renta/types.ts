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

/** Inmueble a disposición del titular (segunda residencia, vivienda vacía…). Art. 85. */
export type InmuebleImputado = {
  descripcion: string;
  valorCatastral: number;
  /** Valor catastral revisado en el ejercicio o en los diez anteriores (1,1 % en vez de 2 %). */
  revisado: boolean;
  /** Días del año a disposición del titular (sin alquilar). */
  dias: number;
  /** Porcentaje de titularidad, de 0 a 100. */
  porcentaje: number;
};

/** Vivienda alquilada como arrendador. Arts. 22 y 23. */
export type Alquiler = {
  descripcion: string;
  ingresos: number;
  /** Intereses del préstamo y gastos de reparación y conservación (limitados a los ingresos). */
  interesesYReparacion: number;
  /** IBI, comunidad, seguro, suministros, administración y demás gastos necesarios. */
  otrosGastos: number;
  costeAdquisicion: number;
  valorCatastral: number;
  valorCatastralConstruccion: number;
  diasAlquilado: number;
  porcentaje: number;
  /** Reducción del art. 23.2 que corresponde al contrato: 0, 50, 60, 70 o 90 %. */
  reduccion: 0 | 50 | 60 | 70 | 90;
};

export type FamiliaNumerosa = "no" | "general" | "especial";

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
  inmuebles: InmuebleImputado[];
  alquileres: Alquiler[];
  /** Residentes en Ceuta o Melilla: todo el trabajo se ha realizado allí. */
  trabajoEnCeutaMelilla: boolean;
  /** Madre con derecho a la deducción por maternidad (art. 81.1). */
  maternidad: boolean;
  familiaNumerosa: FamiliaNumerosa;
  /** Hijos por encima del mínimo exigido para la categoría de familia numerosa. */
  hijosExcesoFamiliaNumerosa: number;
  /** Otro contribuyente tiene derecho a la misma deducción (se reparte al 50 %). */
  familiaNumerosaCompartida: boolean;
  /** Cumple el requisito de alta en la Seguridad Social, paro o pensión del art. 81 bis. */
  requisitoDeduccionesFamiliares: boolean;
  /** Importe ya cobrado por adelantado de las deducciones de los arts. 81 y 81 bis. */
  deduccionesAnticipadas: number;
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
  /** Maternidad, familia numerosa y discapacidad a cargo: se restan aunque la cuota sea cero. */
  deduccionesFamiliares: number;
  /** Positivo: a pagar. Negativo: a devolver. */
  resultado: number;
  signo: "a_pagar" | "a_devolver" | "cero";
  pasos: Paso[];
  avisos: Aviso[];
};
