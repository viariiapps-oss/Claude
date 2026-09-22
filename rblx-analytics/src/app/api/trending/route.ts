import { z } from "zod";
import { apiHandler, optionsHandler, parseQuery } from "@/lib/api";
import { rank, RANKINGS, type RankingKey } from "@/services/rankings.service";
import { listGameSummaries } from "@/services/games.service";

const keys = Object.keys(RANKINGS) as [RankingKey, ...RankingKey[]];
const query = z.object({
  ranking: z.enum(keys).default("trending"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/trending?ranking=trending|most-played|most-visited|fastest-growing|highest-revenue */
export const GET = apiHandler(
  async (req) => {
    const { ranking, limit } = parseQuery(req, query);
    const { games, source } = await listGameSummaries();
    return {
      source,
      ranking,
      ...RANKINGS[ranking],
      note: "Rankings reflect a single metric. They are not a judgement of quality.",
      games: rank(games, ranking, limit).map((g, i) => ({ rank: i + 1, ...g })),
    };
  },
  { cacheSeconds: 60 },
);

export const OPTIONS = optionsHandler();
