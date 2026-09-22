"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { ConfidenceBadge } from "@/components/common/confidence-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DEFAULT_REVENUE_MODEL } from "@/config/revenue-model";
import type { RevenueEstimate } from "@/types";
import { formatNumber } from "@/utils/format";

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <div>
        <p className="text-sm text-fg">{label}</p>
        {note && <p className="text-xs text-subtle">{note}</p>}
      </div>
      <p className="tabular shrink-0 text-sm font-medium text-fg">{value}</p>
    </div>
  );
}

/** Shows exactly how one estimate was produced. */
export function MethodologyDialog({ estimate, triggerLabel = "View methodology" }: { estimate: RevenueEstimate; triggerLabel?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Info /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent title="How this estimate was calculated" description="Estimated Revenue ≠ Official Revenue" className="max-h-[80vh] max-w-xl overflow-y-auto">
        <div className="space-y-4 px-6 pb-6 pt-4">
          {estimate.status === "insufficient" ? (
            <p className="text-sm text-muted">{estimate.reason}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <ConfidenceBadge confidence={estimate.confidence} />
                <span className="text-xs text-muted">score {estimate.confidenceScore}/100 · model {estimate.modelVersion}</span>
              </div>
              <div className="rounded-xl border border-border bg-card-2/60 p-4 font-mono text-xs leading-relaxed text-muted">
                daily ≈ avg players × 24 h × ${estimate.inputs.baseUsdPerHour}/h × {estimate.inputs.devexAdjustment} (DevEx) × {estimate.inputs.genreFactor} (genre) ×{" "}
                {estimate.inputs.monetizationFactor} (monetization)
              </div>
              <div>
                <Row label="Average concurrent players" value={formatNumber(estimate.inputs.avgPlayers)} note={`Window: ${estimate.inputs.avgPlayersWindow === "current" ? "single current reading" : estimate.inputs.avgPlayersWindow}`} />
                <Row label="Engagement hours / day" value={formatNumber(estimate.inputs.engagementHoursPerDay)} />
                <Row label="Base creator payout per engagement hour" value={`$${estimate.inputs.baseUsdPerHour}`} note={DEFAULT_REVENUE_MODEL.baseSource} />
                <Row label="DevEx rate adjustment" value={`× ${estimate.inputs.devexAdjustment}`} note={DEFAULT_REVENUE_MODEL.devexNote} />
                <Row label={`Genre factor (${estimate.inputs.genre ?? "unknown"})`} value={`× ${estimate.inputs.genreFactor}`} note="Editorial assumption — relative monetization intensity per genre." />
                <Row
                  label="Monetization signal factor"
                  value={`× ${estimate.inputs.monetizationFactor}`}
                  note={estimate.inputs.hasMonetizationSignals ? "From the number of public game passes." : "No public signals collected — neutral factor."}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Confidence factors</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                  {estimate.confidenceReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <p className="text-xs text-subtle">
            This is an estimate of creator earnings (USD at the DevEx rate), not the developer&apos;s actual income and not Roblox&apos;s revenue.{" "}
            <Link href="/about#methodology" className="text-accent hover:underline">Full methodology</Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
