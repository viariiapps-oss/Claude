import { AUTONOMICAS, ESTATALES, type Minimos, PROVISIONAL, type Tramo } from "./rules";
import type { Aviso, Discapacidad, Entrada, Paso, Persona, Resultado } from "./types";

/**
 * Motor de cálculo del IRPF. Funciones puras y deterministas: no interviene
 * ninguna IA. Cada resultado va acompañado de sus pasos (fórmula, norma y
 * datos) para poder justificarlo.
 *
 * Alcance: rendimientos del trabajo, capital mobiliario (intereses y
 * dividendos), ganancias patrimoniales de la base del ahorro, reducción por
 * tributación conjunta y por planes de pensiones individuales, mínimo
 * personal y familiar, donativos y la deducción de la D.A. 61.ª. Lo que queda
 * fuera se descarta antes, en el cuestionario (ver questionnaire.ts).
 */

export class RentaError extends Error {}

export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Cuota que resulta de aplicar una escala a una base. */
export function aplicarEscala(escala: Tramo[], base: number): number {
  if (base <= 0) return 0;
  let tramo = escala[0];
  for (const t of escala) if (base > t.desde) tramo = t;
  return r2(tramo.cuota + ((base - tramo.desde) * tramo.tipo) / 100);
}

/** Edad cumplida a 31 de diciembre del ejercicio (fecha de devengo). */
export function edadADevengo(fechaNacimiento: string, ejercicio: number): number {
  const year = Number(fechaNacimiento.slice(0, 4));
  if (!Number.isInteger(year) || year < 1900 || year > ejercicio) {
    throw new RentaError(`Fecha de nacimiento no válida: ${fechaNacimiento}`);
  }
  return ejercicio - year;
}

function minimoDiscapacidad(d: Discapacidad, m: Minimos): number {
  if (d === "ninguna") return 0;
  if (d === "65") return m.discapacidad65 + m.asistencia;
  return m.discapacidad33 + (d === "33_ayuda" ? m.asistencia : 0);
}

const descendienteConDerecho = (h: Persona, ejercicio: number) =>
  edadADevengo(h.fechaNacimiento, ejercicio) < 25 || h.discapacidad !== "ninguna";
const ascendienteConDerecho = (a: Persona, ejercicio: number) =>
  edadADevengo(a.fechaNacimiento, ejercicio) >= 65 || a.discapacidad !== "ninguna";

/** Mínimo personal y familiar con las cuantías de una administración (estatal o autonómica). */
export function minimoPersonalFamiliar(e: Entrada, m: Minimos): number {
  const conjuntaMatrimonio = e.modalidad === "conjunta_matrimonio";
  const adultos: Persona[] = conjuntaMatrimonio && e.conyuge ? [e.declarante, e.conyuge] : [e.declarante];

  // Art. 84.2.2.º: en conjunta, un solo mínimo general; los incrementos por
  // edad y discapacidad sí atienden a cada cónyuge.
  let total = m.contribuyente;
  for (const a of adultos) {
    const edad = edadADevengo(a.fechaNacimiento, e.ejercicio);
    if (edad >= 65) total += m.mas65;
    if (edad >= 75) total += m.mas75;
    total += minimoDiscapacidad(a.discapacidad, m);
  }

  // Descendientes por orden de nacimiento (el mayor es «el primero»). Art. 58:
  // solo menores de 25 años o con discapacidad.
  const hijos = e.descendientes
    .filter((h) => descendienteConDerecho(h, e.ejercicio))
    .sort((a, b) => a.fechaNacimiento.localeCompare(b.fechaNacimiento));
  hijos.forEach((h, i) => {
    const edad = edadADevengo(h.fechaNacimiento, e.ejercicio);
    let importe = m.descendientes[Math.min(i, 3)];
    if (edad < 3) importe += m.menor3;
    importe += minimoDiscapacidad(h.discapacidad, m);
    total += h.compartido ? importe / 2 : importe;
  });

  // Art. 59: solo mayores de 65 años o con discapacidad.
  for (const a of e.ascendientes.filter((x) => ascendienteConDerecho(x, e.ejercicio))) {
    const edad = edadADevengo(a.fechaNacimiento, e.ejercicio);
    let importe = m.ascendiente + (edad >= 75 ? m.ascendienteMas75 : 0);
    importe += minimoDiscapacidad(a.discapacidad, m);
    total += importe / Math.max(1, a.contribuyentesConDerecho);
  }
  return r2(total);
}

function validar(e: Entrada): void {
  const importes: [string, number][] = [
    ["cuotas sindicales", e.cuotasSindicales], ["defensa jurídica", e.defensaJuridica],
    ["intereses", e.intereses], ["dividendos", e.dividendos],
    ["retenciones de capital", e.retencionesCapital], ["retenciones de ganancias", e.retencionesGanancias],
    ["aportaciones a planes de pensiones", e.aportacionesPensiones[0]],
    ["aportaciones a planes de pensiones del cónyuge", e.aportacionesPensiones[1]],
    ["donativos", e.donativos],
  ];
  for (const t of e.trabajo) {
    importes.push([`rendimiento íntegro de ${t.pagador}`, t.integro], [`retención de ${t.pagador}`, t.retencion], [`cotizaciones de ${t.pagador}`, t.cotizaciones]);
  }
  for (const [nombre, v] of importes) {
    if (!Number.isFinite(v) || v < 0) throw new RentaError(`Importe no válido en ${nombre}.`);
  }
  if (!Number.isFinite(e.gananciasPatrimoniales)) throw new RentaError("Importe no válido en ganancias patrimoniales.");
  if (e.modalidad === "conjunta_matrimonio" && !e.conyuge) {
    throw new RentaError("La tributación conjunta de un matrimonio necesita los datos del cónyuge.");
  }
  if (e.modalidad !== "conjunta_matrimonio" && e.trabajo.some((t) => t.titular === 1)) {
    throw new RentaError("Hay rendimientos del cónyuge en una declaración que no es conjunta.");
  }
}

export function calcular(e: Entrada): Resultado {
  const est = ESTATALES[e.ejercicio];
  const aut = AUTONOMICAS[e.ejercicio]?.[e.ccaa];
  if (!est) throw new RentaError(`No hay reglas para el ejercicio ${e.ejercicio}.`);
  if (!aut) {
    throw new RentaError("Las reglas de esta comunidad autónoma todavía no están verificadas para este ejercicio.");
  }
  validar(e);

  const pasos: Paso[] = [];
  const avisos: Aviso[] = [];
  const paso = (p: Paso) => {
    pasos.push({ ...p, importe: r2(p.importe) });
    return r2(p.importe);
  };
  const conjunta = e.modalidad !== "individual";

  /* 1. Rendimientos del trabajo ─────────────────────────────────────────── */
  const integro = r2(e.trabajo.reduce((s, t) => s + t.integro, 0));
  const cotizaciones = r2(e.trabajo.reduce((s, t) => s + t.cotizaciones, 0));
  const defensa = Math.min(e.defensaJuridica, est.limiteDefensaJuridica);
  paso({
    id: "trabajo.integro", concepto: "Rendimientos íntegros del trabajo", importe: integro,
    formula: "Suma de las retribuciones íntegras de todos los pagadores",
    norma: "Art. 17 Ley 35/2006",
    datos: Object.fromEntries(e.trabajo.map((t) => [t.pagador || t.id, t.integro])),
  });
  const gastosEspecificos = r2(cotizaciones + e.cuotasSindicales + defensa);
  // Art. 20, último párrafo: para la reducción se usa el neto sin «otros gastos».
  const netoPrevio = r2(Math.max(0, integro - gastosEspecificos));

  const activosConDiscapacidad = e.trabajo
    .filter((t) => t.clase === "salario")
    .map((t) => (t.titular === 0 ? e.declarante : e.conyuge)?.discapacidad ?? "ninguna")
    .filter((d) => d !== "ninguna");
  const incremento = activosConDiscapacidad.some((d) => d === "65" || d === "33_ayuda")
    ? est.incrementoDiscapacidadActivo.cualificada
    : activosConDiscapacidad.length > 0
      ? est.incrementoDiscapacidadActivo.general
      : 0;
  const otrosGastos = integro > 0 ? Math.min(est.otrosGastosTrabajo + incremento, netoPrevio) : 0;
  paso({
    id: "trabajo.gastos", concepto: "Gastos deducibles del trabajo", importe: gastosEspecificos + otrosGastos,
    formula: "Cotizaciones + cuotas sindicales + defensa jurídica (máx. 300 €) + otros gastos (2.000 €, más el incremento por discapacidad de trabajadores activos)",
    norma: est.fuentes.gastosTrabajo.norma,
    datos: { cotizaciones, cuotasSindicales: e.cuotasSindicales, defensaJuridica: defensa, otrosGastos },
  });
  const neto = r2(netoPrevio - otrosGastos);

  const otrasRentas = r2(e.intereses + e.dividendos + Math.max(0, e.gananciasPatrimoniales));
  const rt = est.reduccionTrabajo;
  let reduccionTrabajo = 0;
  if (integro > 0 && netoPrevio < rt.tramo3Hasta && otrasRentas <= rt.limiteOtrasRentas) {
    if (netoPrevio <= rt.tramo1Hasta) reduccionTrabajo = rt.tramo1Importe;
    else if (netoPrevio <= rt.tramo2Hasta) reduccionTrabajo = rt.tramo1Importe - rt.tramo2Coef * (netoPrevio - rt.tramo1Hasta);
    else reduccionTrabajo = rt.tramo3Importe - rt.tramo3Coef * (netoPrevio - rt.tramo2Hasta);
    reduccionTrabajo = r2(Math.min(Math.max(0, reduccionTrabajo), neto));
  }
  if (reduccionTrabajo > 0) {
    paso({
      id: "trabajo.reduccion", concepto: "Reducción por obtención de rendimientos del trabajo", importe: reduccionTrabajo,
      formula: "Según el rendimiento neto previo (sin «otros gastos»): 7.302 € hasta 14.852 €; decreciente hasta 19.747,5 €. Solo si las demás rentas no superan 6.500 €",
      norma: est.fuentes.reduccionTrabajo.norma,
      datos: { rendimientoNetoPrevio: netoPrevio, otrasRentas },
    });
  }
  const netoReducido = paso({
    id: "trabajo.neto", concepto: "Rendimiento neto reducido del trabajo", importe: neto - reduccionTrabajo,
    formula: "Íntegro − gastos deducibles − reducción",
    norma: "Arts. 19 y 20 Ley 35/2006",
  });

  /* 2. Base imponible ───────────────────────────────────────────────────── */
  const big = paso({
    id: "base.general", concepto: "Base imponible general", importe: netoReducido,
    formula: "Rendimiento neto reducido del trabajo", norma: "Art. 48 Ley 35/2006",
  });

  const rcm = r2(e.intereses + e.dividendos);
  let gp = r2(e.gananciasPatrimoniales);
  let rcmCompensado = rcm;
  if (gp < 0 && rcm > 0) {
    const compensable = Math.min(-gp, r2((rcm * est.compensacionAhorro) / 100));
    rcmCompensado = r2(rcm - compensable);
    const pendiente = r2(-gp - compensable);
    gp = 0;
    paso({
      id: "ahorro.compensacion", concepto: "Pérdidas patrimoniales compensadas con rendimientos del capital", importe: compensable,
      formula: "Saldo negativo de ganancias y pérdidas, con el límite del 25 % del saldo positivo de rendimientos del capital mobiliario",
      norma: est.fuentes.compensacionAhorro.norma,
      datos: { saldoGananciasYPerdidas: e.gananciasPatrimoniales, rendimientosCapital: rcm },
    });
    if (pendiente > 0) {
      avisos.push({ nivel: "info", texto: `Quedan ${pendiente.toFixed(2)} € de pérdidas patrimoniales sin compensar. Puedes compensarlas en los cuatro ejercicios siguientes.` });
    }
  } else if (gp < 0) {
    avisos.push({ nivel: "info", texto: `Tienes ${(-gp).toFixed(2)} € de pérdidas patrimoniales que no se pueden compensar este año. Puedes compensarlas en los cuatro ejercicios siguientes.` });
    gp = 0;
  }
  const bia = paso({
    id: "base.ahorro", concepto: "Base imponible del ahorro", importe: rcmCompensado + gp,
    formula: "Rendimientos del capital mobiliario + saldo positivo de ganancias y pérdidas patrimoniales",
    norma: est.fuentes.compensacionAhorro.norma,
    datos: { intereses: e.intereses, dividendos: e.dividendos, ganancias: e.gananciasPatrimoniales },
  });

  /* 3. Reducciones y base liquidable ────────────────────────────────────── */
  let general = big;
  let ahorro = bia;
  let reducciones = 0;

  if (conjunta) {
    const importe = e.modalidad === "conjunta_matrimonio" ? est.reduccionConjunta.matrimonio : est.reduccionConjunta.monoparental;
    const enGeneral = Math.min(importe, general);
    const enAhorro = Math.min(importe - enGeneral, ahorro);
    general = r2(general - enGeneral);
    ahorro = r2(ahorro - enAhorro);
    reducciones += enGeneral + enAhorro;
    paso({
      id: "reduccion.conjunta", concepto: "Reducción por tributación conjunta", importe: enGeneral + enAhorro,
      formula: "3.400 € (matrimonio) o 2.150 € (monoparental): primero sobre la base general y el resto sobre la del ahorro",
      norma: est.fuentes.conjunta.norma,
    });
  }

  // Art. 52: el límite se aplica a cada partícipe sobre sus propios rendimientos netos del trabajo.
  const titulares: (0 | 1)[] = e.modalidad === "conjunta_matrimonio" ? [0, 1] : [0];
  let pensiones = 0;
  for (const titular of titulares) {
    const aportado = e.aportacionesPensiones[titular];
    if (aportado <= 0) continue;
    const suyo = e.trabajo.filter((t) => t.titular === titular);
    const parte = integro > 0 ? suyo.reduce((s, t) => s + t.integro, 0) / integro : 0;
    const limite = Math.min(est.pensiones.limite, r2((neto * parte * est.pensiones.porcentaje) / 100));
    pensiones += Math.min(aportado, limite);
    if (aportado > limite) {
      avisos.push({ nivel: "info", texto: `De los ${aportado.toFixed(2)} € aportados a planes de pensiones solo reducen ${limite.toFixed(2)} € (límite legal).` });
    }
  }
  pensiones = r2(Math.min(pensiones, general));
  if (pensiones > 0) {
    general = r2(general - pensiones);
    reducciones += pensiones;
    paso({
      id: "reduccion.pensiones", concepto: "Reducción por aportaciones a planes de pensiones", importe: pensiones,
      formula: "La menor de: lo aportado, 1.500 € y el 30 % de los rendimientos netos del trabajo de cada partícipe",
      norma: est.fuentes.pensiones.norma,
      datos: { aportadoDeclarante: e.aportacionesPensiones[0], aportadoConyuge: e.aportacionesPensiones[1] },
    });
  }

  const blg = paso({ id: "liquidable.general", concepto: "Base liquidable general", importe: general, formula: "Base imponible general − reducciones", norma: "Art. 50 Ley 35/2006" });
  const bla = paso({ id: "liquidable.ahorro", concepto: "Base liquidable del ahorro", importe: ahorro, formula: "Base imponible del ahorro − remanente de reducciones", norma: "Art. 50 Ley 35/2006" });

  /* 4. Mínimo personal y familiar ───────────────────────────────────────── */
  const minimoEstatal = paso({
    id: "minimo.estatal", concepto: "Mínimo personal y familiar (estatal)", importe: minimoPersonalFamiliar(e, est.minimos),
    formula: "Mínimo del contribuyente + descendientes + ascendientes + discapacidad",
    norma: est.fuentes.minimos.norma,
  });
  const minimoAutonomico = paso({
    id: "minimo.autonomico", concepto: `Mínimo personal y familiar (${aut.nombre})`, importe: minimoPersonalFamiliar(e, aut.minimos ?? est.minimos),
    formula: aut.minimos ? "Mismas reglas con las cuantías aprobadas por la comunidad" : "La comunidad no ha modificado las cuantías estatales",
    norma: aut.fuentes.minimos.norma,
  });

  /* 5. Cuotas íntegras ──────────────────────────────────────────────────── */
  // Arts. 56.2, 63, 66, 74 y 76: el mínimo se grava a la misma escala y se
  // resta; lo que no cabe en la base general pasa a la del ahorro.
  const cuota = (escalaGeneral: Tramo[], escalaAhorro: Tramo[], minimo: number) => {
    const minimoGeneral = Math.min(minimo, blg);
    const minimoAhorro = Math.min(r2(minimo - minimoGeneral), bla);
    const g = r2(aplicarEscala(escalaGeneral, blg) - aplicarEscala(escalaGeneral, minimoGeneral));
    const a = r2(aplicarEscala(escalaAhorro, bla) - aplicarEscala(escalaAhorro, minimoAhorro));
    return { general: Math.max(0, g), ahorro: Math.max(0, a) };
  };
  const ce = cuota(est.escalaGeneral, est.escalaAhorro, minimoEstatal);
  const ca = cuota(aut.escalaGeneral, est.escalaAhorroAutonomica, minimoAutonomico);
  const cuotaIntegraEstatal = paso({
    id: "cuota.estatal", concepto: "Cuota íntegra estatal", importe: ce.general + ce.ahorro,
    formula: "Escala(base liquidable) − Escala(mínimo personal y familiar), para la base general y para la del ahorro",
    norma: `${est.fuentes.escalaGeneral.norma}; ${est.fuentes.escalaAhorro.norma}`,
    datos: { cuotaGeneral: ce.general, cuotaAhorro: ce.ahorro },
  });
  const cuotaIntegraAutonomica = paso({
    id: "cuota.autonomica", concepto: `Cuota íntegra autonómica (${aut.nombre})`, importe: ca.general + ca.ahorro,
    formula: "Escala autonómica(base liquidable) − Escala autonómica(mínimo), y escala autonómica del ahorro",
    norma: `${aut.fuentes.escalaGeneral.norma}; art. 76 Ley 35/2006`,
    datos: { cuotaGeneral: ca.general, cuotaAhorro: ca.ahorro },
  });
  const cuotaIntegra = r2(cuotaIntegraEstatal + cuotaIntegraAutonomica);

  /* 6. Deducciones ──────────────────────────────────────────────────────── */
  let deducciones = 0;
  if (e.donativos > 0) {
    const d = est.donativos;
    const base = Math.min(e.donativos, r2(((blg + bla) * d.limiteBase) / 100));
    const tipoResto = e.donativosRecurrentes ? d.tipoRecurrente : d.tipoResto;
    const bruto = r2((Math.min(base, d.tramo) * d.tipoTramo) / 100 + (Math.max(0, base - d.tramo) * tipoResto) / 100);
    const donativos = Math.min(bruto, cuotaIntegra);
    deducciones += donativos;
    paso({
      id: "deduccion.donativos", concepto: "Deducción por donativos", importe: donativos,
      formula: `80 % de los primeros 250 € y ${tipoResto} % del resto; base máxima: 10 % de la base liquidable`,
      norma: est.fuentes.donativos.norma,
      datos: { donado: e.donativos, baseDeduccion: base },
    });
  }
  const cuotaLiquidaPrevia = r2(Math.max(0, cuotaIntegra - deducciones));

  // D.A. 61.ª: solo salarios (prestación efectiva de servicios), no pensiones ni desempleo.
  const dt = est.deduccionTrabajo;
  const salarios = r2(e.trabajo.filter((t) => t.clase === "salario").reduce((s, t) => s + t.integro, 0));
  const rentasDistintas = r2(otrasRentas + (integro - salarios));
  if (salarios > 0 && salarios < dt.limite && rentasDistintas <= dt.limiteOtrasRentas) {
    if (conjunta) {
      avisos.push({ nivel: "revisar", texto: "Podrías tener derecho a la deducción por rendimientos del trabajo (D.A. 61.ª). En tributación conjunta no la calculamos: compruébala en Renta Web." });
    } else {
      const teorica = salarios <= dt.hasta ? dt.importe : dt.importe - dt.coef * (salarios - dt.hasta);
      const baseTotal = blg + bla;
      const proporcion = baseTotal > 0 ? Math.min(1, (netoReducido * (salarios / integro)) / baseTotal) : 0;
      const tope = r2(cuotaIntegra * proporcion);
      const aplicada = r2(Math.min(Math.max(0, teorica), tope, cuotaLiquidaPrevia));
      if (aplicada > 0) {
        deducciones += aplicada;
        paso({
          id: "deduccion.trabajo", concepto: "Deducción por obtención de rendimientos del trabajo", importe: aplicada,
          formula: `${dt.importe} € si los salarios íntegros no superan ${dt.hasta} €; decreciente hasta ${dt.limite} €. Tope: parte de las cuotas íntegras que corresponde a esos rendimientos`,
          norma: est.fuentes.deduccionTrabajo.norma,
          datos: { salariosIntegros: salarios, deduccionTeorica: r2(teorica), tope },
        });
      }
    }
  }
  deducciones = r2(deducciones);
  const cuotaLiquida = paso({
    id: "cuota.liquida", concepto: "Cuota resultante de la autoliquidación", importe: Math.max(0, cuotaIntegra - deducciones),
    formula: "Cuota íntegra estatal + autonómica − deducciones", norma: "Arts. 67, 77 y 79 Ley 35/2006",
  });

  /* 7. Retenciones y resultado ──────────────────────────────────────────── */
  const retenciones = paso({
    id: "retenciones", concepto: "Retenciones e ingresos a cuenta", importe: e.trabajo.reduce((s, t) => s + t.retencion, 0) + e.retencionesCapital + e.retencionesGanancias,
    formula: "Suma de lo retenido por pagadores, bancos y gestoras", norma: "Art. 79 Ley 35/2006",
    datos: { trabajo: r2(e.trabajo.reduce((s, t) => s + t.retencion, 0)), capital: e.retencionesCapital, ganancias: e.retencionesGanancias },
  });
  const resultado = paso({
    id: "resultado", concepto: "Resultado de la declaración", importe: cuotaLiquida - retenciones,
    formula: "Cuota resultante − retenciones. Positivo: a pagar. Negativo: a devolver",
    norma: "Arts. 79 y 103 Ley 35/2006",
  });

  /* Avisos generales ────────────────────────────────────────────────────── */
  avisos.push({ nivel: "revisar", texto: `No se han aplicado deducciones autonómicas de ${aut.nombre}. Si cumples alguna, tu resultado real será más favorable.` });
  const sinDerecho =
    e.descendientes.filter((h) => !descendienteConDerecho(h, e.ejercicio)).length +
    e.ascendientes.filter((a) => !ascendienteConDerecho(a, e.ejercicio)).length;
  if (sinDerecho > 0) {
    avisos.push({ nivel: "revisar", texto: `${sinDerecho} de los familiares indicados no da derecho al mínimo: los hijos deben ser menores de 25 años y los ascendientes mayores de 65, salvo que tengan discapacidad.` });
  }
  if (e.descendientes.some((h) => edadADevengo(h.fechaNacimiento, e.ejercicio) < 3)) {
    avisos.push({ nivel: "revisar", texto: "Tienes hijos menores de 3 años: revisa la deducción por maternidad (hasta 1.200 € por hijo), que aquí no se calcula." });
  }
  if (e.descendientes.filter((h) => descendienteConDerecho(h, e.ejercicio)).length >= 3) {
    avisos.push({ nivel: "revisar", texto: "Con tres o más hijos puedes tener derecho a la deducción por familia numerosa, que aquí no se calcula." });
  }
  const edades = [e.declarante, ...(e.conyuge && e.modalidad === "conjunta_matrimonio" ? [e.conyuge] : [])].map((p) => edadADevengo(p.fechaNacimiento, e.ejercicio));
  if (edades.some((x) => x === 65 || x === 75)) {
    avisos.push({ nivel: "revisar", texto: "Se ha aplicado el incremento del mínimo por edad a quien cumple 65 o 75 años en el ejercicio. Compruébalo en Renta Web." });
  }
  const o = est.obligacion;
  const porPagador = e.trabajo.map((t) => t.integro).sort((a, b) => b - a);
  const resto = r2(porPagador.slice(1).reduce((s, v) => s + v, 0));
  const limite = porPagador.length > 1 && resto > o.umbralSegundoPagador ? o.variosPagadores : o.unPagador;
  if (integro > 0 && integro <= limite && rcm + Math.max(0, e.gananciasPatrimoniales) <= 1600) {
    avisos.push({ nivel: "info", texto: `Por tus rendimientos del trabajo (límite de ${limite.toLocaleString("es-ES")} €) es posible que no estés obligado a declarar. ${resultado < 0 ? "Aun así te conviene presentarla: te sale a devolver." : "Si te sale a pagar, puedes no presentarla."}` });
  }
  if (PROVISIONAL[e.ejercicio]) {
    avisos.push({ nivel: "revisar", texto: `El ejercicio ${e.ejercicio} aún no está cerrado: las reglas pueden cambiar antes de la campaña de Renta.` });
  }

  return {
    ejercicio: e.ejercicio, ccaa: e.ccaa, modalidad: e.modalidad, provisional: PROVISIONAL[e.ejercicio],
    rendimientoNetoTrabajo: netoReducido,
    baseImponibleGeneral: big, baseImponibleAhorro: bia, reducciones: r2(reducciones),
    baseLiquidableGeneral: blg, baseLiquidableAhorro: bla,
    minimoEstatal, minimoAutonomico,
    cuotaIntegraEstatal, cuotaIntegraAutonomica,
    deducciones, cuotaLiquida, retenciones, resultado,
    signo: resultado > 0 ? "a_pagar" : resultado < 0 ? "a_devolver" : "cero",
    pasos, avisos,
  };
}
