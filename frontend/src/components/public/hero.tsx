import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AnalysisReceipt from "./analysis-receipt";
import Reveal from "./reveal";

const PROOF = [
  { k: "15", v: "metode statistik" },
  { k: "5", v: "format input" },
  { k: "6", v: "format export" },
  { k: "13", v: "tipe grafik" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="dot-grid dot-grid-fade absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1400px] px-5 pb-20 pt-14 sm:px-8 lg:pb-28 lg:pt-20">
        <div className="grid items-center gap-y-14 lg:grid-cols-12 lg:gap-x-10">
          {/* ---- kiri: narasi ---- */}
          <div className="lg:col-span-7">
            <Reveal>
              <p className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
                  Platform analisis kuantitatif
                </span>
              </p>
            </Reveal>

            <Reveal index={1}>
              <h1 className="mt-7 max-w-[20ch] text-[2.6rem] font-bold leading-[0.98] tracking-[-0.04em] text-ink sm:text-[3.35rem] lg:text-[3.75rem]">
                Hasil statistik yang dapat{" "}
                <span className="relative inline-block whitespace-nowrap">
                  diulang persis sama
                  <svg
                    viewBox="0 0 300 10"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="absolute -bottom-1.5 left-0 h-2 w-full text-primary"
                  >
                    <path
                      d="M3 6.6C62 2.9 172 2.2 297 5.2"
                      pathLength="1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="animate-trace"
                    />
                  </svg>
                </span>{" "}
                oleh siapa pun.
              </h1>
            </Reveal>

            <Reveal index={2}>
              <p className="mt-8 max-w-[54ch] text-[16.5px] leading-[1.65] text-ink-2">
                Unggah CSV atau XLSX, tetapkan peran setiap variabel, lalu jalankan
                analisis yang syarat asumsinya diperiksa lebih dulu. Setiap hasil
                membawa{" "}
                <span className="tnum text-[15px] text-ink">Analysis&nbsp;ID</span>, log
                yang tidak dapat diubah, dan{" "}
                <span className="tnum text-[15px] text-ink">result_hash</span> sebagai
                cap integritas.
              </p>
            </Reveal>

            <Reveal index={3}>
              <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-3">
                <Link
                  href="/register"
                  className="pressable ring-accent group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90"
                >
                  Mulai analisis
                  <ArrowRight
                    size={15}
                    strokeWidth={1.5}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </Link>
                <a
                  href="/metode"
                  className="pressable ring-accent inline-flex items-center gap-2 rounded-full border border-rule-2 px-7 py-3.5 text-[15px] font-medium text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-4 hover:bg-paper-2"
                >
                  Lihat 15 metode
                </a>
              </div>
            </Reveal>

            {/* catatan integritas: pembeda yang paling jujur */}
            <Reveal index={4}>
              <p className="mt-7 flex max-w-[46ch] gap-3 border-l-2 border-primary pl-3.5 text-[13px] leading-relaxed text-ink-3">
                <span className="shrink-0 pt-[3px]">
                  <span className="block h-1.5 w-1.5 bg-primary" aria-hidden="true" />
                </span>
                <span>
                  Tidak ada model bahasa yang menyentuh angka. Seluruh statistik
                  dihitung engine Python deterministik yang lulus uji pembanding
                  R dan SPSS.
                </span>
              </p>
            </Reveal>
          </div>

          {/* ---- kanan: record analisis ---- */}
          <div className="lg:col-span-5 xl:pl-4">
            <Reveal variant="scale" index={2}>
              <AnalysisReceipt />
            </Reveal>
          </div>
        </div>

        {/* strip bukti — angka nyata dari kode, bukan placeholder */}
        <Reveal index={5}>
          <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:mt-20 lg:grid-cols-4">
            {PROOF.map((p) => (
              <div key={p.v} className="bg-paper px-5 py-6">
                <dt className="tnum text-[1.75rem] font-semibold leading-none tracking-tight text-ink">
                  {p.k}
                </dt>
                <dd className="mt-2 text-[12.5px] leading-tight text-ink-3">{p.v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
