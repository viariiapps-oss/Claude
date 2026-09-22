import { apiHandler, optionsHandler, parseQuery } from "@/lib/api";
import { applyExplorer, explorerSchema, genresOf } from "@/lib/explorer";
import { listGameSummaries } from "@/services/games.service";

/** GET /api/games — tracked games with filters, sorting and pagination. */
export const GET = apiHandler(
  async (req) => {
    const params = parseQuery(req, explorerSchema);
    const { games, source } = await listGameSummaries();
    return { source, genres: genresOf(games), ...applyExplorer(games, params) };
  },
  { cacheSeconds: 30 },
);

export const OPTIONS = optionsHandler();
