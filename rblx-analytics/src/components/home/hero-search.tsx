"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GameIcon } from "@/components/common/game-icon";
import { useGameSearch } from "@/components/layout/search-command";
import { Button } from "@/components/ui/button";
import { formatCompact } from "@/utils/format";

const EXAMPLES = ["Grow a Garden", "Blox Fruits", "Brookhaven", "Adopt Me!"];

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { data, isFetching } = useGameSearch(query);
  const results = data?.results.slice(0, 6) ?? [];

  async function submit(q: string) {
    const term = q.trim();
    if (!term) {
      toast.info("Type a game name, creator or Roblox game ID");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(term)}&limit=1`);
      const json = (await res.json()) as { results?: { placeId: number }[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Search failed");
      const first = json.results?.[0];
      if (first) router.push(`/games/${first.placeId}`);
      else {
        toast.warning(`No game found for “${term}”`, { description: "Showing the explorer with your query instead." });
        router.push(`/games?q=${encodeURIComponent(term)}`);
      }
    } catch (e) {
      toast.error("Search failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(query);
        }}
        className="group relative flex items-center rounded-2xl border border-border-strong bg-card/90 p-2 shadow-[0_20px_60px_-20px_rgb(77_163_255/0.35)] backdrop-blur transition-all focus-within:border-accent/60 focus-within:shadow-[0_20px_60px_-15px_rgb(77_163_255/0.5)]"
      >
        <Search className="ml-3 size-5 shrink-0 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search any Roblox game…"
          aria-label="Search any Roblox game"
          maxLength={200}
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base text-fg placeholder:text-subtle focus:outline-none sm:text-lg"
        />
        {isFetching && <Loader2 className="mr-2 size-4 animate-spin text-muted" aria-hidden />}
        <Button type="submit" size="lg" disabled={submitting} className="h-12 rounded-xl px-5">
          {submitting ? <Loader2 className="animate-spin" /> : "Search"}
        </Button>
      </form>

      {focused && query.trim() && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-2 animate-fade-in overflow-hidden rounded-2xl border border-border bg-card-2/95 p-1.5 text-left shadow-2xl backdrop-blur">
          {results.map((r) => (
            <li key={r.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => router.push(`/games/${r.placeId}`)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-accent-soft"
              >
                <GameIcon name={r.name} url={r.iconUrl} size={32} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                  <span className="block truncate text-xs text-muted">{r.creatorName}</span>
                </span>
                <span className="tabular text-xs text-muted">{formatCompact(r.players)} playing</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQuery(ex);
              void submit(ex);
            }}
            className="rounded-full border border-border bg-card-2/60 px-3 py-1 text-muted transition-colors hover:border-accent/40 hover:text-fg"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
