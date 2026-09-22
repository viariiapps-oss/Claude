import "server-only";
import { cache } from "react";
import { getGameDetail } from "./games.service";

/** Per-request memoization so generateMetadata and the page share one lookup. */
export const getGameDetailCached = cache(getGameDetail);
