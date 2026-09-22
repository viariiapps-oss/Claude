"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DataSourceBadge } from "@/components/common/data-source-badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import type { DataSource } from "@/types";
import { Logo } from "./logo";
import { SearchCommand, useSearchShortcut } from "./search-command";

export function SiteHeader({ source, reason }: { source: DataSource; reason: string }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useSearchShortcut(setSearchOpen);

  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener("rblx:open-search", open);
    return () => window.removeEventListener("rblx:open-search", open);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(item.href) ? "bg-card-2 text-fg" : "text-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <DataSourceBadge source={source} reason={reason} />
          </div>
          <Button variant="secondary" size="md" onClick={() => setSearchOpen(true)} className="hidden sm:inline-flex">
            <Search />
            Search Game
            <kbd className="ml-1 rounded border border-border px-1 text-[10px] text-muted">⌘K</kbd>
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setSearchOpen(true)} className="sm:hidden" aria-label="Search game">
            <Search />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav aria-label="Mobile" className="animate-fade-in border-t border-border bg-bg/95 px-4 pb-4 pt-2 lg:hidden">
          <div className="mb-2 sm:hidden">
            <DataSourceBadge source={source} reason={reason} />
          </div>
          <ul className="grid grid-cols-2 gap-1">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block rounded-xl px-3 py-2.5 text-sm",
                    isActive(item.href) ? "bg-card-2 text-fg" : "text-muted hover:bg-card-2 hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
