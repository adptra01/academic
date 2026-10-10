import Link from "next/link";

import Wordmark from "./wordmark";

const COLUMNS = [
  {
    title: "Produk",
    links: [
      { label: "Metode", href: "/metode" },
      { label: "Alur kerja", href: "/alur" },
      { label: "Format & operasi", href: "/alur#format" },
      { label: "Reproduksi", href: "/reproduksi" },
    ],
  },
  {
    title: "Akun",
    links: [
      { label: "Masuk", href: "/login" },
      { label: "Buat akun", href: "/register" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-paper-2/60">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Wordmark />
            <p className="mt-5 max-w-[38ch] text-[13px] leading-[1.7] text-ink-3">
              Platform analisis kuantitatif dengan mesin statistik
              deterministik. Setiap analisis dapat direproduksi, setiap asumsi
              diperiksa, dan setiap hasil meninggalkan jejak.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="lg:col-span-2">
              <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4">
                {col.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="ring-accent rounded-sm text-[13px] text-ink-2 transition-colors duration-300 hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="lg:col-span-3">
            <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4">
              Batasan yang disengaja
            </h2>
            <p className="mt-4 text-[12.5px] leading-[1.7] text-ink-3">
              Statistical engine berjalan di Python deterministik. Model bahasa
              tidak menghitung, menafsirkan, atau menuliskan kesimpulan
              penelitian pada versi ini.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="tnum text-[11px] text-ink-4">
            Academic Research Platform — build MVP
          </p>
          <p className="text-[11px] text-ink-4">
            Beta terbatas · engine terverifikasi terhadap R dan SPSS
          </p>
        </div>
      </div>
    </footer>
  );
}
