import { z } from "zod";
import { apiHandler, optionsHandler, parseQuery } from "@/lib/api";
import { searchGames } from "@/services/games.service";

const query = z.object({
  q: z.string().trim().min(1, "Query is required").max(200),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

/** GET /api/games/search?q= — by name, creator, place/universe ID or roblox.com URL. */
export const GET = apiHandler(
  async (req) => {
    const { q, limit } = parseQuery(req, query);
    return searchGames(q, limit);
  },
  { limitPerMinute: 60, name: "search", cacheSeconds: 30 },
);

export const OPTIONS = optionsHandler();
