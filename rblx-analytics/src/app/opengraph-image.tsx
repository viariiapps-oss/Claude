import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "RBLX Analytics — Roblox Game Intelligence";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #070A12 0%, #0b1426 60%, #10223f 100%)", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 32, color: "#4DA3FF", fontWeight: 700 }}>RBLX Analytics</div>
        <div style={{ fontSize: 84, color: "white", fontWeight: 800, marginTop: 16 }}>Roblox Game Intelligence</div>
        <div style={{ fontSize: 32, color: "#8B97B3", marginTop: 20 }}>Players, visits, growth and estimated revenue across Roblox experiences.</div>
      </div>
    ),
    size,
  );
}
