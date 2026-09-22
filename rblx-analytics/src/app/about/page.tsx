import type { Metadata } from "next";
import { CheckCircle2, CircleSlash, Mail } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { MethodologySection } from "@/components/revenue/methodology-section";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: "What RBLX Analytics is, where the data comes from, how revenue is estimated, limitations and privacy.",
};

const AVAILABLE: [string, string][] = [
  ["Concurrent players, visits, favorites", "games.roblox.com/v1/games?universeIds=…"],
  ["Likes / dislikes", "games.roblox.com/v1/games/votes?universeIds=…"],
  ["Name, creator, genre, created/updated dates, server size", "games.roblox.com/v1/games"],
  ["Place ID → universe ID", "apis.roblox.com/universes/v1/places/{placeId}/universe"],
  ["Icons & thumbnails", "thumbnails.roblox.com/v1/games/icons · /v1/games/multiget/thumbnails"],
  ["Public game passes (monetization signal)", "apis.roblox.com/game-passes/v1/universes/{universeId}/game-passes"],
  ["Group / user profiles", "groups.roblox.com/v1/groups/{id} · users.roblox.com/v1/users/{id}"],
  ["A creator's public games", "games.roblox.com/v2/groups/{id}/games · /v2/users/{id}/games"],
  ["Name search (optional, undocumented)", "apis.roblox.com/search-api/omni-search — used by roblox.com itself; can change without notice"],
  ["Exchange rates", "Frankfurter (ECB reference rates), open.er-api.com, or ExchangeRate-API with a key"],
];

const UNAVAILABLE: [string, string][] = [
  ["Actual revenue / Robux earned per experience", "Only visible to the owner in Creator Hub analytics. No public API exists — we estimate instead."],
  ["Historical player counts before we started tracking", "Roblox exposes only the current value. History starts when a game is added to tracking."],
  ["All-time peak players", "Not published. We show the peak within our stored history and say so."],
  ["DAU, retention, session length, payer conversion", "Creator-only analytics (Open Cloud / Creator Hub) for experiences you own."],
  ["Game-pass and developer-product sales volumes", "Prices are public, sales counts are not."],
  ["Premium Payouts, ads revenue, brand deals", "Not publicly observable."],
];

const ENDPOINTS: [string, string][] = [
  ["GET /api/games", "Tracked games · filters: q, genre, minPlayers, maxPlayers, minVisits, minRevenue, minGrowth, createdAfter, updatedAfter, sort, dir, page, pageSize"],
  ["GET /api/games/{placeId}", "Full detail: metadata, stats, growth, peak, monetization signals, revenue estimate"],
  ["GET /api/games/{placeId}/stats", "Current counters, like ratio, growth, peak"],
  ["GET /api/games/{placeId}/history?range=24h|7d|30d|90d|1y", "Bucketed time series (players avg; visits/favorites/likes at bucket end)"],
  ["GET /api/games/search?q=", "Name, creator, place/universe ID or roblox.com URL"],
  ["GET /api/trending?ranking=", "trending · most-played · most-visited · fastest-growing · highest-revenue"],
  ["GET /api/revenue[?ids=]", "Revenue estimates + the model configuration"],
  ["GET /api/currency[?amount=&from=&to=]", "USD-based exchange rates and optional conversion"],
  ["GET /api/developers[?q=] · /api/developers/{group-ID|user-ID}", "Creators with aggregates; profile + games"],
  ["GET /api/health", "Liveness and active data source"],
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="min-w-0 scroll-mt-24">
      <CardContent>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6">
      <PageHeader eyebrow="About" title="About RBLX Analytics" description={siteConfig.description} />

      <Section id="what" title="What is RBLX Analytics?">
        <p>
          RBLX Analytics is an independent analytics platform for Roblox experiences. It tracks public player counts, visits, favorites and votes over
          time, turns them into growth metrics and rankings, and produces clearly labelled <strong className="text-fg">revenue estimates</strong>.
        </p>
        <p>It is not affiliated with, endorsed by or sponsored by Roblox Corporation.</p>
      </Section>

      <Section id="how" title="How it works">
        <p>
          A scheduled job refreshes every tracked experience every 5 minutes (players, visits, favorites, votes), hourly (thumbnails and revenue
          estimates) and daily (monetization signals, exchange rates, history compaction). Each refresh stores a snapshot in PostgreSQL, which powers
          the historical charts. Requests to Roblox are batched (up to 50 games per call), cached, rate-limited and protected by a circuit breaker.
        </p>
      </Section>

      <Section id="data" title="Where the data comes from">
        <p>Only public, unauthenticated Roblox web APIs are used. Nothing is scraped from pages and no endpoint is invented.</p>
        <ul className="space-y-2">
          {AVAILABLE.map(([what, src]) => (
            <li key={what} className="flex gap-2.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span><span className="text-fg">{what}</span> — <code className="text-xs text-subtle [overflow-wrap:anywhere]">{src}</code></span>
            </li>
          ))}
        </ul>
        <p className="pt-2 font-medium text-fg">Not publicly available (shown as “Data unavailable” or estimated):</p>
        <ul className="space-y-2">
          {UNAVAILABLE.map(([what, why]) => (
            <li key={what} className="flex gap-2.5">
              <CircleSlash className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
              <span><span className="text-fg">{what}</span> — {why}</span>
            </li>
          ))}
        </ul>
        <p className="pt-2">
          <strong className="text-fg">🟢 LIVE DATA vs 🟡 DEMO DATA.</strong> When Roblox&apos;s APIs are unreachable (or demo mode is forced), the app shows a
          synthetic demo dataset so every feature can be explored. Demo numbers are generated, not real, and are always labelled.
        </p>
      </Section>

      <MethodologySection />

      <Section id="limitations" title="Limitations">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Revenue estimates can be off by a large factor for individual games; monetization design varies enormously.</li>
          <li>History only exists from the moment a game is tracked; gaps appear if the refresh job did not run.</li>
          <li>Growth metrics require at least 48 hours (24h growth) or 14 days (7d growth) of history.</li>
          <li>Totals cover tracked experiences only, not the whole Roblox platform.</li>
          <li>Roblox may change or rate-limit its public APIs at any time.</li>
        </ul>
      </Section>

      <Section id="api" title="Public API">
        <p>All endpoints return JSON, are rate-limited per IP and support CORS for GET requests. Full documentation lives in <code>docs/API.md</code>.</p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <tbody>
              {ENDPOINTS.map(([ep, desc]) => (
                <tr key={ep} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-fg">{ep}</td>
                  <td className="px-3 py-2">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="privacy" title="Privacy policy">
        <p>
          We collect no personal data from visitors: there are no accounts, no advertising trackers and no third-party analytics. Your currency
          preference is stored only in your browser (localStorage). Server logs may briefly contain IP addresses for rate limiting and abuse
          prevention; they are not sold or shared.
        </p>
        <p>
          The data we display is public information about Roblox experiences and their creators (names, public counters). Creators who want an
          experience removed from tracking can contact us.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p className="flex items-center gap-2">
          <Mail className="size-4 text-accent" aria-hidden />
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent hover:underline">{siteConfig.contactEmail}</a>
        </p>
      </Section>
    </div>
  );
}
