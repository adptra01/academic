import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "./reveal";

const NEEDS = [
  { k: "Akun", v: "email institutional" },
  { k: "Data", v: "satu file CSV atau XLSX" },
  { k: "Waktu", v: "sekitar 2 menit" },
];

export default function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-brand text-brand-foreground">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-[1400px] px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-x-12 gap-y-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-brand-foreground/60">
                Mulai
              </p>
              <h2 className="mt-5 max-w-[17ch] text-[2.35rem] font-bold leading-[1.0] tracking-[-0.035em] text-brand-foreground sm:text-[3rem] lg:text-[3.5rem]">
                Mulai dari file yang sudah Anda punya.
              </h2>
            </Reveal>
            <Reveal index={1}>
              <p className="mt-7 max-w-[46ch] text-[15.5px] leading-[1.7] text-brand-foreground/75">
                Tidak perlu installer, tidak perlu menulis pipeline sendiri.
                Unggah data, tentukan variabel, jalankan metode, dan simpan
                hasilnya dengan Analysis ID. Kalau nanti perlu diulang,
                strukturnya sama persis.
              </p>
            </Reveal>
            <Reveal index={2}>
              <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-3">
                <Link
                  href="/register"
                  className="pressable ring-accent group inline-flex items-center gap-2 rounded-full bg-brand-foreground px-7 py-3.5 text-[15px] font-semibold text-brand transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-foreground/90"
                >
                  Buat project pertama
                  <ArrowRight
                    size={15}
                    strokeWidth={1.5}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/login"
                  className="pressable ring-accent inline-flex items-center gap-2 rounded-full border border-brand-foreground/35 px-7 py-3.5 text-[15px] font-medium text-brand-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-foreground/10"
                >
                  Sudah punya akun
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <Reveal variant="left" index={2}>
              <dl className="divide-y divide-brand-foreground/20 border-y border-brand-foreground/20">
                {NEEDS.map((n) => (
                  <div key={n.k} className="flex items-baseline justify-between gap-4 py-4">
                    <dt className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-brand-foreground/55">
                      {n.k}
                    </dt>
                    <dd className="text-right text-[13px] text-brand-foreground/90">{n.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[12px] leading-relaxed text-brand-foreground/55">
                Beta terbuka untuk 20–50 peneliti pertama. Validasi lintas R dan
                SPSS masih berjalan.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
