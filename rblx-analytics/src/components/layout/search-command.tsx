"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GameIcon } from "@/components/common/game-icon";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import type { DataSource, SearchResult } from "@/types";
import { formatCompact } from "@/utils/format";

async function search(q: string): Promise<{ results: SearchResult[]; source: DataSource }> {
  const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}&limit=8`);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Search failed");
  return res.json();
}

export function useGameSearch(query: string) {
  const q = useDebounce(query.trim(), 250);
  return useQuery({ queryKey: ["search", q], queryFn: () => search(q), enabled: q.length >= 1, staleTime: 30_000 });
}

const MATCH_LABEL: Record<SearchResult["matchedBy"], string> = {
  name: "Name",
  id: "Game ID",
  url: "Roblox URL",
  creator: "Creator",
  "roblox-search": "Roblox search",
};

/** Global ⌘K / Ctrl+K game search. */
export function SearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const { data, isFetching, isError, error } = useGameSearch(query);
  const results = data?.results ?? [];
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (r: SearchResult) => {
    onOpenChange(false);
    setQuery("");
    router.push(`/games/${r.placeId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Search games" description="Search by name, creator, game ID or roblox.com URL" hideClose className="max-w-xl overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 text-muted" aria-hidden />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active]);
              }
            }}
            placeholder="Search any Roblox game…"
            aria-label="Search any Roblox game"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            className="h-14 flex-1 bg-transparent text-base text-fg placeholder:text-subtle focus:outline-none"
            maxLength={200}
          />
          {isFetching && <Loader2 className="size-4 animate-spin text-muted" aria-label="Searching" />}
          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted sm:block">ESC</kbd>
        </div>
        <ul id="search-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {query.trim() === "" && (
            <li className="px-3 py-8 text-center text-sm text-muted">
              Try <span className="text-fg">Grow a Garden</span>, a creator name, a game ID like <span className="text-fg">920587237</span>, or paste a roblox.com link.
            </li>
          )}
          {isError && <li className="px-3 py-6 text-center text-sm text-danger">{(error as Error).message}</li>}
          {query.trim() !== "" && !isFetching && !isError && results.length === 0 && data && (
            <li className="px-3 py-8 text-center text-sm text-muted">
              No games found{data.source === "demo" ? " in the demo dataset" : ""}.
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.placeId} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === active ? "bg-accent-soft" : "hover:bg-card-2"}`}
              >
                <GameIcon name={r.name} url={r.iconUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{r.name}</p>
                  <p className="truncate text-xs text-muted">
                    {r.creatorName ?? "Unknown creator"} · ID {r.placeId}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="tabular inline-flex items-center gap-1 text-xs text-fg">
                    <Users className="size-3 text-muted" aria-hidden />
                    {formatCompact(r.players)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-subtle">{MATCH_LABEL[r.matchedBy]}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Registers the ⌘K / Ctrl+K shortcut. */
export function useSearchShortcut(setOpen: (o: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
