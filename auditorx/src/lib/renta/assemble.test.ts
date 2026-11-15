import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type DatosPersonales, type Documento, avisosDocumentos, construirEntrada, duplicados, parseImporte } from "./assemble";
import { calcular } from "./engine";
import type { Extraccion } from "./extract";

const ext = (over: Partial<Extraccion>): Omit<Extraccion, "campos"> => ({
  legible: true, motivo: "", tipo: "nomina", ejercicio: 2025, periodo: "mensual", periodo_texto: "enero 2025",
  emisor: "Ejemplo, S.L.", emisor_nif: "B00000000", titular: "", avisos: [], ...over,
});
const nomina = (id: string, mes: string): Documento => ({
  id, nombre: `nomina-${mes}.pdf`, estado: "ok", titular: 0, ext: ext({ periodo_texto: `${mes} 2025` }),
  campos: [
    { id: `${id}a`, concepto: "retribuciones_integras", importe: 2500, cita: "Total devengado 2.500,00" },
    { id: `${id}b`, concepto: "retenciones_irpf", importe: 400, cita: "IRPF 16 % 400,00" },
    { id: `${id}c`, concepto: "cotizaciones_seguridad_social", importe: 158.75, cita: "Total aportaciones 158,75" },
  ],
});
const datos: DatosPersonales = {
  nombre: "", nif: "", fechaNacimiento: "1990-05-10", discapacidad: "ninguna", modalidad: "individual",
  conyugeFechaNacimiento: "", conyugeDiscapacidad: "ninguna", descendientes: [], ascendientes: [], donativosRecurrentes: false,
};

describe("ensamblado de documentos", () => {
  it("suma las doce nóminas de un mismo pagador en un único rendimiento", () => {
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const docs = meses.map((m, i) => nomina(`d${i}`, m));
    const e = construirEntrada(2025, "madrid", datos, docs);
    assert.equal(e.trabajo.length, 1);
    assert.equal(e.trabajo[0].integro, 30000);
    assert.equal(e.trabajo[0].retencion, 4800);
    assert.equal(e.trabajo[0].cotizaciones, 1905);
    assert.ok(e.trabajo[0].fuente?.includes("Total devengado"));
    assert.deepEqual(avisosDocumentos(docs, 2025), []);
    // Mismo resultado que el caso calculado a mano en engine.test.ts.
    assert.equal(calcular(e).resultado, -189.47);
  });

  it("detecta duplicados, nóminas que faltan y ejercicios distintos", () => {
    const docs = [nomina("a", "enero"), nomina("b", "enero"), { ...nomina("c", "febrero"), ext: ext({ ejercicio: 2024, periodo_texto: "febrero 2024" }) }];
    assert.deepEqual([...duplicados(docs)], ["b"]);
    const avisos = avisosDocumentos(docs, 2025);
    assert.ok(avisos.some((a) => a.includes("repetidos")));
    assert.ok(avisos.some((a) => a.includes("ejercicio 2024")));
    assert.ok(avisos.some((a) => a.includes("3 nóminas")));
  });

  it("avisa si hay certificado anual y nóminas del mismo pagador", () => {
    const cert: Documento = { ...nomina("z", "anual"), ext: ext({ tipo: "certificado_retenciones", periodo: "anual", periodo_texto: "2025" }) };
    assert.ok(avisosDocumentos([cert, nomina("a", "enero")], 2025).some((a) => a.includes("Deja solo el certificado")));
  });

  it("separa pagadores y calcula el saldo de ganancias y pérdidas", () => {
    const sepe: Documento = {
      id: "s", nombre: "sepe.pdf", estado: "ok", titular: 0, ext: ext({ tipo: "certificado_prestacion", periodo: "anual", emisor: "SEPE", emisor_nif: "Q2819009H" }),
      campos: [{ id: "s1", concepto: "prestacion_integra", importe: 6000, cita: "Importe íntegro 6.000,00" }],
    };
    const broker: Documento = {
      id: "k", nombre: "broker.pdf", estado: "ok", titular: 0, ext: ext({ tipo: "informe_inversiones", periodo: "anual", emisor: "Bróker" , emisor_nif: "" }),
      campos: [
        { id: "k1", concepto: "ganancia_patrimonial_neta", importe: 1200, cita: "" },
        { id: "k2", concepto: "perdida_patrimonial_neta", importe: 1500.5, cita: "" },
      ],
    };
    const e = construirEntrada(2025, "cataluna", datos, [nomina("a", "enero"), sepe, broker, { ...sepe, id: "x", estado: "error" }]);
    assert.equal(e.trabajo.length, 2);
    assert.equal(e.trabajo.find((t) => t.pagador === "SEPE")?.clase, "desempleo");
    assert.equal(e.gananciasPatrimoniales, -300.5);
  });

  it("interpreta importes escritos a la española", () => {
    assert.equal(parseImporte("1.234,56"), 1234.56);
    assert.equal(parseImporte("1234.5"), 1234.5);
    assert.equal(parseImporte("2.540"), 2540); // punto de millares, no decimales
    assert.equal(parseImporte("1.234.567"), 1234567);
    assert.equal(parseImporte("40.000,00"), 40000);
    assert.equal(parseImporte("8000"), 8000);
    assert.equal(parseImporte("12,5"), 12.5);
    assert.ok(Number.isNaN(parseImporte("1,2,3")));
    assert.equal(parseImporte(" 30000 € "), 30000);
    assert.ok(Number.isNaN(parseImporte("abc")));
    assert.ok(Number.isNaN(parseImporte("-5")));
    assert.ok(Number.isNaN(parseImporte("")));
  });
});
