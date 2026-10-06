import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Reveal from "./reveal";

const CORE = [
  {
    n: "01",
    title: "Unggah",
    body: "CSV, XLSX, XLS, SAV, atau JSON. Delimiter dan header dideteksi sendiri, lalu muncul sebagai pratinjau sebelum dianalisis.",
  },
  {
    n: "02",
    title: "Tetapkan variabel",
    body: "Tipe data dan peran setiap kolom. Peran inilah yang menentukan metode mana yang sah dijalankan.",
  },
  {
    n: "03",
    title: "Bersihkan",
    body: "15 operasi preprocessing. Setiap operasi menulis versi dataset baru — file asli tidak pernah disentuh.",
  },
  {
    n: "04",
    title: "Analisis dan ekspor",
    body: "Rumus, tabel, effect size, grafik, dan kalimat APA. Diekspor ke enam format, semua membawa result_hash.",
  },
];

/** Empat langkah inti saja; delapan langkah lengkap ada di `/alur`. */
export default function WorkflowCore() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="tnum text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-3">
              Alur kerja
            </p>
            <h2 className="mt-5 max-w-[16ch] text-[1.9rem] font-semibold leading-[1.06] tracking-tight text-ink lg:text-[2.3rem]">
              Dari file mentah ke hasil bertanda tangan.
            </h2>
            <Link
              href="/alur"
              className="pressable ring-accent group mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent hover:text-accent-2"
            >
              Lihat delapan langkah lengkap
              <ArrowUpRight
                size={14}
                strokeWidth={1.5}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </Reveal>

          {/* rail horizontal: noda di atas garis, langkah di bawahnya */}
          <div className="lg:col-span-8 lg:col-start-5">
            <div className="relative grid gap-y-7 sm:grid-cols-2 sm:gap-x-8 xl:grid-cols-4">
              <span
                aria-hidden="true"
                className="absolute left-0 right-0 top-[7px] hidden h-px bg-rule xl:block"
              />
              {CORE.map((s, i) => (
                <Reveal
                  key={s.n}
                  index={i}
                  className="relative border-t border-rule pt-5 xl:border-t-0 xl:pt-9"
                >
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 hidden h-2 w-2 -translate-y-[3px] bg-accent xl:block"
                  />
                  <p className="tnum text-[10.5px] text-ink-4">{s.n}</p>
                  <h3 className="mt-2 text-[15.5px] font-medium tracking-tight text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2.5 max-w-[34ch] text-[13px] leading-[1.7] text-ink-3">
                    {s.body}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
