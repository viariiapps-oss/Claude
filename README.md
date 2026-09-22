# BloxBid.lol

> **Also in this repository:** [`rblx-analytics/`](rblx-analytics/) — **RBLX Analytics**, a full-stack Next.js
> analytics platform for Roblox experiences (players, visits, growth, estimated revenue). See its
> [README](rblx-analytics/README.md) for setup and deployment.

**The leaderboard where Roblox games compete for #1.**
Roblox game discovery + public leaderboards + live bidding + game statistics.

> Rank is what you pay. The higher the bid, the higher the rank.

This repository contains the **2026 white design system and front-end prototype** for
BloxBid.lol — a complete, clickable UI built with zero dependencies and zero build step.

---

## Run it

No install, no bundler:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages) — just serve the folder.

---

## Design language

| Token | Value | Notes |
| --- | --- | --- |
| Background | `#FFFFFF` | White is the product. No dark mode as primary design. |
| Primary | `#0A6CFF` → `#00A2FF` | Roblox-inspired blue: CTAs, links, rank, badges, hover, Outbid |
| Ink | `#0A0B0D` | Text and high-contrast surfaces |
| Grays | `#FAFBFC` → `#6B7480` | Surfaces, borders, muted copy |

Deliberately **no orange** as a brand colour, and no traditional ad chrome anywhere.

The 2026 feel comes from restraint rather than decoration: fluid `clamp()` type, a tight
`-.05em` display tracking, hairline `1px` borders, layered blue-tinted shadows, a glass
sticky navbar, pill controls, soft aurora + masked grid in the hero, and short
`cubic-bezier(.2,.7,.2,1)` micro-interactions. Everything degrades gracefully with
`prefers-reduced-motion`.

### Logo

`assets/logo.svg` — a rounded blue tile holding three ascending blocks with an up arrow:
**Blox** (geometric blocks) + **Bid/Ranking/Up** (the ascending staircase and arrow).
Minimal, scalable to 16px, and intentionally unlike the official Roblox mark.

---

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Hero → Live stats → All-time/Today leaderboard → Trending → Categories → Rising → Most Played + Live activity → Daily Champions → CTA |
| `rankings.html` | Global board — ALL ROBLOX GAMES, ALL-TIME / TODAY, filterable by category |
| `games.html` | Full catalogue with the 8 discovery filters |
| `categories.html` | All 17 official Roblox genres; `?c=<slug>` opens that category's own board |
| `game.html` | Game page: rank, bid, clicks, Roblox stats, rank history, **PLAY ON ROBLOX** |
| `list.html` | Add your game — paste link, link validation, autodetect preview |
| `dashboard.html` | Developer dashboard: rank, bid, clicks, players, visits, who outbid you |
| `daily.html` | Today's board with midnight-UTC countdown + Daily Champions archive |
| `info.html` | Rules, FAQ, Privacy, Terms, Contact |

## Source layout

```
styles/tokens.css      design tokens (colour, type, radii, elevation, motion)
styles/base.css        reset + layout primitives
styles/components.css  navbar, buttons, badges, cards, leaderboard rows, modals, search
styles/pages.css       hero, live stats, categories, game page, dashboard, forms
scripts/data.js        demo dataset (28 games, 17 categories) + ranking functions
scripts/ui.js          shared runtime: chrome, formatters, templates, search, toasts
scripts/app.js         one controller per page
```

---

## Product rules encoded in the UI

These come straight from the brief and are enforced in the prototype, not just drawn:

- **One allowed link.** `list.html` accepts only `roblox.com/games/…`. Discord, YouTube,
  TikTok, X, Instagram, Linktree and custom URLs are rejected with an inline error
  (`scripts/app.js` → `PAGES.list`).
- **Group is never manual.** It renders as read-only and verified, to prevent impersonation.
- **One external destination.** A game page has exactly one outbound button:
  **PLAY ON ROBLOX**. The click is counted *before* redirecting
  (`registerClick()` in `scripts/ui.js`).
- **Rank is bid order.** `ranked()` sorts purely by bid; the Outbid modal previews the exact
  position a given amount buys, with a minimum raise of $5.
- **Daily resets at 00:00 UTC.** Live countdown on the home, rankings and daily pages.
- **Mobile priority Rank → Game → Bid → Players → Clicks**, handled in the `.row-game`
  grid at `≤900px`.

---

## Wiring it to real data

The prototype is deliberately data-shaped so the swap is mechanical:

1. Replace `RAW` in `scripts/data.js` with the Roblox API response
   (name, thumbnail, creator, group, description, genre, subgenre, players, visits,
   favorites, rating, server size).
2. Keep the derived BloxBid fields — `bid`, `bidToday`, `clicks`, `history`, `outbidCount` —
   coming from your own backend.
3. `thumb()` in `scripts/ui.js` currently renders a deterministic gradient placeholder;
   point it at the real Roblox thumbnail URL.
4. Replace the demo click counter (`localStorage`) and the Outbid modal's confirm handler
   with real endpoints.

The demo **Play on Roblox** button links to Roblox search, because the sample games are
fictional. With real data this becomes the experience URL.

---

Not affiliated with, endorsed by or sponsored by Roblox Corporation.
