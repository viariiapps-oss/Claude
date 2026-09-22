"use client";

import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SORT_OPTIONS } from "@/lib/explorer";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["genre", "minPlayers", "maxPlayers", "minVisits", "minRevenue", "minGrowth", "createdAfter", "updatedAfter"] as const;

export function ExplorerFilters({ genres, total }: { genres: string[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(FILTER_KEYS.some((k) => params.get(k)));

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced text search.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the input
  }, [q]);

  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;

  const numberField = (key: (typeof FILTER_KEYS)[number], label: string, placeholder: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        inputMode="numeric"
        min={key === "minGrowth" ? -100 : 0}
        placeholder={placeholder}
        defaultValue={params.get(key) ?? ""}
        onBlur={(e) => update({ [key]: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && update({ [key]: (e.target as HTMLInputElement).value })}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, game ID, creator or group…"
            aria-label="Search games"
            className="h-11 pl-10"
            maxLength={100}
          />
        </div>
        <div className="flex gap-2">
          <Select
            label="Sort by"
            value={params.get("sort") ?? "players"}
            onValueChange={(v) => update({ sort: v })}
            options={SORT_OPTIONS}
            className="h-11 w-full sm:w-60"
          />
          <Button
            variant={open || activeCount ? "secondary" : "outline"}
            className="h-11 shrink-0"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="explorer-filters"
          >
            <SlidersHorizontal />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-bg">{activeCount}</span>}
          </Button>
        </div>
      </div>

      {open && (
        <div id="explorer-filters" className="grid animate-fade-in gap-3 rounded-2xl border border-border bg-card-2/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Genre</Label>
            <Select
              label="Genre"
              value={params.get("genre") ?? "all"}
              onValueChange={(v) => update({ genre: v === "all" ? null : v })}
              options={[{ value: "all", label: "All genres" }, ...genres.map((g) => ({ value: g, label: g }))]}
            />
          </div>
          {numberField("minPlayers", "Min. players", "e.g. 10000")}
          {numberField("maxPlayers", "Max. players", "e.g. 500000")}
          {numberField("minVisits", "Min. visits", "e.g. 1000000000")}
          {numberField("minRevenue", "Min. est. monthly revenue (USD)", "e.g. 100000")}
          {numberField("minGrowth", "Min. growth 7d (%)", "e.g. 5")}
          <div>
            <Label htmlFor="createdAfter">Created after</Label>
            <Input id="createdAfter" type="date" defaultValue={params.get("createdAfter") ?? ""} onChange={(e) => update({ createdAfter: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="updatedAfter">Updated after</Label>
            <Input id="updatedAfter" type="date" defaultValue={params.get("updatedAfter") ?? ""} onChange={(e) => update({ updatedAfter: e.target.value })} />
          </div>
          <div className="flex items-end justify-between gap-2 sm:col-span-2 lg:col-span-4">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Filter className="size-3.5" /> Revenue filters use the midpoint of the monthly estimate.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                startTransition(() => router.replace(pathname, { scroll: false }));
              }}
            >
              <RotateCcw /> Reset
            </Button>
          </div>
        </div>
      )}
      <p className={cn("text-xs text-muted transition-opacity", pending && "opacity-50")} aria-live="polite">
        {pending ? "Updating…" : `${total.toLocaleString("en-US")} game${total === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
