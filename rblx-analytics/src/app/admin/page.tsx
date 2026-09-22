import type { Metadata } from "next";
import { CheckCircle2, CircleSlash, Lock, LogOut, XCircle } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { AddGameForm, GameRowActions, LoginForm, TierButtons } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env, isAdminConfigured } from "@/config/env";
import { isAdmin } from "@/lib/admin-auth";
import { repo } from "@/db";
import { probeCurrencyProviders } from "@/services/currency/currency.service";
import { getDataStatus } from "@/services/data-status";
import { probeRoblox, robloxHealth } from "@/services/roblox/client";
import { formatDateTime, timeAgo } from "@/utils/format";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function StatusRow({ label, ok, detail }: { label: string; ok: boolean | null; detail: string }) {
  const Icon = ok === null ? CircleSlash : ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-fg">
        <Icon className={`size-4 ${ok === null ? "text-subtle" : ok ? "text-success" : "text-danger"}`} aria-hidden />
        {label}
      </span>
      <span className="max-w-[60%] text-right text-xs text-muted">{detail}</span>
    </li>
  );
}

export default async function AdminPage() {
  if (!isAdminConfigured()) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState icon={Lock} title="Admin panel disabled" description="Set ADMIN_PASSWORD (min. 8 characters) and ADMIN_SESSION_SECRET in your environment to enable it." />
      </Card>
    );
  }
  if (!(await isAdmin())) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2"><Lock className="size-4 text-accent" /> Admin sign-in</CardTitle>
            <CardDescription>Restricted area</CardDescription>
          </div>
        </CardHeader>
        <CardContent><LoginForm /></CardContent>
      </Card>
    );
  }

  const r = repo();
  const e = env();
  const [status, roblox, fx, dbOk, games, errors, runs] = await Promise.all([
    getDataStatus(),
    probeRoblox(),
    probeCurrencyProviders(),
    r.ping(),
    r.listGames(),
    r.listApiErrors(25),
    r.listRefreshRuns(15),
  ]);
  const stats = await r.getLatestStats(games.map((g) => g.universeId));
  const health = robloxHealth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Control panel"
        description={`Mode ${status.mode} · serving ${status.activeSource} data · storage ${status.storage}`}
        actions={
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit"><LogOut /> Sign out</Button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>API status</CardTitle><CardDescription>Checked on page load</CardDescription></div></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              <StatusRow label="Roblox public APIs" ok={roblox.ok} detail={roblox.ok ? `${roblox.latencyMs} ms` : roblox.error ?? "Unreachable"} />
              <StatusRow label="Roblox circuit breaker" ok={!health.circuitOpen} detail={health.circuitOpen ? "Open — calls paused for 60s" : `Last success ${timeAgo(health.lastSuccessAt)}`} />
              <StatusRow label="Roblox Open Cloud key" ok={health.apiKeyConfigured ? true : null} detail={health.apiKeyConfigured ? "Configured (reserved for owned-experience analytics)" : "Not configured — not required for public data"} />
              <StatusRow label={`Database (${r.kind})`} ok={dbOk} detail={r.kind === "memory" ? "In-memory — set DATABASE_URL for persistence" : dbOk ? "Connected" : "Connection failed"} />
              {fx.map((p) => (
                <StatusRow key={p.name} label={`FX · ${p.name}`} ok={p.ok} detail={p.ok ? "OK" : p.error ?? "—"} />
              ))}
              <StatusRow label="Cron secret" ok={e.CRON_SECRET ? true : null} detail={e.CRON_SECRET ? "Configured" : "Not set — scheduled refresh endpoint only accepts admin sessions"} />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Refresh jobs</CardTitle><CardDescription>realtime = 5 min · hourly · daily</CardDescription></div></CardHeader>
          <CardContent className="space-y-4">
            <TierButtons />
            {runs.length === 0 ? (
              <p className="text-sm text-muted">No runs recorded yet.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto text-sm">
                {runs.map((run) => (
                  <li key={run.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2">
                      <Badge variant={run.ok ? "success" : run.finishedAt ? "danger" : "default"}>{run.tier}</Badge>
                      <span className="text-muted">{formatDateTime(run.startedAt)}</span>
                    </span>
                    <span className="truncate text-xs text-subtle">{run.error ?? `${run.gamesProcessed} games`}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Tracked games ({games.filter((g) => g.isTracked).length})</CardTitle>
            <CardDescription>{status.activeSource === "demo" ? "Demo mode: the demo catalog is built in; stored games appear here once live data is active." : "Stored in the database; tracked games refresh on schedule."}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddGameForm />
          {games.length === 0 ? (
            <p className="text-sm text-muted">No games stored yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-subtle">
                    <th className="py-2 pr-4 font-medium">Game</th>
                    <th className="py-2 pr-4 font-medium">Place / Universe</th>
                    <th className="py-2 pr-4 font-medium">Tracked</th>
                    <th className="py-2 pr-4 font-medium">Last update</th>
                    <th className="py-2 pr-4 font-medium">Last error</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.universeId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-4 font-medium">{g.name}</td>
                      <td className="tabular py-2 pr-4 text-xs text-muted">{g.placeId} / {g.universeId}</td>
                      <td className="py-2 pr-4">{g.isTracked ? <Badge variant="success">yes</Badge> : <Badge>viewed only</Badge>}</td>
                      <td className="py-2 pr-4 text-xs text-muted">{timeAgo(stats.get(g.universeId)?.fetchedAt ?? g.lastRefreshedAt)}</td>
                      <td className="max-w-[220px] truncate py-2 pr-4 text-xs text-danger">{g.lastError ?? ""}</td>
                      <td className="py-2"><GameRowActions universeId={g.universeId} name={g.name} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Recent API errors</CardTitle><CardDescription>Roblox & exchange-rate providers</CardDescription></div></CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted">No errors recorded.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto text-sm">
              {errors.map((er) => (
                <li key={er.id} className="grid gap-1 py-2 sm:grid-cols-[140px_110px_1fr]">
                  <span className="text-xs text-subtle">{formatDateTime(er.occurredAt)}</span>
                  <span className="text-xs text-muted">{er.service}{er.status ? ` · ${er.status}` : ""}</span>
                  <span className="min-w-0 truncate text-xs text-fg" title={`${er.endpoint} — ${er.message}`}>{er.endpoint} — {er.message}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
