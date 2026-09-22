import { z } from "zod";

/**
 * Response schemas for Roblox's public web APIs. Fields we do not rely on are
 * omitted; fields whose presence is not guaranteed are optional/nullable so a
 * Roblox-side change degrades to "Data unavailable" instead of a crash.
 */

const nullableNumber = z.number().nullable().optional();

export const creatorSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(["User", "Group"]),
  hasVerifiedBadge: z.boolean().optional().default(false),
});

export const gameSchema = z.object({
  id: z.number(), // universe id
  rootPlaceId: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  creator: creatorSchema,
  playing: nullableNumber,
  visits: nullableNumber,
  maxPlayers: nullableNumber,
  created: z.string().nullable().optional(),
  updated: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  genre_l1: z.string().nullable().optional(),
  genre_l2: z.string().nullable().optional(),
  favoritedCount: nullableNumber,
});
export type RobloxGame = z.infer<typeof gameSchema>;
export const gamesResponseSchema = z.object({ data: z.array(gameSchema) });

export const votesResponseSchema = z.object({
  data: z.array(z.object({ id: z.number(), upVotes: z.number(), downVotes: z.number() })),
});

export const favoritesCountSchema = z.object({ favoritesCount: z.number() });

export const placeToUniverseSchema = z.object({ universeId: z.number().nullable() });

export const iconsResponseSchema = z.object({
  data: z.array(
    z.object({ targetId: z.number(), state: z.string(), imageUrl: z.string().nullable().optional() }),
  ),
});

export const thumbnailsResponseSchema = z.object({
  data: z.array(
    z.object({
      universeId: z.number(),
      thumbnails: z
        .array(z.object({ state: z.string(), imageUrl: z.string().nullable().optional() }))
        .optional()
        .default([]),
    }),
  ),
});

/** apis.roblox.com/game-passes/v1 — replacement for the deprecated games.roblox.com game-passes endpoint. */
const gamePassSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
    price: z.number().nullable().optional(),
    priceInRobux: z.number().nullable().optional(),
    isForSale: z.boolean().optional(),
  })
  .transform((p) => ({
    id: p.id ?? null,
    name: p.name ?? null,
    price: p.price ?? p.priceInRobux ?? null,
    isForSale: p.isForSale ?? null,
  }));

export const gamePassesResponseSchema = z
  .object({
    gamePasses: z.array(gamePassSchema).optional(),
    data: z.array(gamePassSchema).optional(),
    nextPageToken: z.string().nullable().optional(),
  })
  .transform((r) => ({ passes: r.gamePasses ?? r.data ?? [], nextPageToken: r.nextPageToken ?? null }));

export const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  memberCount: z.number().nullable().optional(),
  hasVerifiedBadge: z.boolean().optional().default(false),
});

export const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().nullable().optional(),
  hasVerifiedBadge: z.boolean().optional().default(false),
});

export const creatorGamesResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      rootPlace: z.object({ id: z.number() }).nullable().optional(),
      placeVisits: nullableNumber,
      created: z.string().nullable().optional(),
      updated: z.string().nullable().optional(),
    }),
  ),
  nextPageCursor: z.string().nullable().optional(),
});

/**
 * apis.roblox.com/search-api/omni-search — the endpoint roblox.com's own search
 * box uses. It is public but UNDOCUMENTED, so it can change without notice;
 * it can be disabled with ROBLOX_ENABLE_OMNI_SEARCH=false.
 */
export const omniSearchSchema = z.object({
  searchResults: z
    .array(
      z.object({
        contentGroupType: z.string().optional(),
        contents: z
          .array(
            z.object({
              universeId: z.number().optional(),
              rootPlaceId: z.number().optional(),
              name: z.string().optional(),
              playerCount: z.number().nullable().optional(),
              creatorName: z.string().nullable().optional(),
            }),
          )
          .optional()
          .default([]),
      }),
    )
    .optional()
    .default([]),
});
