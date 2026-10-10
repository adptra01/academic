import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { AVAILABLE_METHODS, FAMILY_LABEL, FAMILY_ORDER, METHODS } from "@/lib/methods";
import Reveal from "./reveal";

const GROUPED = FAMILY_ORDER.map((family) => ({
  family,
  items: METHODS.filter((m) => m.family === family),
}));

const PHASE_2 = METHODS.length - AVAILABLE_METHODS.length;

/**
 * Pratinjau katalog: nama metode saja, tanpa baris asumsi. Rinciannya ada di
 * `/metode`. Welcome page sengaja dibuat ringkas, bukan memuat semuanya.
 */
export default function MethodsSummary() {
  return (
    <section className="bg-paper-2">
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
              Metode
            </p>
            <h2 className="mt-5 max-w-[17ch] text-[2.15rem] font-bold leading-[1.02] tracking-[-0.035em] text-ink lg:text-[2.55rem]">
              Tujuh kelompok, masing-masing dengan syaratnya sendiri.
            </h2>
            <p className="mt-5 max-w-[38ch] text-[14px] leading-[1.7] text-ink-2">
              Metode hanya dibuka kalau tipe data dan peran variabelnya cocok.
              Asumsi yang tidak terpenuhi ditandai, bukan disembunyikan.
            </p>
            <Link
              href="/metode"
              className="pressable ring-accent group mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-primary hover:text-primary"
            >
              Lihat katalog lengkap
              <ArrowUpRight
                size={14}
                strokeWidth={1.5}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </Reveal>

          <div className="lg:col-span-8 lg:col-start-5">
            <div className="border-t border-rule">
              {GROUPED.map((g, gi) => (
                <Reveal
                  key={g.family}
                  index={gi}
                  className="grid gap-x-8 gap-y-2.5 border-b border-rule py-6 md:grid-cols-[13rem_minmax(0,1fr)]"
                >
                  <div className="flex items-baseline gap-2.5">
                    <h3 className="text-[12.5px] font-medium leading-snug text-ink">
                      {FAMILY_LABEL[g.family]}
                    </h3>
                    <span className="tnum shrink-0 text-[10px] text-ink-4">
                      {g.items.length}
                    </span>
                  </div>
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {g.items.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/metode#${m.id}`}
                          className={`ring-accent group inline-flex items-baseline gap-1.5 rounded-sm text-[13px] transition-colors duration-300 hover:text-primary ${
                            m.family === "fase-2" ? "text-ink-4" : "text-ink-2"
                          }`}
                        >
                          <span className="tnum text-[10.5px] text-ink-4 transition-colors duration-300 group-hover:text-primary">
                            {m.id}
                          </span>
                          <span className="whitespace-nowrap">{m.short}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-ink-4">
              <span className="tnum">{AVAILABLE_METHODS.length}</span> metode tersedia
              sekarang. <span className="tnum">{PHASE_2}</span> metode lain sedang
              dikerjakan dan ditandai jelas sebagai fase 2.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
