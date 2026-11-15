import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditorX — Descubre las trampas antes de firmar",
  description:
    "Sube tu contrato, factura o presupuesto y recibe en segundos un semáforo de riesgo con las trampas ocultas y qué hacer.",
};

export const viewport: Viewport = { themeColor: "#f6f4ee" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
