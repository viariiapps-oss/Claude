import { z } from "zod";

export const CATEGORIES = ["alquiler", "suministros", "taller", "banco", "otro"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  alquiler: "Alquiler",
  suministros: "Suministros",
  taller: "Taller",
  banco: "Banco",
  otro: "Otro",
};

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
        titulo: z.string().describe("Nombre corto de la trampa o punto crítico"),
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
        lo_legal: z.string().describe("Lo que dice la normativa o la práctica habitual"),
        lo_que_intentan_colarte: z.string().describe("Lo que dice o cobra este documento"),
      }),
    )
    .describe("De 1 a 3 comparaciones"),
  plan_de_accion: z
    .array(z.string())
    .describe("De 3 a 5 pasos concretos, ordenados, que empiezan por un verbo"),
});

export type Audit = z.infer<typeof AuditSchema>;

/** Estado de la cuenta que la API devuelve junto a cada respuesta. */
export type Account = {
  pro: boolean;
  used: number;
  /** 0 = ilimitado */
  limit: number;
  /** Límite mensual del plan Pro (0 = ilimitado), para el texto del paywall */
  proLimit: number;
  demoPayments: boolean;
  yearlyAvailable: boolean;
};
