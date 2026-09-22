/**
 * Process-wide singletons that survive Next.js dev hot reloads.
 */
const store = globalThis as unknown as { __rblx?: Map<string, unknown> };

export function singleton<T>(key: string, create: () => T): T {
  if (!store.__rblx) store.__rblx = new Map();
  if (!store.__rblx.has(key)) store.__rblx.set(key, create());
  return store.__rblx.get(key) as T;
}
