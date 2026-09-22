import { Scale } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_REVENUE_MODEL } from "@/config/revenue-model";

/** "How we estimate revenue" explainer (server component). */
export function MethodologySection({ id = "methodology" }: { id?: string }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Methodology</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">How we estimate revenue</h2>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm font-medium text-warning">
            <Scale className="size-4" aria-hidden /> Estimated Revenue ≠ Official Revenue
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Roblox does not publish earnings for individual experiences. Every revenue figure on RBLX Analytics is a model estimate built from
            public engagement data and explicit, versioned assumptions. We show ranges and a confidence level — never a single &quot;exact&quot; number —
            and we show <em>&quot;Insufficient data to estimate revenue&quot;</em> instead of guessing when inputs are missing.
          </p>
        </div>
        <ol className="space-y-4 text-sm">
          {[
            ["Engagement", "Average concurrent players (7-day window when available) × 24 gives engagement hours per day. Player counts come from Roblox's public games API."],
            ["Platform anchor", DEFAULT_REVENUE_MODEL.baseSource],
            ["DevEx rate", DEFAULT_REVENUE_MODEL.devexNote],
            ["Genre & monetization signals", "Editorial genre factors plus public signals such as the number of game passes nudge the platform average up or down. Developer products, Premium Payouts, ads and private deals are not publicly observable."],
            ["Range & confidence", "Range width depends on data confidence (history coverage, averaging window, available signals, sample size). Low confidence → wider range."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-card-2 text-xs text-muted">{i + 1}</span>
              <div>
                <p className="font-medium text-fg">{title}</p>
                <p className="mt-0.5 text-muted">{body}</p>
              </div>
            </li>
          ))}
          <li className="pl-9 text-xs text-subtle">
            Tune every assumption yourself in the <Link href="/revenue#estimator" className="text-accent hover:underline">Revenue Estimator</Link>.
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
