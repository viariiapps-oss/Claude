import type { Metadata, Viewport } from "next";
import { PREFS_BOOT_SCRIPT } from "@/lib/prefs";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditorX — Descubre las trampas antes de firmar",
  description:
    "Sube tu contrato, factura o presupuesto y recibe en segundos un semáforo de riesgo con las trampas ocultas y qué hacer.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#111215" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
