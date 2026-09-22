import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const btn = "inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-sm transition-colors";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-4 py-4">
      <span className="text-xs text-muted">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={cn(btn, "text-fg hover:bg-card-2")}>
            <ChevronLeft className="size-4" /> Prev
          </Link>
        ) : (
          <span className={cn(btn, "text-subtle opacity-50")} aria-disabled>
            <ChevronLeft className="size-4" /> Prev
          </span>
        )}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={cn(btn, "text-fg hover:bg-card-2")}>
            Next <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "text-subtle opacity-50")} aria-disabled>
            Next <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
