import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tilted-square mark (a nod to Roblox's logo) framing three rising bars. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="rblx-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cc0ff" />
          <stop offset="1" stopColor="#2f7fe0" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="22" height="22" rx="5" transform="rotate(-12 16 16)" fill="url(#rblx-g)" />
      <rect x="10.5" y="17" width="2.8" height="5" rx="1" fill="#04111f" />
      <rect x="14.6" y="13.5" width="2.8" height="8.5" rx="1" fill="#04111f" />
      <rect x="18.7" y="10" width="2.8" height="12" rx="1" fill="#04111f" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="RBLX Analytics home">
      <LogoMark className="transition-transform duration-300 group-hover:rotate-6" />
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        RBLX <span className="text-muted font-medium">Analytics</span>
      </span>
    </Link>
  );
}
