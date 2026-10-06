import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-plex",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Academic Research Platform — Mesin Statistik Deterministik",
  description:
    "Platform analisis kuantitatif untuk peneliti: 15 metode statistik terverifikasi, deteksi asumsi otomatis, dan setiap analisis dapat direproduksi lewat Analysis ID + result_hash.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${archivo.variable} ${plexMono.variable}`}>
      <head>
        {/* Gate reveal: konten disembunyikan hanya bila JS pasti bisa memunculkannya lagi. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js-reveal')",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
