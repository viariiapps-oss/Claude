import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { listGameSummaries } from "@/services/games.service";
import { developerId } from "@/utils/ids";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const now = new Date();
  const staticRoutes = ["", "/dashboard", "/games", "/trending", "/revenue", "/developers", "/compare", "/about"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const { games, source } = await listGameSummaries().catch(() => ({ games: [], source: "demo" as const }));
  // Demo pages are noindex, so only list game pages when serving live data.
  if (source !== "live") return staticRoutes;
  const devs = new Set(games.map((g) => developerId(g.meta.creator.type, g.meta.creator.id)));
  return [
    ...staticRoutes,
    ...games.map((g) => ({ url: `${base}/games/${g.meta.placeId}`, lastModified: new Date(g.stats.fetchedAt), changeFrequency: "hourly" as const, priority: 0.8 })),
    ...[...devs].map((id) => ({ url: `${base}/developers/${id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.5 })),
  ];
}
