/* ==========================================================================
   BloxBid — demo dataset
   Fictional games used to drive the prototype. Swap for the Roblox API layer.
   ========================================================================== */

const CATEGORIES = [
  { slug: 'action',            name: 'Action',              icon: '⚔️' },
  { slug: 'adventure',         name: 'Adventure',           icon: '🧭' },
  { slug: 'education',         name: 'Education',           icon: '🎓' },
  { slug: 'entertainment',     name: 'Entertainment',       icon: '🎬' },
  { slug: 'obby-platformer',   name: 'Obby & Platformer',   icon: '🪜' },
  { slug: 'party-casual',      name: 'Party & Casual',      icon: '🎉' },
  { slug: 'puzzle',            name: 'Puzzle',              icon: '🧩' },
  { slug: 'rpg',               name: 'RPG',                 icon: '🐉' },
  { slug: 'roleplay-avatar',   name: 'Roleplay & Avatar Sim', icon: '🏙️' },
  { slug: 'shooter',           name: 'Shooter',             icon: '🎯' },
  { slug: 'shopping',          name: 'Shopping',            icon: '🛍️' },
  { slug: 'simulation',        name: 'Simulation',          icon: '⚙️' },
  { slug: 'social',            name: 'Social',              icon: '💬' },
  { slug: 'sports-racing',     name: 'Sports & Racing',     icon: '🏁' },
  { slug: 'strategy',          name: 'Strategy',            icon: '♟️' },
  { slug: 'survival',          name: 'Survival',            icon: '🔥' },
  { slug: 'utility-other',     name: 'Utility & Other',     icon: '🧰' }
];

/* name, creator, group, category slug, subgenre, glyph, hue,
   players, visits, favorites, rating, serverSize, bid, bidToday, clicks, ageDays */
const RAW = [
  ['Tower Escape Ultimate','NovaPlay Studios','Nova Interactive','obby-platformer','Tower Obby','🗼',214,48210,986000000,4120000,93,24,1480,240,28410,1240],
  ['Pet Empire Tycoon','BrightBox Games','BrightBox','simulation','Tycoon','🐾',268,39870,1420000000,6800000,95,12,1325,186,24980,1610],
  ['Shadow Blade Legends','Kuro Devs','Kuro Collective','rpg','Open World RPG','🗡️',232,31240,742000000,2960000,91,30,1180,312,19740,880],
  ['Neon Drift Kings','Apex Loop','Apex Loop Studio','sports-racing','Racing','🏎️',196,27600,510000000,1740000,89,16,1040,154,17320,640],
  ['Prison Breakout 3','GraySky','GraySky Games','action','Team Action','🚨',10,24980,880000000,2410000,88,32,960,128,15870,1120],
  ['Anime Fight Arena','SakuraByte','SakuraByte Dev','action','Fighting','⚡',280,23410,1180000000,5200000,94,20,905,268,15220,1340],
  ['Sky Island Survival','Driftwood','Driftwood Interactive','survival','Crafting','🏝️',168,19870,398000000,1310000,90,18,780,142,12440,760],
  ['Mystery Manor Rooms','Lantern Labs','Lantern Labs','puzzle','Horror Puzzle','🕯️',38,18240,624000000,2080000,92,8,720,96,11980,980],
  ['Mega Mall Simulator','Retail Rush','Retail Rush Group','shopping','Shopping Sim','🛒',330,16920,286000000,940000,87,25,655,118,10310,520],
  ['Hoop Legends X','Court Kings','Court Kings Studio','sports-racing','Basketball','🏀',24,15480,344000000,1120000,88,10,610,88,9870,700],
  ['City Life Roleplay','Metro Devs','Metro Worlds','roleplay-avatar','City RP','🚕',204,14760,1640000000,7400000,93,40,585,204,9240,1890],
  ['Zombie Outbreak Z','Redline Studio','Redline','survival','Zombie Survival','🧟',96,13920,452000000,1480000,86,28,540,74,8620,830],
  ['Build a Boat Voyage','Plankworks','Plankworks Dev','adventure','Building','⛵',188,12840,712000000,2340000,91,16,505,132,8140,1240],
  ['Ninja Clash Origins','Shuriken Soft','Shuriken','action','PvP Arena','🥷',256,11960,268000000,880000,85,24,470,66,7480,470],
  ['Bee Garden Tycoon','Honeycomb','Honeycomb Games','simulation','Idle Tycoon','🐝',44,10840,394000000,1620000,92,14,430,102,6910,1080],
  ['Speedrun Infinity','Velocity Devs','Velocity','obby-platformer','Speedrun','💨',186,9720,182000000,610000,84,20,395,58,6240,390],
  ['Dragon Hatch Legends','Emberfall','Emberfall Studio','rpg','Pet RPG','🐲',18,9240,528000000,2140000,90,22,360,124,5870,940],
  ['Word Quest Academy','Chalk & Co','Chalk Studio','education','Learning Game','📚',150,8460,96000000,320000,89,16,325,44,5210,610],
  ['Party Panic Royale','Confetti Club','Confetti','party-casual','Minigames','🎈',312,7980,238000000,790000,86,32,300,86,4980,520],
  ['Tactical Strike Ops','Ironsight','Ironsight Dev','shooter','FPS','🔫',218,7420,316000000,1040000,87,16,275,62,4620,880],
  ['Kingdom Wars Strategy','Bannerline','Bannerline Games','strategy','Base Builder','🏰',36,6840,148000000,520000,88,30,250,48,4180,700],
  ['Chill Hangout Lounge','Sofa Society','Sofa Society','social','Hangout','🛋️',176,6280,204000000,680000,83,50,225,38,3840,1160],
  ['Cinema Night Roblox','Reel Room','Reel Room Media','entertainment','Watch Party','🍿',288,5740,88000000,290000,82,45,200,32,3410,520],
  ['Avatar Studio Pro','Mirror Devs','Mirror Labs','utility-other','Avatar Tool','🪞',206,5120,124000000,410000,86,10,180,28,3060,780],
  ['Escape the Grid','Circuit Lab','Circuit','puzzle','Escape Room','🔓',162,4680,164000000,540000,88,12,160,54,2740,600],
  ['Frostbite Expedition','Polar Peak','Polar Peak Games','survival','Exploration','❄️',200,4210,102000000,340000,85,20,140,26,2380,430],
  ['Retro Arcade Hub','Pixel Pop','Pixel Pop Studio','entertainment','Arcade','👾',274,3860,76000000,250000,84,24,120,22,2050,910],
  ['Farm Kingdom Sim','Green Acre','Green Acre Dev','simulation','Farming','🌾',96,3420,138000000,470000,87,18,100,18,1780,1020]
];

/* Deterministic pseudo-random so charts stay stable between reloads */
function seeded(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const GAMES = RAW.map(([name, creator, group, cat, subgenre, glyph, hue,
                        players, visits, favorites, rating, serverSize,
                        bid, bidToday, clicks, ageDays], i) => {
  const rnd = seeded(name);
  const category = CATEGORIES.find((c) => c.slug === cat);
  return {
    id: slugify(name),
    name, creator, group, glyph, hue,
    genre: category.name,
    categorySlug: cat,
    subgenre,
    desc: `${name} drops you into a fast, replayable ${subgenre.toLowerCase()} built for squads. `
        + `Level up, unlock rare gear and climb the seasonal ladder with friends. `
        + `Updated weekly with new maps, events and limited-time rewards.`,
    players, visits, favorites, rating, serverSize,
    bid, bidToday, clicks,
    ageDays,
    /* Rank movement over the last 14 days (1 = best). Index 13 is today, and it is
       pinned to the game's real all-time rank so the chart, the KPI and the daily
       log can never disagree. */
    history: (() => {
      const out = new Array(14);
      out[13] = i + 1;
      for (let d = 12; d >= 0; d--) {
        const step = Math.round((rnd() - 0.5) * 5);
        out[d] = Math.max(1, Math.min(RAW.length, out[d + 1] + step));
      }
      return out;
    })(),
    outbidCount: Math.floor(rnd() * 40) + 3,
    createdBy: creator
  };
});

/* ---- Rankings ---------------------------------------------------------- */
const byBid       = (a, b) => b.bid - a.bid;
const byBidToday  = (a, b) => b.bidToday - a.bidToday;

function ranked(mode = 'all-time', games = GAMES) {
  const list = [...games].sort(mode === 'today' ? byBidToday : byBid);
  return list.map((g, i) => ({ ...g, rank: i + 1, activeBid: mode === 'today' ? g.bidToday : g.bid }));
}

/* ---- Discovery feeds --------------------------------------------------- */
const FEEDS = {
  trending:    (g) => [...g].sort((a, b) => (b.players / (b.ageDays + 60)) - (a.players / (a.ageDays + 60))),
  'new-games': (g) => [...g].sort((a, b) => a.ageDays - b.ageDays),
  'most-players': (g) => [...g].sort((a, b) => b.players - a.players),
  'most-visited': (g) => [...g].sort((a, b) => b.visits - a.visits),
  rising:      (g) => [...g].sort((a, b) => (b.history[0] - b.history[13]) - (a.history[0] - a.history[13])),
  'highest-bid': (g) => [...g].sort(byBid),
  'most-outbid': (g) => [...g].sort((a, b) => b.outbidCount - a.outbidCount),
  'top-games': (g) => [...g].sort((a, b) => b.favorites - a.favorites)
};

const FILTERS = [
  ['trending', 'Trending', '🔥'], ['new-games', 'New Games', '✨'],
  ['most-players', 'Most Players', '👥'], ['most-visited', 'Most Visited', '📈'],
  ['rising', 'Rising', '🚀'], ['highest-bid', 'Highest Bid', '💎'],
  ['most-outbid', 'Most Outbid', '⚔️'], ['top-games', 'Top Games', '🏆']
];

/* ---- Daily champions --------------------------------------------------- */
const CHAMPIONS = [0, 1, 2, 5].map((idx, i) => {
  const g = GAMES[idx];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (i + 1));
  return {
    game: g,
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    heldBid: Math.round(g.bidToday * (1.1 + i * 0.08)),
    clicks: Math.round(g.clicks * 0.06)
  };
});

/* ---- Live activity templates ------------------------------------------- */
const ACTIVITY_TEMPLATES = [
  { icon: '⚔️', text: (g, amt) => `<b>${g.name}</b> outbid for <span class="amt">$${amt}</span>` },
  { icon: '🚀', text: (g) => `<b>${g.name}</b> climbed to <span class="amt">#${g.rank}</span>` },
  { icon: '🎮', text: (g) => `<b>${g.name}</b> got a new player from BloxBid` },
  { icon: '✨', text: (g) => `<b>${g.name}</b> was listed on BloxBid` },
  { icon: '💎', text: (g, amt) => `<b>${g.name}</b> raised its bid to <span class="amt">$${amt}</span>` }
];

window.BB_DATA = { CATEGORIES, GAMES, FEEDS, FILTERS, CHAMPIONS, ACTIVITY_TEMPLATES, ranked, slugify };
