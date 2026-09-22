import { z } from "zod";
import { apiHandler, HttpError, optionsHandler, parseQuery, placeIdParam } from "@/lib/api";
import { getGameHistory } from "@/services/games.service";

const query = z.object({ range: z.enum(["24h", "7d", "30d", "90d", "1y"]).default("7d") });

/** GET /api/games/{placeId}/history?range=24h|7d|30d|90d|1y — bucketed time series. */
export const GET = apiHandler<{ params: Promise<{ id: string }> }>(
  async (req, { params }) => {
    const id = placeIdParam.safeParse((await params).id);
    if (!id.success) throw new HttpError(400, "Invalid game ID");
    const { range } = parseQuery(req, query);
    const h = await getGameHistory(id.data, range);
    if (!h) throw new HttpError(404, "Game not found or not tracked");
    return h;
  },
  { cacheSeconds: 60 },
);

export const OPTIONS = optionsHandler();
