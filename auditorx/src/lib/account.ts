import type { Account } from "./audit-schema";
import { type AuthUser, authProviders } from "./auth";
import { creditsKey, paymentsMode, planFor } from "./billing";
import { leadFor } from "./leads";
import { FREE_AUDITS, auditsFor } from "./plans";
import { type Session, currentMonth } from "./session";
import { store } from "./store";

const usageKey = (userId: string) => `usage:${userId}:${currentMonth()}`;

/**
 * Estado de la cuenta. Con sesión iniciada, plan, uso y créditos salen del
 * almacén; sin ella, el contador gratuito vive en la cookie firmada.
 */
export async function accountFor(user: AuthUser | null, session: Session): Promise<Account> {
  const base = { providers: authProviders, payments: paymentsMode() };
  if (!user) {
    return {
      ...base,
      user: null,
      plan: "free",
      used: session.used,
      limit: FREE_AUDITS,
      credits: 0,
      remaining: Math.max(0, FREE_AUDITS - session.used),
      discount: false,
    };
  }
  const [plan, used, credits, lead] = await Promise.all([
    planFor(user.id),
    store.get<number>(usageKey(user.id)),
    store.get<number>(creditsKey(user.id)),
    leadFor(user.email),
  ]);
  const limit = auditsFor(plan);
  const u = used ?? 0;
  const c = Math.max(0, credits ?? 0);
  return {
    ...base,
    user: { email: user.email, name: user.name ?? null },
    plan,
    used: u,
    limit,
    credits: c,
    remaining: Math.max(0, limit - u) + c,
    discount: Boolean(lead && !lead.used) && plan === "free",
  };
}

/** Descuenta una auditoría de un usuario: primero del plan, luego de los packs. */
export async function consume(user: AuthUser, account: Account): Promise<Account> {
  if (account.used < account.limit) {
    await store.incrby(usageKey(user.id), 1);
    return { ...account, used: account.used + 1, remaining: account.remaining - 1 };
  }
  await store.incrby(creditsKey(user.id), -1);
  return { ...account, credits: account.credits - 1, remaining: account.remaining - 1 };
}
