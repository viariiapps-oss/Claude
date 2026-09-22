import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "animate-shimmer rounded-lg bg-[linear-gradient(90deg,#121827_0px,#1a2236_160px,#121827_320px)] bg-[length:800px_100%]",
        className,
      )}
    />
  );
}
