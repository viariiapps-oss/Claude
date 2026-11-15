/** Catálogo de precios. Es la única fuente de verdad: interfaz y Stripe leen de aquí. */

export type PlanId = "free" | "pro" | "plus" | "premium" | "max";
export type PaidPlanId = Exclude<PlanId, "free">;
export type Interval = "month" | "year";

export type Plan = {
  id: PaidPlanId;
  name: string;
  /** Auditorías incluidas al mes */
  audits: number;
  /** Precios en céntimos de euro */
  month: number;
  year: number;
  tagline: string;
};

export const FREE_AUDITS = 2;

export const PLANS: Plan[] = [
  { id: "pro", name: "Pro", audits: 15, month: 50, year: 499, tagline: "Para el papeleo del día a día" },
  { id: "plus", name: "Plus", audits: 25, month: 99, year: 899, tagline: "Si revisas facturas cada mes" },
  { id: "premium", name: "Premium", audits: 35, month: 149, year: 1299, tagline: "Para toda la familia" },
  { id: "max", name: "Max", audits: 50, month: 199, year: 1799, tagline: "Autónomos y pequeños negocios" },
];

export type Pack = { id: string; audits: number; price: number };

/**
 * Packs de pago único; las auditorías no caducan. El más pequeño cuesta
 * 0,50 € porque Stripe no admite cobros inferiores en euros.
 */
export const PACKS: Pack[] = [
  { id: "p10", audits: 10, price: 50 },
  { id: "p25", audits: 25, price: 99 },
  { id: "p50", audits: 50, price: 179 },
  { id: "p100", audits: 100, price: 299 },
];

/** Descuento prometido a quien deja su correo en una función "próximamente". */
export const LEAD_DISCOUNT_PERCENT = 30;
/** Cobro mínimo de Stripe en EUR, en céntimos. */
export const MIN_CHARGE = 50;

export function planById(id: string | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function auditsFor(plan: PlanId): number {
  return planById(plan)?.audits ?? FREE_AUDITS;
}

/** El descuento solo puede aplicarse si el precio resultante supera el mínimo de Stripe. */
export function discountApplies(amount: number): boolean {
  return Math.round(amount * (1 - LEAD_DISCOUNT_PERCENT / 100)) >= MIN_CHARGE;
}

export function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

/** Funciones "próximamente" (fake doors): miden interés antes de construirlas. */
export const COMING_SOON = {
  reclamacion: { icon: "✉️", label: "Generar carta de reclamación", blurb: "Una carta lista para enviar, con las cláusulas y la normativa ya citadas." },
  abogado: { icon: "⚖️", label: "Hablar con un abogado", blurb: "Una consulta de 15 minutos con un abogado que ya ha visto tu análisis." },
  pdf: { icon: "📄", label: "Descargar informe en PDF", blurb: "Tu auditoría en un PDF para enviar al casero, al taller o a tu gestor." },
  comparador: { icon: "💸", label: "Encontrar una oferta mejor", blurb: "Comparamos tu tarifa o presupuesto con el mercado y te decimos cuánto ahorrarías." },
  whatsapp: { icon: "📲", label: "Auditar por WhatsApp", blurb: "Reenvía la foto del documento a un número y recibe el semáforo en el chat." },
  alertas: { icon: "🔔", label: "Alertas de renovación", blurb: "Te avisamos antes de que venza una permanencia o se renueve un contrato." },
  historial: { icon: "🗂️", label: "Historial de documentos", blurb: "Todas tus auditorías guardadas y ordenadas, para volver a ellas cuando quieras." },
  familia: { icon: "👥", label: "Plan familiar", blurb: "Comparte tus auditorías con hasta 5 personas de tu casa." },
} as const;

export type FeatureId = keyof typeof COMING_SOON;
