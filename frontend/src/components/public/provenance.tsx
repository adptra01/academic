import Reveal from "./reveal";

/** Baris log — sesuai urutan yang benar-benar ditulis engine. */
const LOG = [
  { t: "09:41:07.284", event: "analysis.started", detail: "uid=an_7f3c1a9e4b2 method=ttest_ind" },
  { t: "09:41:07.291", event: "dataset.resolved", detail: "version=v3 rows=120 cols=9" },
  { t: "09:41:07.298", event: "assumptions.checked", detail: "shapiro p=.437 levene p=.031 → WARN" },
  { t: "09:41:07.342", event: "test.computed", detail: "t=2.1471 p=.0372 df=38" },
  { t: "09:41:07.351", event: "effect_size.computed", detail: "cohen_d=0.6847 ci95=[.325,.987]" },
  { t: "09:41:07.360", event: "result.sealed", detail: "sha256:4f9c1a7b…a3c5" },
];

const GUARANTEES = [
  {
    title: "Dataset asli tidak pernah berubah",
    body: "Setiap preprocessing menulis versi baru. Versi lama tetap bisa diunduh dan dibandingkan lewat diff kolom, baris, dan drift.",
  },
  {
    title: "Log bersifat immutable",
    body: "Tidak ada analisis yang bisa disunting setelah dijalankan. Koreksi dilakukan dengan analyses baru, bukan dengan menghapus riwayat.",
  },
  {
    title: "result_hash sebagai cap integritas",
    body: "Hash dihitung dari input dan keluaran. Hash yang berbeda berarti input yang berbeda — perbedaannya bisa ditelusuri, bukan diasumsikan.",
  },
  {
    title: "Interpretasi dibangkitkan dari template",
    body: "Kalimat kesimpulan mengikuti template berbahasa Indonesia yang disetujui metodolog. Tidak ada LLM yang menyusun kesimpulan.",
  },
];

export default function Provenance() {
  return (
    <section id="reproduksi" className="scroll-mt-24 bg-strong text-strong-foreground">
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-x-12 gap-y-14 lg:grid-cols-12">
          {/* narasi */}
          <div className="lg:col-span-5">
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-strong-accent">
                Jaminan
              </p>
              <p className="mt-5 max-w-[42ch] text-[15.5px] leading-[1.7] text-strong-foreground/80">
                Kebanyakan alat analisis berhenti di angka. Yang menentukan
                apakah hasil bisa dipercaya adalah apa yang terjadi setelah
                tombol ditekan: apakah ada yang menyimpan dari mana angka itu
                datang.
              </p>
            </Reveal>

            <dl className="mt-11 space-y-0">
              {GUARANTEES.map((g, i) => (
                <Reveal
                  key={g.title}
                  index={i + 1}
                  className="group border-t border-strong-foreground/10 py-6 transition-colors duration-500 hover:border-strong-accent/50"
                >
                  <dt className="flex items-baseline gap-3">
                    <span className="tnum shrink-0 text-[10.5px] text-strong-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15px] font-medium leading-snug tracking-[-0.02em] text-strong-foreground">
                      {g.title}
                    </span>
                  </dt>
                  <dd className="mt-2.5 max-w-[44ch] pl-7 text-[13.5px] leading-[1.7] text-strong-foreground/55">
                    {g.body}
                  </dd>
                </Reveal>
              ))}
            </dl>
          </div>

          {/* panel log — sticky supaya tetap terlihat saat daftar jaminan digulir */}
          <div className="lg:col-span-6 lg:col-start-7 lg:sticky lg:top-28 lg:self-start">
            <Reveal variant="left" index={1}>
              <div className="overflow-hidden rounded-xl border border-strong-foreground/10 bg-strong-foreground/[0.04]">
                <div className="flex items-center justify-between gap-3 border-b border-strong-foreground/10 px-4 py-2.5">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-strong-foreground/45">
                    research log
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-strong-accent" aria-hidden="true" />
                    <span className="font-mono text-[10px] text-strong-foreground/45">live</span>
                  </span>
                </div>

                <ol className="divide-y divide-strong-foreground/10">
                  {LOG.map((l, i) => (
                    <li
                      key={l.event}
                      className="rise grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 px-4 py-3"
                      style={{ "--i": i + 1 } as React.CSSProperties}
                    >
                      <span className="tnum whitespace-nowrap text-[11px] text-strong-foreground/35">
                        {l.t}
                      </span>
                      <span className="min-w-0">
                        <span className="tnum block text-[12px] text-strong-accent">
                          {l.event}
                        </span>
                        <span className="tnum mt-0.5 block truncate text-[11.5px] text-strong-foreground/45">
                          {l.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                  <li className="px-4 py-3">
                    <span className="font-mono caret text-[11.5px] text-strong-foreground/35">
                      menunggu analisis berikutnya
                    </span>
                  </li>
                </ol>

                <div className="flex items-center justify-between gap-3 border-t border-strong-foreground/10 px-4 py-2.5">
                  <span className="font-mono text-[10px] text-strong-foreground/35">immutable</span>
                  <span className="h-2.5 w-16 rounded-full bg-strong-accent/60" aria-hidden="true" />
                </div>
              </div>
            </Reveal>

            <Reveal variant="left" index={2}>
              <p className="mt-5 max-w-[46ch] text-[12.5px] leading-[1.7] text-strong-foreground/45">
                Toleransi yang berlaku{" "}
                <span className="tnum text-strong-foreground/70">1e-6</span> untuk statistik dan{" "}
                <span className="tnum text-strong-foreground/70">1e-4</span> untuk effect size.
                Validasi silang dengan base R sudah dijalankan:{" "}
                <span className="tnum text-strong-foreground/70">32</span> perbandingan,{" "}
                <span className="tnum text-strong-foreground/70">0</span> gagal. SPSS dan
                persetujuan metodolog masih menunggu, jadi belum kami klaim.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
