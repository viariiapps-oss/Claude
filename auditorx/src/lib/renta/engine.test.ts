import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RentaError, aplicarEscala, calcular, minimoPersonalFamiliar, r2 } from "./engine";
import { AUTONOMICAS, ESTATALES, type Tramo } from "./rules";
import type { Entrada, RendimientoTrabajo } from "./types";

/**
 * Los importes esperados de estas pruebas están calculados a mano a partir de
 * las tablas del BOE (el desarrollo va en el comentario de cada caso), no
 * copiados de la salida del motor.
 */

const salario = (integro: number, cotizaciones: number, retencion: number, extra: Partial<RendimientoTrabajo> = {}): RendimientoTrabajo => ({
  id: "t1", titular: 0, clase: "salario", pagador: "Empresa", integro, cotizaciones, retencion, ...extra,
});

const base = (over: Partial<Entrada>): Entrada => ({
  ejercicio: 2025, ccaa: "madrid", modalidad: "individual",
  declarante: { fechaNacimiento: "1990-05-10", discapacidad: "ninguna" },
  descendientes: [], ascendientes: [], trabajo: [],
  cuotasSindicales: 0, defensaJuridica: 0,
  intereses: 0, dividendos: 0, retencionesCapital: 0,
  gananciasPatrimoniales: 0, retencionesGanancias: 0,
  aportacionesPensiones: [0, 0], donativos: 0, donativosRecurrentes: false,
  ...over,
});

describe("escalas publicadas", () => {
  // La columna «cuota íntegra» del BOE debe coincidir con la cuota acumulada
  // de los tramos anteriores: detecta cualquier error al transcribir una tabla.
  const comprobar = (nombre: string, escala: Tramo[]) => {
    it(`${nombre}: las cuotas acumuladas cuadran con las publicadas`, () => {
      assert.equal(escala[0].desde, 0);
      assert.equal(escala[0].cuota, 0);
      for (let i = 1; i < escala.length; i++) {
        const prev = escala[i - 1];
        const esperado = r2(prev.cuota + ((escala[i].desde - prev.desde) * prev.tipo) / 100);
        assert.ok(Math.abs(esperado - escala[i].cuota) <= 0.02, `${nombre}, tramo ${i}: ${esperado} ≠ ${escala[i].cuota}`);
        assert.ok(escala[i].tipo > prev.tipo, `${nombre}: los tipos deben ser crecientes`);
      }
    });
  };
  for (const ejercicio of [2025, 2026] as const) {
    comprobar(`estatal general ${ejercicio}`, ESTATALES[ejercicio].escalaGeneral);
    comprobar(`ahorro ${ejercicio}`, ESTATALES[ejercicio].escalaAhorro);
    for (const [id, reglas] of Object.entries(AUTONOMICAS[ejercicio])) {
      comprobar(`${id} ${ejercicio}`, reglas.escalaGeneral);
    }
  }

  it("aplica el tipo del tramo que corresponde", () => {
    const e = ESTATALES[2025].escalaGeneral;
    assert.equal(aplicarEscala(e, 0), 0);
    assert.equal(aplicarEscala(e, 12450), 1182.75);
    assert.equal(aplicarEscala(e, 20200), 2112.75);
    assert.equal(aplicarEscala(e, 26095), 2997); // 2.112,75 + 5.895 × 15 %
  });
});

describe("trabajador con una nómina", () => {
  it("Madrid 2025, 30.000 € brutos", () => {
    // Neto previo 30.000 − 1.905 = 28.095; − 2.000 = 26.095 (sin reducción: supera 19.747,5).
    // Estatal: 2.997,00 − 5.550 × 9,5 % (527,25) = 2.469,75.
    // Madrid: 1.739,53 + 7.090,37 × 12,8 % = 2.647,10; − 5.956,65 × 8,5 % (506,32) = 2.140,78.
    const r = calcular(base({ trabajo: [salario(30000, 1905, 4800)] }));
    assert.equal(r.baseLiquidableGeneral, 26095);
    assert.equal(r.cuotaIntegraEstatal, 2469.75);
    assert.equal(r.cuotaIntegraAutonomica, 2140.78);
    assert.equal(r.resultado, -189.47);
    assert.equal(r.signo, "a_devolver");
  });

  it("Andalucía 2025, salario bajo: reducción del art. 20 y deducción de la D.A. 61.ª", () => {
    // Neto previo 16.000 − 1.010 = 14.990. Reducción: 7.302 − 1,75 × 138 = 7.060,50.
    // Neto 12.990 − 7.060,50 = 5.929,50.
    // Estatal: 563,30 − 527,25 = 36,05. Andalucía: 563,30 − 5.790 × 9,5 % (550,05) = 13,25.
    // D.A. 61.ª: 340 € teóricos, con tope en las cuotas íntegras (49,30) → cuota 0.
    const r = calcular(base({ ccaa: "andalucia", trabajo: [salario(16000, 1010, 500)] }));
    assert.equal(r.rendimientoNetoTrabajo, 5929.5);
    assert.equal(r.cuotaIntegraEstatal, 36.05);
    assert.equal(r.cuotaIntegraAutonomica, 13.25);
    assert.equal(r.deducciones, 49.3);
    assert.equal(r.cuotaLiquida, 0);
    assert.equal(r.resultado, -500);
  });

  it("la deducción de la D.A. 61.ª cambia de 2025 a 2026", () => {
    // Salario de 17.000 €: en 2025, 340 − 0,2 × 424 = 255,20; en 2026, 590,89 (≤ 17.094).
    const entrada = { ccaa: "madrid" as const, trabajo: [salario(17000, 1080, 0)] };
    const paso = (ejercicio: 2025 | 2026) =>
      calcular(base({ ...entrada, ejercicio })).pasos.find((p) => p.id === "deduccion.trabajo")?.datos?.deduccionTeorica;
    assert.equal(paso(2025), 255.2);
    assert.equal(paso(2026), 590.89);
  });
});

describe("varios pagadores y desempleo", () => {
  it("suma pagadores y no aplica la D.A. 61.ª a la prestación", () => {
    // Íntegro 12.000 + 6.000 = 18.000; cotizaciones 762 + 0. Neto previo 17.238.
    // Reducción: 7.302 − 1,75 × (17.238 − 14.852) = 7.302 − 4.175,50 = 3.126,50.
    // Neto 15.238 − 3.126,50 = 12.111,50.
    // Estatal: 12.111,50 × 9,5 % = 1.150,59 − 527,25 = 623,34.
    // Cataluña: 1.150,59 − 527,25 = 623,34 (mismo tipo y mismo mínimo).
    const r = calcular(base({
      ccaa: "cataluna",
      trabajo: [salario(12000, 762, 240), salario(6000, 0, 0, { id: "t2", clase: "desempleo", pagador: "SEPE" })],
    }));
    assert.equal(r.rendimientoNetoTrabajo, 12111.5);
    assert.equal(r.cuotaIntegraEstatal, 623.34);
    assert.equal(r.cuotaIntegraAutonomica, 623.34);
    // Salarios 12.000 ≤ 16.576 → 340 €, sin superar el tope ni las otras rentas (6.000 ≤ 6.500).
    assert.equal(r.deducciones, 340);
    assert.equal(r.resultado, r2(623.34 * 2 - 340 - 240));
  });
});

describe("tributación conjunta y familia", () => {
  it("matrimonio con dos hijos en Cataluña 2025", () => {
    // Neto 40.000 − 2.540 − 2.000 = 35.460; − 3.400 = 32.060.
    // Mínimo: 5.550 + 2.400 + 2.700 + 2.800 (menor de 3) = 13.450.
    // Estatal: 3.891,75 − (1.182,75 + 1.000 × 12 %) = 2.589,00.
    // Cataluña: (2.375 + 10.060 × 16 %) − (1.187,50 + 950 × 12,5 %) = 3.984,60 − 1.306,25 = 2.678,35.
    const r = calcular(base({
      ccaa: "cataluna", modalidad: "conjunta_matrimonio",
      conyuge: { fechaNacimiento: "1991-02-02", discapacidad: "ninguna" },
      descendientes: [
        { fechaNacimiento: "2020-06-01", discapacidad: "ninguna", compartido: false },
        { fechaNacimiento: "2024-03-01", discapacidad: "ninguna", compartido: false },
      ],
      trabajo: [salario(40000, 2540, 8000)],
    }));
    assert.equal(r.baseLiquidableGeneral, 32060);
    assert.equal(r.minimoEstatal, 13450);
    assert.equal(r.cuotaIntegraEstatal, 2589);
    assert.equal(r.cuotaIntegraAutonomica, 2678.35);
    assert.equal(r.resultado, -2732.65);
  });

  it("reparte al 50 % el mínimo por hijos en declaración individual", () => {
    const e = base({ descendientes: [{ fechaNacimiento: "2015-01-01", discapacidad: "ninguna", compartido: true }] });
    assert.equal(minimoPersonalFamiliar(e, ESTATALES[2025].minimos), 5550 + 1200);
    assert.equal(minimoPersonalFamiliar(e, AUTONOMICAS[2025].madrid!.minimos!), r2(5956.65 + 2575.85 / 2));
  });

  it("mínimos por edad, ascendientes y discapacidad", () => {
    const e = base({
      declarante: { fechaNacimiento: "1948-01-01", discapacidad: "33" }, // 77 años
      ascendientes: [{ fechaNacimiento: "1930-01-01", discapacidad: "65", contribuyentesConDerecho: 2 }],
    });
    // 5.550 + 1.150 + 1.400 + 3.000 + (1.150 + 1.400 + 9.000 + 3.000) / 2
    assert.equal(minimoPersonalFamiliar(e, ESTATALES[2025].minimos), 11100 + 7275);
  });
  it("no da mínimo por hijos de 25 años o más ni por ascendientes menores de 65, salvo discapacidad", () => {
    const m = ESTATALES[2025].minimos;
    const hijo = (fechaNacimiento: string, discapacidad: "ninguna" | "33" = "ninguna") => ({ fechaNacimiento, discapacidad, compartido: false });
    // Solo cuenta el menor de 25 (2.400 €); el de 30 años no, y no ocupa el puesto de «primero».
    assert.equal(minimoPersonalFamiliar(base({ descendientes: [hijo("1995-01-01"), hijo("2010-01-01")] }), m), 5550 + 2400);
    // Con discapacidad sí, a cualquier edad: 2.400 + 3.000 y el segundo 2.700.
    assert.equal(minimoPersonalFamiliar(base({ descendientes: [hijo("1995-01-01", "33"), hijo("2010-01-01")] }), m), 5550 + 5400 + 2700);
    assert.equal(minimoPersonalFamiliar(base({ ascendientes: [{ fechaNacimiento: "1970-01-01", discapacidad: "ninguna", contribuyentesConDerecho: 1 }] }), m), 5550);
    const r = calcular(base({ trabajo: [salario(30000, 1905, 4800)], descendientes: [hijo("1995-01-01")] }));
    assert.equal(r.minimoEstatal, 5550);
    assert.ok(r.avisos.some((a) => a.texto.includes("no da derecho al mínimo")));
  });
});

describe("inversiones y base del ahorro", () => {
  it("Comunitat Valenciana 2026 con intereses, dividendos y ganancias", () => {
    // General: 50.000 − 3.175 − 2.000 = 44.825. Ahorro: 1.000 + 2.000 + 5.000 = 8.000.
    // Estatal general: 4.362,75 + 9.625 × 18,5 % = 6.143,38 − 527,25 = 5.616,13.
    // Ahorro (estatal y autonómico): 570 + 2.000 × 10,5 % = 780.
    // Valencia 2026: 5.386 + 2.825 × 19,4 % = 5.934,05 − 6.105 × 8,8 % (537,24) = 5.396,81.
    const r = calcular(base({
      ejercicio: 2026, ccaa: "valencia",
      trabajo: [salario(50000, 3175, 12000)],
      intereses: 1000, dividendos: 2000, retencionesCapital: 570, gananciasPatrimoniales: 5000,
    }));
    assert.equal(r.baseLiquidableAhorro, 8000);
    assert.equal(r.cuotaIntegraEstatal, 6396.13);
    assert.equal(r.cuotaIntegraAutonomica, 6176.81);
    assert.equal(r.resultado, 2.94);
    assert.equal(r.signo, "a_pagar");
    assert.equal(r.provisional, true);
  });

  it("la escala valenciana de 2025 es distinta de la de 2026", () => {
    const entrada = { ccaa: "valencia" as const, trabajo: [salario(50000, 3175, 12000)] };
    // 2025: 5.530 + 2.825 × 20 % = 6.095 − 6.105 × 9 % (549,45) = 5.545,55.
    assert.equal(calcular(base({ ...entrada, ejercicio: 2025 })).cuotaIntegraAutonomica, 5545.55);
    assert.equal(calcular(base({ ...entrada, ejercicio: 2026 })).cuotaIntegraAutonomica, 5396.81);
  });

  it("compensa pérdidas con el 25 % de los rendimientos del capital", () => {
    // Capital 4.000, pérdidas −3.000: se compensan 1.000 → base del ahorro 3.000.
    const r = calcular(base({ trabajo: [salario(30000, 1905, 4800)], intereses: 4000, gananciasPatrimoniales: -3000 }));
    assert.equal(r.baseImponibleAhorro, 3000);
    assert.ok(r.avisos.some((a) => a.texto.includes("2000.00 € de pérdidas")));
  });

  it("el mínimo que no cabe en la base general pasa a la del ahorro", () => {
    // Pensión 6.000: neto 4.000, la reducción lo deja en 0. Ahorro 3.000 < mínimo → cuota 0.
    const r = calcular(base({
      ccaa: "andalucia",
      trabajo: [salario(6000, 0, 0, { clase: "pension", pagador: "INSS" })],
      intereses: 3000, retencionesCapital: 570,
    }));
    assert.equal(r.baseLiquidableGeneral, 0);
    assert.equal(r.cuotaLiquida, 0);
    assert.equal(r.resultado, -570);
  });
});

describe("reducciones y deducciones", () => {
  it("plan de pensiones (límite 1.500 €) y donativos en Madrid 2025", () => {
    // Neto 60.000 − 3.800 − 2.000 = 54.200; − 1.500 = 52.700.
    // Estatal: 4.362,75 + 17.500 × 18,5 % = 7.600,25 − 527,25 = 7.073,00.
    // Madrid: 3.841,42 + 17.274,32 × 17,4 % = 6.847,15 − 506,32 = 6.340,83.
    // Donativos 400 €: 250 × 80 % + 150 × 40 % = 260.
    const r = calcular(base({ trabajo: [salario(60000, 3800, 14000)], aportacionesPensiones: [2000, 0], donativos: 400 }));
    assert.equal(r.reducciones, 1500);
    assert.equal(r.baseLiquidableGeneral, 52700);
    assert.equal(r.cuotaIntegraEstatal, 7073);
    assert.equal(r.cuotaIntegraAutonomica, 6340.83);
    assert.equal(r.deducciones, 260);
    assert.equal(r.resultado, -846.17);
  });

  it("donativos recurrentes al 45 % y con el límite del 10 % de la base", () => {
    // Base liquidable 26.095 → base máxima 2.609,50. 200 + 2.359,50 × 45 % = 1.261,78.
    const r = calcular(base({ trabajo: [salario(30000, 1905, 4800)], donativos: 5000, donativosRecurrentes: true }));
    assert.equal(r.deducciones, 1261.78);
  });
});

describe("garantías del motor", () => {
  it("se niega a calcular una comunidad sin reglas verificadas", () => {
    assert.throws(() => calcular(base({ ccaa: "galicia", trabajo: [salario(30000, 1905, 4800)] })), RentaError);
    assert.throws(() => calcular(base({ ccaa: "navarra", trabajo: [salario(30000, 1905, 4800)] })), RentaError);
  });

  it("rechaza importes no válidos y conjuntas sin cónyuge", () => {
    assert.throws(() => calcular(base({ trabajo: [salario(-1, 0, 0)] })), RentaError);
    assert.throws(() => calcular(base({ trabajo: [salario(Number.NaN, 0, 0)] })), RentaError);
    assert.throws(() => calcular(base({ modalidad: "conjunta_matrimonio" })), RentaError);
  });

  it("sin rentas el resultado es cero", () => {
    const r = calcular(base({}));
    assert.equal(r.resultado, 0);
    assert.equal(r.signo, "cero");
  });

  it("más salario nunca reduce la cuota, en todas las comunidades y ejercicios", () => {
    for (const ejercicio of [2025, 2026] as const) {
      for (const ccaa of Object.keys(AUTONOMICAS[ejercicio]) as (keyof (typeof AUTONOMICAS)[2025])[]) {
        let anterior = -1;
        for (let bruto = 0; bruto <= 400000; bruto += 2500) {
          const r = calcular(base({ ejercicio, ccaa, trabajo: [salario(bruto, r2(bruto * 0.0635), 0)] }));
          assert.ok(r.cuotaLiquida >= anterior - 0.01, `${ccaa} ${ejercicio}: la cuota baja al pasar a ${bruto}`);
          assert.ok(r.cuotaLiquida <= bruto, "la cuota no puede superar la renta");
          anterior = r.cuotaLiquida;
        }
      }
    }
  });

  it("cada paso lleva su fórmula y su norma", () => {
    const r = calcular(base({ trabajo: [salario(30000, 1905, 4800)], donativos: 100 }));
    for (const p of r.pasos) {
      assert.ok(p.formula.length > 0 && p.norma.length > 0, `paso ${p.id} sin justificar`);
    }
    assert.ok(r.pasos.some((p) => p.id === "resultado"));
  });
});
