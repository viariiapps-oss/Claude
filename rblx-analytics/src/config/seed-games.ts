import type { CreatorType } from "@/types";

/**
 * Default tracked experiences.
 *
 * `placeId` values are the public IDs from roblox.com/games/{placeId} URLs and
 * are authoritative: in live mode the universe ID is always re-resolved from the
 * place ID through apis.roblox.com, so a wrong `universeIdHint` self-corrects.
 *
 * The `demo` block drives DEMO MODE only. Those numbers are synthetic, merely
 * shaped to look realistic, and are always labelled "DEMO DATA" in the UI.
 * They must never be presented as real statistics.
 */
export interface SeedGame {
  placeId: number;
  universeIdHint: number;
  name: string;
  creator: { id: number; name: string; type: CreatorType; verified: boolean };
  genre: string;
  createdAt: string;
  demo: {
    /** Typical concurrent players around the reference date. */
    ccu: number;
    /** Cumulative visits at the reference date. */
    visits: number;
    favorites: number;
    likes: number;
    dislikes: number;
    /** Daily trend of CCU (e.g. 0.004 = +0.4 %/day). */
    trend: number;
    /** Days between simulated content updates. */
    updateEvery: number;
    gamePasses: number;
    maxPlayers: number;
  };
}

export const DEMO_REFERENCE_DATE = Date.UTC(2026, 8, 1); // 2026-09-01

export const SEED_GAMES: SeedGame[] = [
  { placeId: 126884695634066, universeIdHint: 7436755782, name: "Grow a Garden", creator: { id: 35789249, name: "Grow a Garden", type: "Group", verified: true }, genre: "Simulation", createdAt: "2025-03-26T00:00:00Z", demo: { ccu: 1_150_000, visits: 32_500_000_000, favorites: 16_200_000, likes: 3_050_000, dislikes: 420_000, trend: -0.0035, updateEvery: 7, gamePasses: 14, maxPlayers: 6 } },
  { placeId: 109983668079237, universeIdHint: 7709344486, name: "Steal a Brainrot", creator: { id: 34869880, name: "BRAZIL", type: "Group", verified: true }, genre: "Party & Casual", createdAt: "2025-05-15T00:00:00Z", demo: { ccu: 980_000, visits: 27_800_000_000, favorites: 12_900_000, likes: 2_400_000, dislikes: 380_000, trend: 0.0012, updateEvery: 7, gamePasses: 11, maxPlayers: 8 } },
  { placeId: 79546208627805, universeIdHint: 7326934954, name: "99 Nights in the Forest", creator: { id: 34523401, name: "Grandma's Favourite Games", type: "Group", verified: true }, genre: "Survival", createdAt: "2025-04-08T00:00:00Z", demo: { ccu: 620_000, visits: 18_400_000_000, favorites: 9_800_000, likes: 2_900_000, dislikes: 310_000, trend: 0.0021, updateEvery: 14, gamePasses: 9, maxPlayers: 5 } },
  { placeId: 4924922222, universeIdHint: 1686885941, name: "Brookhaven 🏡RP", creator: { id: 32516442, name: "Voldex", type: "Group", verified: true }, genre: "Roleplay & Avatar Sim", createdAt: "2020-04-21T00:00:00Z", demo: { ccu: 520_000, visits: 72_300_000_000, favorites: 31_000_000, likes: 5_600_000, dislikes: 1_400_000, trend: 0.0004, updateEvery: 21, gamePasses: 12, maxPlayers: 18 } },
  { placeId: 2753915549, universeIdHint: 994732206, name: "Blox Fruits", creator: { id: 2851520, name: "Gamer Robot Inc", type: "Group", verified: true }, genre: "RPG", createdAt: "2019-01-16T00:00:00Z", demo: { ccu: 410_000, visits: 49_600_000_000, favorites: 20_400_000, likes: 7_200_000, dislikes: 880_000, trend: -0.0006, updateEvery: 30, gamePasses: 23, maxPlayers: 12 } },
  { placeId: 17625359962, universeIdHint: 6035872082, name: "RIVALS", creator: { id: 16869640, name: "Nosniy Games", type: "Group", verified: true }, genre: "Shooter", createdAt: "2024-06-01T00:00:00Z", demo: { ccu: 220_000, visits: 9_100_000_000, favorites: 5_100_000, likes: 1_900_000, dislikes: 190_000, trend: 0.0018, updateEvery: 14, gamePasses: 7, maxPlayers: 14 } },
  { placeId: 920587237, universeIdHint: 383310974, name: "Adopt Me!", creator: { id: 295182, name: "Uplift Games", type: "Group", verified: true }, genre: "Roleplay & Avatar Sim", createdAt: "2017-07-14T00:00:00Z", demo: { ccu: 210_000, visits: 41_700_000_000, favorites: 26_800_000, likes: 4_500_000, dislikes: 950_000, trend: 0.0002, updateEvery: 7, gamePasses: 18, maxPlayers: 48 } },
  { placeId: 15101393044, universeIdHint: 5203828273, name: "Dress To Impress", creator: { id: 33372337, name: "Dress To Impress", type: "Group", verified: true }, genre: "Party & Casual", createdAt: "2023-11-05T00:00:00Z", demo: { ccu: 180_000, visits: 11_200_000_000, favorites: 8_300_000, likes: 2_700_000, dislikes: 330_000, trend: -0.0009, updateEvery: 14, gamePasses: 10, maxPlayers: 16 } },
  { placeId: 10449761463, universeIdHint: 4509896324, name: "The Strongest Battlegrounds", creator: { id: 12836673, name: "Yielding Arts", type: "Group", verified: true }, genre: "Action", createdAt: "2022-08-01T00:00:00Z", demo: { ccu: 160_000, visits: 11_900_000_000, favorites: 6_100_000, likes: 2_200_000, dislikes: 260_000, trend: 0.0003, updateEvery: 21, gamePasses: 6, maxPlayers: 15 } },
  { placeId: 142823291, universeIdHint: 66654135, name: "Murder Mystery 2", creator: { id: 1848960, name: "Nikilis", type: "User", verified: true }, genre: "Party & Casual", createdAt: "2014-02-06T00:00:00Z", demo: { ccu: 140_000, visits: 16_300_000_000, favorites: 11_400_000, likes: 2_100_000, dislikes: 450_000, trend: 0.0001, updateEvery: 28, gamePasses: 8, maxPlayers: 12 } },
  { placeId: 16732694052, universeIdHint: 5750914919, name: "Fisch", creator: { id: 34151093, name: "Fisch", type: "Group", verified: true }, genre: "Simulation", createdAt: "2024-08-01T00:00:00Z", demo: { ccu: 110_000, visits: 7_300_000_000, favorites: 4_900_000, likes: 1_500_000, dislikes: 210_000, trend: -0.0012, updateEvery: 10, gamePasses: 15, maxPlayers: 20 } },
  { placeId: 8737899170, universeIdHint: 3317771874, name: "Pet Simulator 99", creator: { id: 3959677, name: "BIG Games Pets", type: "Group", verified: true }, genre: "Simulation", createdAt: "2023-12-08T00:00:00Z", demo: { ccu: 90_000, visits: 12_100_000_000, favorites: 5_600_000, likes: 1_800_000, dislikes: 420_000, trend: -0.0008, updateEvery: 7, gamePasses: 26, maxPlayers: 12 } },
  { placeId: 6516141723, universeIdHint: 2440500124, name: "DOORS", creator: { id: 12597416, name: "LSPLASH", type: "Group", verified: true }, genre: "Survival", createdAt: "2021-08-13T00:00:00Z", demo: { ccu: 70_000, visits: 13_400_000_000, favorites: 9_200_000, likes: 3_300_000, dislikes: 260_000, trend: 0.0004, updateEvery: 30, gamePasses: 3, maxPlayers: 4 } },
  { placeId: 13772394625, universeIdHint: 4777817887, name: "Blade Ball", creator: { id: 33337891, name: "Wiggity", type: "Group", verified: true }, genre: "Action", createdAt: "2023-06-01T00:00:00Z", demo: { ccu: 60_000, visits: 7_400_000_000, favorites: 3_900_000, likes: 1_300_000, dislikes: 290_000, trend: -0.0015, updateEvery: 7, gamePasses: 12, maxPlayers: 15 } },
  { placeId: 2788229376, universeIdHint: 1008451066, name: "Da Hood", creator: { id: 4372130, name: "Da Hood Entertainment", type: "Group", verified: true }, genre: "Action", createdAt: "2019-01-08T00:00:00Z", demo: { ccu: 55_000, visits: 6_200_000_000, favorites: 4_800_000, likes: 1_700_000, dislikes: 540_000, trend: -0.0004, updateEvery: 30, gamePasses: 9, maxPlayers: 38 } },
  { placeId: 1962086868, universeIdHint: 703124385, name: "Tower of Hell", creator: { id: 3149674, name: "YXCeptional Studios", type: "Group", verified: true }, genre: "Obby & Platformer", createdAt: "2018-06-10T00:00:00Z", demo: { ccu: 45_000, visits: 27_300_000_000, favorites: 9_700_000, likes: 3_000_000, dislikes: 960_000, trend: 0.0, updateEvery: 45, gamePasses: 6, maxPlayers: 20 } },
  { placeId: 1537690962, universeIdHint: 601130232, name: "Bee Swarm Simulator", creator: { id: 3982592, name: "Bee Swarm Simulator Club", type: "Group", verified: true }, genre: "Simulation", createdAt: "2018-03-20T00:00:00Z", demo: { ccu: 45_000, visits: 5_100_000_000, favorites: 5_400_000, likes: 1_900_000, dislikes: 120_000, trend: 0.0006, updateEvery: 45, gamePasses: 8, maxPlayers: 6 } },
  { placeId: 606849621, universeIdHint: 245683, name: "Jailbreak", creator: { id: 3059674, name: "Badimo", type: "Group", verified: true }, genre: "Action", createdAt: "2017-04-21T00:00:00Z", demo: { ccu: 40_000, visits: 8_000_000_000, favorites: 8_100_000, likes: 2_900_000, dislikes: 370_000, trend: -0.0002, updateEvery: 30, gamePasses: 10, maxPlayers: 30 } },
  { placeId: 286090429, universeIdHint: 111958650, name: "Arsenal", creator: { id: 2613928, name: "ROLVe Community", type: "Group", verified: true }, genre: "Shooter", createdAt: "2015-08-15T00:00:00Z", demo: { ccu: 35_000, visits: 18_500_000_000, favorites: 6_900_000, likes: 2_800_000, dislikes: 410_000, trend: -0.0003, updateEvery: 30, gamePasses: 5, maxPlayers: 16 } },
  { placeId: 189707, universeIdHint: 65241, name: "Natural Disaster Survival", creator: { id: 80254, name: "Stickmasterluke", type: "User", verified: true }, genre: "Survival", createdAt: "2008-05-26T00:00:00Z", demo: { ccu: 30_000, visits: 5_200_000_000, favorites: 4_300_000, likes: 1_900_000, dislikes: 170_000, trend: 0.0, updateEvery: 60, gamePasses: 2, maxPlayers: 30 } },
  { placeId: 537413528, universeIdHint: 210851291, name: "Build A Boat For Treasure", creator: { id: 1099318, name: "Chillz Studios", type: "Group", verified: true }, genre: "Adventure", createdAt: "2016-10-29T00:00:00Z", demo: { ccu: 30_000, visits: 4_100_000_000, favorites: 3_800_000, likes: 1_400_000, dislikes: 150_000, trend: 0.0002, updateEvery: 30, gamePasses: 16, maxPlayers: 18 } },
  { placeId: 735030788, universeIdHint: 318487183, name: "Royale High", creator: { id: 4199740, name: "Royale High", type: "Group", verified: true }, genre: "Roleplay & Avatar Sim", createdAt: "2017-02-01T00:00:00Z", demo: { ccu: 25_000, visits: 11_300_000_000, favorites: 9_500_000, likes: 2_200_000, dislikes: 700_000, trend: -0.0005, updateEvery: 30, gamePasses: 7, maxPlayers: 40 } },
  { placeId: 192800, universeIdHint: 47545, name: "Work at a Pizza Place", creator: { id: 55, name: "Dued1", type: "User", verified: true }, genre: "Roleplay & Avatar Sim", createdAt: "2008-06-14T00:00:00Z", demo: { ccu: 18_000, visits: 5_100_000_000, favorites: 7_400_000, likes: 1_800_000, dislikes: 190_000, trend: 0.0001, updateEvery: 60, gamePasses: 4, maxPlayers: 24 } },
  { placeId: 4623386862, universeIdHint: 1716232140, name: "Piggy", creator: { id: 5213413, name: "MiniToon", type: "User", verified: true }, genre: "Survival", createdAt: "2020-01-23T00:00:00Z", demo: { ccu: 12_000, visits: 13_600_000_000, favorites: 6_000_000, likes: 2_600_000, dislikes: 420_000, trend: -0.0006, updateEvery: 60, gamePasses: 5, maxPlayers: 12 } },
];
