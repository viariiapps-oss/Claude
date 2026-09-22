import type { Metadata } from "next";
import { Search, Users } from "lucide-react";
import Link from "next/link";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { DevelopersTable } from "@/components/developers/developers-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listDevelopers } from "@/services/developers.service";

export const metadata: Metadata = {
  title: "Roblox Developers & Groups",
  description: "Roblox creators and groups ranked by players, visits and estimated revenue across their experiences.",
};

export default async function DevelopersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const { developers, source } = await listDevelopers(q);
  const numeric = /^\d{1,20}$/.test(q.trim()) ? q.trim() : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Developers"
        title="Developers & groups"
        description="Creators of tracked experiences with aggregated players, visits and estimated revenue. Search by name, or enter a Roblox group/user ID."
        actions={<DataSourceBadge source={source} />}
      />
      <form className="flex gap-2" role="search" action="/developers">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Search developer, group name or ID…" aria-label="Search developers" className="h-11 pl-10" maxLength={100} />
        </div>
        <Button type="submit" className="h-11">Search</Button>
      </form>
      {numeric && source === "live" && (
        <p className="text-sm text-muted">
          Look up ID {numeric} directly:{" "}
          <Link className="text-accent hover:underline" href={`/developers/group-${numeric}`}>as a group</Link> ·{" "}
          <Link className="text-accent hover:underline" href={`/developers/user-${numeric}`}>as a user</Link>
        </p>
      )}
      <Card className="overflow-hidden">
        {developers.length === 0 ? (
          <EmptyState icon={Users} title="No developers found" description={q ? `Nothing matches “${q}” among creators of tracked games.` : "No tracked games yet."} />
        ) : (
          <DevelopersTable developers={developers} />
        )}
      </Card>
    </div>
  );
}
