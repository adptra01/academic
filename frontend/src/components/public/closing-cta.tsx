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
    <section className="relative overflow-hidden">
      <div className="graph-paper graph-paper-fade absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1400px] px-5 py-24 sm:px-8 lg:py-36">
        <div className="grid gap-x-12 gap-y-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <h2 className="max-w-[17ch] text-[2.3rem] font-semibold leading-[1.02] tracking-tighter text-ink sm:text-[3rem] lg:text-[3.6rem]">
                Mulai dari file yang sudah Anda punya.
              </h2>
            </Reveal>
            <Reveal index={1}>
              <p className="mt-7 max-w-[46ch] text-[15.5px] leading-[1.7] text-ink-2">
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
                  className="pressable ring-accent group inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-[14px] font-medium text-paper hover:bg-accent-2"
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
                  className="pressable ring-accent inline-flex items-center gap-2 rounded-md border border-rule-2 px-5 py-3 text-[14px] font-medium text-ink hover:border-ink-4 hover:bg-paper-2"
                >
                  Sudah punya akun
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <Reveal variant="left" index={2}>
              <dl className="divide-y divide-rule border-y border-rule">
                {NEEDS.map((n) => (
                  <div key={n.k} className="flex items-baseline justify-between gap-4 py-4">
                    <dt className="tnum text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4">
                      {n.k}
                    </dt>
                    <dd className="text-right text-[13px] text-ink-2">{n.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[12px] leading-relaxed text-ink-4">
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
