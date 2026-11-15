import { COMING_SOON, type FeatureId } from "./plans";
import { store } from "./store";

/** Persona que dejó su correo en una función «próximamente». */
export type Lead = { email: string; features: FeatureId[]; at: string; used: boolean };

const leadKey = (email: string) => `lead:${email.trim().toLowerCase()}`;

export function isFeature(id: unknown): id is FeatureId {
  return typeof id === "string" && id in COMING_SOON;
}

export const leadFor = (email: string) => store.get<Lead>(leadKey(email));

export async function recordClick(feature: FeatureId): Promise<void> {
  await store.incrby(`fd:clicks:${feature}`, 1);
}

export async function recordLead(feature: FeatureId, rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const existing = await leadFor(email);
  if (!existing?.features.includes(feature)) await store.incrby(`fd:emails:${feature}`, 1);
  await store.set(leadKey(email), {
    email,
    features: [...new Set([...(existing?.features ?? []), feature])],
    at: existing?.at ?? new Date().toISOString(),
    used: existing?.used ?? false,
  } satisfies Lead);
  await store.sadd("leads", email);
}

export async function markLeadUsed(email: string): Promise<void> {
  const lead = await leadFor(email);
  if (lead) await store.set(leadKey(email), { ...lead, used: true });
}

export async function leadReport() {
  const features = await Promise.all(
    (Object.keys(COMING_SOON) as FeatureId[]).map(async (id) => ({
      id,
      label: COMING_SOON[id].label,
      clicks: (await store.get<number>(`fd:clicks:${id}`)) ?? 0,
      emails: (await store.get<number>(`fd:emails:${id}`)) ?? 0,
    })),
  );
  const emails = await store.smembers("leads");
  const leads = (await Promise.all(emails.map(leadFor))).filter((l): l is Lead => l !== null);
  return { features, leads };
}
