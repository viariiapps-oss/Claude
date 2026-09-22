import { apiHandler, HttpError, optionsHandler } from "@/lib/api";
import { getDeveloper } from "@/services/developers.service";
import { parseDeveloperId } from "@/utils/ids";

/** GET /api/developers/{group-123|user-456} — creator profile, games and aggregates. */
export const GET = apiHandler<{ params: Promise<{ id: string }> }>(
  async (_req, { params }) => {
    const { id } = await params;
    if (!parseDeveloperId(id)) throw new HttpError(400, "Developer id must look like group-123 or user-456");
    const dev = await getDeveloper(id);
    if (!dev) throw new HttpError(404, "Developer not found");
    return dev;
  },
  { cacheSeconds: 60 },
);

export const OPTIONS = optionsHandler();
