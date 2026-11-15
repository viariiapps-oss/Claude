import type { Audit } from "./audit-schema";

/** Análisis de ejemplo para probar la interfaz con AUDITORX_MOCK=1. */
export const MOCK_AUDIT: Audit = {
  documento_legible: true,
  motivo_no_legible: "",
  tipo_documento: "Contrato de alquiler de vivienda",
  semaforo: "rojo",
  veredicto:
    "No lo firmes tal cual. Te piden 4 meses de garantía y te cargan los honorarios de la agencia, dos cosas que la ley no permite en un alquiler de vivienda habitual.",
  puntos_criticos: [
    {
      titulo: "Garantías por 4 mensualidades",
      explicacion:
        "Suman 1 mes de fianza más 3 de depósito adicional (3.800 €). El máximo legal es 1 mes de fianza y 2 de garantía adicional.",
      cita: "Cláusula 5ª: «…y un depósito adicional equivalente a tres mensualidades».",
      gravedad: "alta",
    },
    {
      titulo: "Honorarios de agencia a tu cargo",
      explicacion:
        "Te cobran 950 € + IVA por la gestión. Desde 2023 esos gastos los paga siempre el propietario.",
      cita: "Cláusula 12ª: «Los honorarios de intermediación serán satisfechos por el arrendatario».",
      gravedad: "alta",
    },
    {
      titulo: "Todas las reparaciones son tuyas",
      explicacion:
        "El contrato te hace pagar cualquier avería, incluida la caldera. A ti solo te tocan los pequeños arreglos por uso diario.",
      cita: "Cláusula 8ª.",
      gravedad: "media",
    },
  ],
  legal_vs_colado: [
    {
      lo_legal: "Fianza de 1 mes y, como mucho, 2 meses más de garantía adicional.",
      lo_que_intentan_colarte: "1 mes de fianza + 3 meses de depósito: 3.800 € inmovilizados.",
    },
    {
      lo_legal: "Los gastos de gestión inmobiliaria y formalización los paga el arrendador.",
      lo_que_intentan_colarte: "950 € + IVA de honorarios de agencia cargados al inquilino.",
    },
    {
      lo_legal: "El casero hace las reparaciones necesarias para mantener la vivienda habitable.",
      lo_que_intentan_colarte: "«Cualquier reparación, sea cual sea su origen» corre de tu cuenta.",
    },
  ],
  plan_de_accion: [
    "Pide por escrito que la garantía adicional baje a 2 meses como máximo.",
    "Exige que se elimine la cláusula 12ª: los honorarios de agencia no te corresponden.",
    "Solicita que la cláusula 8ª limite tus reparaciones a «pequeños arreglos por el uso ordinario».",
    "Si se niegan, acude a la oficina de consumo de tu comunidad antes de entregar dinero.",
  ],
};
