import assert from "node:assert/strict";
import { it } from "node:test";
import { calcular } from "./engine";
import { generarInforme, pdfValido } from "./pdf";
import type { Entrada } from "./types";

it("genera un PDF válido con el resultado", async () => {
  const entrada: Entrada = {
    ejercicio: 2025, ccaa: "madrid", modalidad: "individual",
    declarante: { fechaNacimiento: "1990-05-10", discapacidad: "ninguna" },
    descendientes: [{ fechaNacimiento: "2024-01-01", discapacidad: "ninguna", compartido: true }], ascendientes: [],
    trabajo: [{ id: "t1", titular: 0, clase: "salario", pagador: "Ejemplo, S.L.", integro: 30000, retencion: 4800, cotizaciones: 1905, fuente: "Certificado de retenciones · «Importe íntegro 30.000,00»" }],
    cuotasSindicales: 0, defensaJuridica: 0, intereses: 120.5, dividendos: 0, retencionesCapital: 22.9,
    gananciasPatrimoniales: -300, retencionesGanancias: 0, aportacionesPensiones: [500, 0], donativos: 100, donativosRecurrentes: false,
  };
  const bytes = await generarInforme({ nombre: "María Núñez Ibáñez", nif: "00000000T" }, entrada, calcular(entrada));
  assert.ok(pdfValido(bytes));
  assert.ok(bytes.length > 3000);
  assert.equal(pdfValido(new Uint8Array([1, 2, 3])), false);
});
