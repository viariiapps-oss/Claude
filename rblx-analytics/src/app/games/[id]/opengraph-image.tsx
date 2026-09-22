import { ImageResponse } from "next/og";
import { getGameDetail } from "@/services/games.service";
import { formatCompact } from "@/utils/format";
import { parsePositiveId } from "@/utils/ids";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Roblox game statistics on RBLX Analytics";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = parsePositiveId((await params).id);
  const r = id ? await getGameDetail(id).catch(() => null) : null;
  const g = r?.status === "ok" ? r.game : null;
  const stat = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", padding: "20px 28px", borderRadius: 20, background: "#0E1320", border: "1px solid #20283A", marginRight: 20 }}>
      <div style={{ fontSize: 22, color: "#8B97B3" }}>{label}</div>
      <div style={{ fontSize: 48, color: "white", fontWeight: 700 }}>{value}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "linear-gradient(135deg, #070A12 0%, #0b1426 60%, #10223f 100%)", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: "#4DA3FF", fontWeight: 700 }}>RBLX Analytics</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, color: "white", fontWeight: 800, lineHeight: 1.05 }}>{g?.meta.name ?? "Roblox Game Intelligence"}</div>
          <div style={{ fontSize: 30, color: "#8B97B3", marginTop: 12 }}>{g ? `by ${g.meta.creator.name}` : "Players, visits, growth & estimated revenue"}</div>
        </div>
        <div style={{ display: "flex" }}>
          {g ? stat("Players", formatCompact(g.stats.players)) : null}
          {g ? stat("Visits", formatCompact(g.stats.visits)) : null}
          {g ? stat("Favorites", formatCompact(g.stats.favorites)) : null}
        </div>
      </div>
    ),
    size,
  );
}
