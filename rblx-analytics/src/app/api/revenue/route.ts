import { z } from "zod";
import { DEFAULT_REVENUE_MODEL } from "@/config/revenue-model";
import { apiHandler, optionsHandler, parseQuery } from "@/lib/api";
import { getSummariesForPlaceIds, listGameSummaries } from "@/services/games.service";

const query = z.object({
  ids: z
    .string()
    .regex(/^\d{1,20}(,\d{1,20}){0,9}$/, "Comma-separated place IDs (max 10)")
    .optional()
    .transform((v) => (v ? v.split(",").map(Number) : undefined)),
});

/** GET /api/revenue[?ids=placeId,placeId] — ESTIMATED revenue ranges + the model assumptions. */
export const GET = apiHandler(
  async (req) => {
    const { ids } = parseQuery(req, query);
    const { source, games } = ids ? { source: undefined, games: await getSummariesForPlaceIds(ids) } : await listGameSummaries();
    return {
      disclaimer:
        "Estimated Revenue ≠ Official Revenue. Values are model estimates of creator earnings (USD at the DevEx rate) derived from public engagement data and documented assumptions.",
      source: source ?? games[0]?.source ?? null,
      model: DEFAULT_REVENUE_MODEL,
      estimates: games.map((g) => ({ placeId: g.meta.placeId, name: g.meta.name, source: g.source, revenue: g.revenue })),
    };
  },
  { cacheSeconds: 60 },
);

export const OPTIONS = optionsHandler();
