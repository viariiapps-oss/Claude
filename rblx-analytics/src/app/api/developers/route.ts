import { z } from "zod";
import { apiHandler, optionsHandler, parseQuery } from "@/lib/api";
import { listDevelopers } from "@/services/developers.service";

const query = z.object({ q: z.string().trim().max(100).optional() });

/** GET /api/developers[?q=] — creators of tracked games with aggregate metrics. */
export const GET = apiHandler(
  async (req) => {
    const { q } = parseQuery(req, query);
    return listDevelopers(q);
  },
  { cacheSeconds: 60 },
);

export const OPTIONS = optionsHandler();
