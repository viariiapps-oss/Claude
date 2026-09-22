import { apiHandler, HttpError, optionsHandler, placeIdParam } from "@/lib/api";
import { getGameDetail } from "@/services/games.service";

/** GET /api/games/{placeId}/stats — current counters, like ratio, growth and peak only. */
export const GET = apiHandler<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    const id = placeIdParam.safeParse((await params).id);
    if (!id.success) throw new HttpError(400, "Invalid game ID");
    const r = await getGameDetail(id.data);
    if (r.status !== "ok") throw new HttpError(404, r.status === "not-found" ? r.reason : "Not found");
    const { stats, growth, peak, likeRatio, source } = r.game;
    return { placeId: id.data, universeId: r.game.meta.universeId, source, stats, likeRatio, growth, peak };
  },
  { cacheSeconds: 30 },
);

export const OPTIONS = optionsHandler();
