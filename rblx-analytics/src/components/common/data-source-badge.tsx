import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { DataSource } from "@/types";

/** 🟢 LIVE DATA / 🟡 DEMO DATA — shown wherever numbers appear. */
export function DataSourceBadge({ source, reason }: { source: DataSource; reason?: string }) {
  const live = source === "live";
  return (
    <Tooltip
      content={
        live
          ? "Fetched from Roblox's public APIs. Revenue figures are still estimates."
          : `Synthetic sample data for demonstration — not real statistics.${reason ? ` ${reason}` : ""}`
      }
    >
      <Badge variant={live ? "success" : "warning"} className="cursor-help uppercase tracking-wide" tabIndex={0}>
        <span className={`size-1.5 rounded-full ${live ? "bg-success animate-pulse-dot" : "bg-warning"}`} aria-hidden />
        {live ? "Live data" : "Demo data"}
      </Badge>
    </Tooltip>
  );
}
