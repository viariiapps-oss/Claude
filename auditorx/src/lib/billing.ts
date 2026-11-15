import Stripe from "stripe";
import type { Account } from "./audit-schema";
import type { Session } from "./session";

const PRO_CACHE_MS = 60 * 60 * 1000;

let client: Stripe | null = null;

/** null cuando no hay claves de Stripe: la app usa entonces el pago simulado. */
export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

export function priceId(plan: "monthly" | "yearly"): string | undefined {
  return plan === "yearly" ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
}

function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/**
 * Comprueba si la sesión tiene una suscripción activa. La fuente de verdad es
 * Stripe; el resultado se cachea una hora en la cookie firmada para no hacer
 * una llamada a Stripe en cada auditoría. Muta `session` con el resultado.
 */
export async function isPro(session: Session): Promise<boolean> {
  const s = stripe();
  if (!s) return Boolean(session.demoPro);
  if (!session.customerId) return false;
  if (session.proCheckedAt && Date.now() - session.proCheckedAt < PRO_CACHE_MS) {
    return Boolean(session.pro);
  }
  const subs = await s.subscriptions.list({ customer: session.customerId, status: "all", limit: 10 });
  session.pro = subs.data.some((sub) => sub.status === "active" || sub.status === "trialing");
  session.proCheckedAt = Date.now();
  return session.pro;
}

export async function accountFor(session: Session): Promise<Account> {
  const pro = await isPro(session);
  const demoPayments = stripe() === null;
  const proLimit = limitFromEnv("PRO_MONTHLY_LIMIT", 15);
  return {
    pro,
    used: session.used,
    limit: pro ? proLimit : limitFromEnv("FREE_MONTHLY_LIMIT", 2),
    proLimit,
    demoPayments,
    yearlyAvailable: demoPayments || Boolean(process.env.STRIPE_PRICE_YEARLY),
  };
}

export function hasQuota(account: Account): boolean {
  return account.limit === 0 || account.used < account.limit;
}

export function appUrl(requestUrl: string): string {
  return (process.env.APP_URL || new URL(requestUrl).origin).replace(/\/$/, "");
}
