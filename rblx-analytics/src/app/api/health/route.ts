import { apiHandler } from "@/lib/api";
import { repo } from "@/db";
import { getDataStatus } from "@/services/data-status";

/** GET /api/health — liveness + active data source. No secrets. */
export const GET = apiHandler(async () => {
  const [status, dbOk] = await Promise.all([getDataStatus(), repo().ping()]);
  return { ok: true, dataMode: status.mode, activeSource: status.activeSource, storage: status.storage, storageOk: dbOk, time: new Date().toISOString() };
});
