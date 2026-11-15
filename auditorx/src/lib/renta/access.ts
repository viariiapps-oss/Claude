import { store } from "../store";

/**
 * Pase de Renta: da derecho a preparar una declaración (leer documentos y
 * calcular) durante un tiempo limitado. No guarda ningún dato fiscal: solo
 * cuántas lecturas de documento quedan.
 */
const PASS_DAYS = 30;
export const PASS_DOCS = 30;

type Pass = { docsLeft: number; since: string };

const passKey = (userId: string) => `renta:pass:${userId}`;
export const rentaCreditsKey = (userId: string) => `renta:credits:${userId}`;

export async function getPass(userId: string): Promise<Pass | null> {
  return store.get<Pass>(passKey(userId));
}

/** Abre un pase nuevo (sustituye al anterior). */
export async function openPass(userId: string): Promise<Pass> {
  const pass: Pass = { docsLeft: PASS_DOCS, since: new Date().toISOString() };
  await store.set(passKey(userId), pass, { ex: PASS_DAYS * 24 * 60 * 60 });
  return pass;
}

/** Descuenta una lectura de documento. Devuelve false si no queda ninguna. */
export async function useDoc(userId: string): Promise<boolean> {
  const pass = await getPass(userId);
  if (!pass || pass.docsLeft <= 0) return false;
  const ttl = Math.max(60, Math.ceil(PASS_DAYS * 86400 - (Date.now() - Date.parse(pass.since)) / 1000));
  await store.set(passKey(userId), { ...pass, docsLeft: pass.docsLeft - 1 }, { ex: ttl });
  return true;
}

/**
 * Registro técnico mínimo de cada cierre de expediente: cuándo y cuántos
 * documentos se descartaron. No contiene datos personales ni fiscales.
 */
export async function logPurge(userId: string, docs: number, motivo: string): Promise<void> {
  await store.set(`renta:purge:${userId}:${Date.now()}`, { docs, motivo, at: new Date().toISOString() }, { ex: 90 * 86400 });
}

/** Tope diario de lecturas mientras la Renta es gratuita, para acotar el gasto en IA. */
const FREE_DAILY = Number(process.env.RENTA_FREE_DAILY) > 0 ? Number(process.env.RENTA_FREE_DAILY) : 300;

export async function freeQuotaLeft(): Promise<boolean> {
  const key = `renta:free:${new Date().toISOString().slice(0, 10)}`;
  const n = await store.incrby(key, 1);
  if (n === 1) await store.expire(key, 2 * 86400);
  return n <= FREE_DAILY;
}
