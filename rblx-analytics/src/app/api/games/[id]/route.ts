import { apiHandler, HttpError, optionsHandler, placeIdParam } from "@/lib/api";
import { getGameDetail } from "@/services/games.service";

/** GET /api/games/{placeId} — full game detail (metadata, stats, growth, peak, revenue estimate). */
export const GET = apiHandler<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    const id = placeIdParam.safeParse((await params).id);
    if (!id.success) throw new HttpError(400, "Invalid game ID");
    const r = await getGameDetail(id.data);
    if (r.status === "redirect") throw new HttpError(404, `Use the root place ID ${r.placeId}`, { placeId: r.placeId });
    if (r.status === "not-found") throw new HttpError(404, r.reason);
    return r.game;
  },
  { cacheSeconds: 30 },
);

export const OPTIONS = optionsHandler();
