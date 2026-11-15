import { z } from "zod";
import type { ProviderId } from "./auth";
import type { PlanId } from "./plans";

/**
 * Qué tipo de revisión es. "contrato": buscar trampas en algo que te dan a
 * firmar o pagar. "revision": mejorar un documento que escribes tú (un CV).
 */
export type Mode = "contrato" | "revision";

export const GROUPS = ["Vivienda", "Facturas", "Trabajo", "Dinero", "Coche", "Otros"] as const;
export type Group = (typeof GROUPS)[number];

export const CATEGORY_LIST = [
  { id: "alquiler", label: "Alquiler", group: "Vivienda", mode: "contrato" },
  { id: "compraventa", label: "Compra o arras", group: "Vivienda", mode: "contrato" },
  { id: "hipoteca", label: "Hipoteca", group: "Vivienda", mode: "contrato" },
  { id: "reforma", label: "Obra o reforma", group: "Vivienda", mode: "contrato" },
  { id: "suministros", label: "Luz, gas y agua", group: "Facturas", mode: "contrato" },
  { id: "telefonia", label: "Internet y móvil", group: "Facturas", mode: "contrato" },
  { id: "suscripcion", label: "Gimnasio y suscripciones", group: "Facturas", mode: "contrato" },
  { id: "curriculum", label: "Currículum", group: "Trabajo", mode: "revision" },
  { id: "carta", label: "Carta de presentación", group: "Trabajo", mode: "revision" },
  { id: "contrato_trabajo", label: "Contrato de trabajo", group: "Trabajo", mode: "contrato" },
  { id: "nomina", label: "Nómina", group: "Trabajo", mode: "contrato" },
  { id: "finiquito", label: "Finiquito o despido", group: "Trabajo", mode: "contrato" },
  { id: "banco", label: "Banco y préstamos", group: "Dinero", mode: "contrato" },
  { id: "seguro", label: "Seguro", group: "Dinero", mode: "contrato" },
  { id: "multa", label: "Multa o sanción", group: "Dinero", mode: "contrato" },
  { id: "taller", label: "Taller", group: "Coche", mode: "contrato" },
  { id: "coche", label: "Compra o renting", group: "Coche", mode: "contrato" },
  { id: "otro", label: "Otro documento", group: "Otros", mode: "contrato" },
] as const satisfies readonly { id: string; label: string; group: Group; mode: Mode }[];

export type Category = (typeof CATEGORY_LIST)[number]["id"];
export const CATEGORIES: readonly Category[] = CATEGORY_LIST.map((c) => c.id);

export function modeOf(category: Category): Mode {
  return CATEGORY_LIST.find((c) => c.id === category)?.mode ?? "contrato";
}

/** Forma exacta del análisis que devuelve Claude (salida estructurada). */
export const AuditSchema = z.object({
  documento_legible: z
    .boolean()
    .describe("false si el archivo no es un documento analizable o no se puede leer"),
  motivo_no_legible: z
    .string()
    .describe("Si documento_legible es false, explica en una frase por qué. Si no, cadena vacía."),
  tipo_documento: z.string().describe("Qué es el documento, en 3-6 palabras"),
  semaforo: z.enum(["verde", "amarillo", "rojo"]),
  veredicto: z.string().describe("Veredicto rápido: 1-2 frases directas"),
  puntos_criticos: z
    .array(
      z.object({
        titulo: z.string().describe("Nombre corto de la trampa, punto crítico o punto débil"),
        explicacion: z.string().describe("Qué implica para el usuario, en lenguaje llano"),
        cita: z
          .string()
          .describe("Texto literal o ubicación en el documento (cláusula, línea). Vacío si no aplica."),
        gravedad: z.enum(["alta", "media", "baja"]),
      }),
    )
    .describe("Exactamente los 3 puntos más importantes, de más a menos grave"),
  legal_vs_colado: z
    .array(
      z.object({
        lo_legal: z.string().describe("Contrato: lo que dice la normativa o la práctica habitual. Revisión: lo que espera quien lo lee."),
        lo_que_intentan_colarte: z.string().describe("Lo que dice, cobra o hace este documento"),
      }),
    )
    .describe("De 1 a 3 comparaciones"),
  plan_de_accion: z
    .array(z.string())
    .describe("De 3 a 5 pasos concretos, ordenados, que empiezan por un verbo"),
});

export type Audit = z.infer<typeof AuditSchema>;

/** Estado de la cuenta que la API devuelve al cliente. */
export type Account = {
  user: { email: string; name: string | null } | null;
  plan: PlanId;
  /** Auditorías del plan usadas este mes y su límite */
  used: number;
  limit: number;
  /** Auditorías sueltas compradas en packs (no caducan) */
  credits: number;
  /** Total que puede hacer ahora mismo */
  remaining: number;
  providers: ProviderId[];
  /** live = Stripe, demo = simulado (AUDITORX_MOCK), off = sin configurar */
  payments: "live" | "demo" | "off";
  /** Tiene pendiente el descuento por haber dejado su correo */
  discount: boolean;
};
