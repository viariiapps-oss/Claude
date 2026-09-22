/* eslint-disable @next/next/no-img-element -- Roblox CDN images are already sized; next/image would re-proxy them */
import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-[#1e3a8a] to-[#4da3ff]",
  "from-[#4c1d95] to-[#a78bfa]",
  "from-[#064e3b] to-[#34d399]",
  "from-[#7c2d12] to-[#fb923c]",
  "from-[#831843] to-[#f472b6]",
  "from-[#134e4a] to-[#2dd4bf]",
];

/** Game icon from the Roblox thumbnails API, or a deterministic monogram fallback. */
export function GameIcon({ name, url, size = 40, className }: { name: string; url: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={style}
        className={cn("shrink-0 rounded-xl border border-border object-cover", className)}
      />
    );
  }
  const code = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br font-semibold text-white/90",
        GRADIENTS[code % GRADIENTS.length],
        className,
      )}
    >
      <span style={{ fontSize: Math.max(10, size * 0.34) }}>{initials || "?"}</span>
    </div>
  );
}
