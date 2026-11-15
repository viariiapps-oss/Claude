import Stripe from "stripe";
import { type Lead, leadFor, markLeadUsed } from "./leads";
import {
  type Interval,
  LEAD_DISCOUNT_PERCENT,
  PACKS,
  type PlanId,
  discountApplies,
  planById,
} from "./plans";
import { RENTA_PRICE } from "./plans";
import { rentaCreditsKey } from "./renta/access";
import { MOCK, store } from "./store";

const PLAN_CACHE_MS = 60 * 60 * 1000;
const COUPON_ID = "AUDITORX_LEAD_30";

let client: Stripe | null = null;

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

export function paymentsMode(): "live" | "demo" | "off" {
  return stripe() ? "live" : MOCK ? "demo" : "off";
}

export function appUrl(requestUrl: string): string {
  return (process.env.APP_URL || new URL(requestUrl).origin).replace(/\/$/, "");
}

/* ── Estado de facturación por usuario ──────────────────────────────────── */

type Billing = { customerId?: string; plan: PlanId; checkedAt?: number };

const billKey = (userId: string) => `bill:${userId}`;
export const creditsKey = (userId: string) => `credits:${userId}`;

async function billing(userId: string): Promise<Billing> {
  return (await store.get<Billing>(billKey(userId))) ?? { plan: "free" };
}

/** Plan vigente. Stripe es la fuente de verdad; se cachea una hora. */
export async function planFor(userId: string): Promise<PlanId> {
  const bill = await billing(userId);
  const s = stripe();
  if (!s || !bill.customerId) return bill.plan;
  if (bill.checkedAt && Date.now() - bill.checkedAt < PLAN_CACHE_MS) return bill.plan;

  const subs = await s.subscriptions.list({ customer: bill.customerId, status: "all", limit: 10 });
  const active = subs.data.find((sub) => sub.status === "active" || sub.status === "trialing");
  const plan = planById(active?.metadata.plan)?.id ?? "free";
  await store.set(billKey(userId), { ...bill, plan, checkedAt: Date.now() });
  return plan;
}

/* ── Checkout ───────────────────────────────────────────────────────────── */

export type Purchase =
  | { kind: "plan"; plan: string; interval: Interval }
  | { kind: "pack"; pack: string }
  | { kind: "renta" };

export class CheckoutError extends Error {}

async function leadCoupon(s: Stripe): Promise<string> {
  try {
    await s.coupons.retrieve(COUPON_ID);
  } catch {
    await s.coupons.create({
      id: COUPON_ID,
      name: `Bienvenida -${LEAD_DISCOUNT_PERCENT} %`,
      percent_off: LEAD_DISCOUNT_PERCENT,
      duration: "once",
    });
  }
  return COUPON_ID;
}

/** Crea la compra y devuelve la URL a la que enviar al usuario. */
export async function startCheckout(
  user: { id: string; email: string },
  purchase: Purchase,
  base: string,
): Promise<string> {
  const plan = purchase.kind === "plan" ? planById(purchase.plan) : undefined;
  const pack = purchase.kind === "pack" ? PACKS.find((p) => p.id === purchase.pack) : undefined;
  const renta = purchase.kind === "renta";
  if (!plan && !pack && !renta) throw new CheckoutError("Ese producto no existe.");

  const bill = await billing(user.id);
  if (plan && (await planFor(user.id)) !== "free") {
    throw new CheckoutError("Ya tienes una suscripción. Cancélala desde «Gestionar» antes de cambiar de plan.");
  }

  const s = stripe();
  if (!s) {
    if (!MOCK) throw new CheckoutError("Los pagos todavía no están activados.");
    // Pago simulado para probar la interfaz.
    if (plan) await store.set(billKey(user.id), { ...bill, plan: plan.id });
    if (pack) await store.incrby(creditsKey(user.id), pack.audits);
    if (renta) {
      await store.incrby(rentaCreditsKey(user.id), 1);
      return `${base}/renta?ok=renta`;
    }
    return `${base}/?ok=${plan ? "plan" : "pack"}`;
  }

  const who = bill.customerId ? { customer: bill.customerId } : { customer_email: user.email };
  const common = {
    ...who,
    client_reference_id: user.id,
    locale: "es" as const,
    success_url: `${base}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/`,
  };

  if (plan) {
    const interval = purchase.kind === "plan" && purchase.interval === "year" ? "year" : "month";
    const amount = plan[interval];
    const lead: Lead | null = await leadFor(user.email);
    const discount = Boolean(lead && !lead.used) && discountApplies(amount);
    const checkout = await s.checkout.sessions.create({
      ...common,
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amount,
            recurring: { interval },
            product_data: { name: `AuditorX ${plan.name} · ${plan.audits} auditorías al mes` },
          },
        },
      ],
      ...(discount ? { discounts: [{ coupon: await leadCoupon(s) }] } : {}),
      subscription_data: { metadata: { plan: plan.id, userId: user.id } },
      metadata: { kind: "plan", plan: plan.id, userId: user.id, email: user.email, discount: discount ? "1" : "" },
    });
    return checkout.url!;
  }

  if (renta) {
    const checkout = await s.checkout.sessions.create({
      ...common,
      cancel_url: `${base}/renta`,
      mode: "payment",
      ...(bill.customerId ? {} : { customer_creation: "always" as const }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: RENTA_PRICE,
            product_data: { name: "AuditorX · Informe de cálculo de la Renta" },
          },
        },
      ],
      metadata: { kind: "renta", userId: user.id },
    });
    return checkout.url!;
  }

  const checkout = await s.checkout.sessions.create({
    ...common,
    mode: "payment",
    ...(bill.customerId ? {} : { customer_creation: "always" as const }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: pack!.price,
          product_data: { name: `AuditorX · Pack de ${pack!.audits} auditorías` },
        },
      },
    ],
    metadata: { kind: "pack", pack: pack!.id, userId: user.id },
  });
  return checkout.url!;
}

/**
 * Entrega lo comprado. Se llama desde la redirección de vuelta y desde el
 * webhook; la marca `paid:<id>` garantiza que cada compra se entrega una vez.
 */
export async function fulfill(checkoutId: string): Promise<"plan" | "pack" | "renta" | null> {
  const s = stripe();
  if (!s) return null;
  const checkout = await s.checkout.sessions.retrieve(checkoutId);
  const { kind, userId, pack: packId, plan: planId, email, discount } = checkout.metadata ?? {};
  if (checkout.status !== "complete" || !userId) return null;
  if (kind !== "plan" && kind !== "pack" && kind !== "renta") return null;

  const first = await store.set(`paid:${checkout.id}`, 1, { nx: true });
  if (!first) return kind;

  const customerId = typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
  const bill = await billing(userId);

  if (kind === "renta") {
    if (checkout.payment_status === "paid") await store.incrby(rentaCreditsKey(userId), 1);
    await store.set(billKey(userId), { ...bill, customerId: customerId ?? bill.customerId });
  } else if (kind === "pack") {
    const pack = PACKS.find((p) => p.id === packId);
    if (pack && checkout.payment_status === "paid") await store.incrby(creditsKey(userId), pack.audits);
    await store.set(billKey(userId), { ...bill, customerId: customerId ?? bill.customerId });
  } else {
    const plan = planById(planId)?.id ?? "free";
    await store.set(billKey(userId), { customerId: customerId ?? bill.customerId, plan, checkedAt: Date.now() });
    if (discount && email) await markLeadUsed(email);
  }
  return kind;
}

/** Fuerza a volver a consultar el plan en Stripe (tras cancelar o cambiar). */
export async function invalidatePlan(userId: string): Promise<void> {
  const bill = await billing(userId);
  await store.set(billKey(userId), { ...bill, checkedAt: 0 });
}

export async function portalUrl(userId: string, base: string): Promise<string | null> {
  const s = stripe();
  const bill = await billing(userId);
  if (!s) {
    if (MOCK) await store.set(billKey(userId), { ...bill, plan: "free" }); // demo: «gestionar» cancela
    return MOCK ? `${base}/` : null;
  }
  if (!bill.customerId) return null;
  await invalidatePlan(userId);
  const portal = await s.billingPortal.sessions.create({ customer: bill.customerId, return_url: `${base}/` });
  return portal.url;
}
