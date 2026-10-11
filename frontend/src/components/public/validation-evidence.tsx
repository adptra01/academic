import { FAMILY_LABEL, type MethodFamily } from "@/lib/methods";

/**
 * Bukti validasi — disusun dari evidence yang benar-benar ada di
 * `docs/scientific-validation.md`. Angka tolerance diambil dari aturan gate
 * rilis, bukan placeholder.
 */
const CHECKS: Array<{
  family: MethodFamily;
  items: Array<{ name: string; reference: string }>;
}> = [
  {
    family: "beda-parametrik",
    items: [
      { name: "ttest_1samp", reference: "scipy.stats.ttest_1samp" },
      { name: "ttest_ind", reference: "scipy.stats.ttest_ind" },
      { name: "ttest_paired", reference: "scipy.stats.ttest_rel" },
      { name: "anova_oneway", reference: "scipy.stats.f_oneway" },
    ],
  },
  {
    family: "korelasi",
    items: [
      { name: "pearson", reference: "scipy.stats.pearsonr" },
      { name: "spearman", reference: "scipy.stats.spearmanr" },
    ],
  },
  {
    family: "beda-nonparametrik",
    items: [
      { name: "mannwhitney", reference: "scipy.stats.mannwhitneyu" },
      { name: "wilcoxon", reference: "scipy.stats.wilcoxon" },
      { name: "kruskal", reference: "scipy.stats.kruskal" },
    ],
  },
  {
    family: "asosiasi",
    items: [
      { name: "chi2_independence", reference: "scipy.stats.chi2_contingency" },
      { name: "chi2_gof", reference: "scipy.stats.chisquare" },
    ],
  },
  {
    family: "prediksi",
    items: [
      { name: "linreg_simple", reference: "statsmodels OLS" },
      { name: "linreg_multiple", reference: "statsmodels OLS" },
    ],
  },
];

const GATE = [
  { k: "Statistik", v: "1e-6", note: "selisih absolut dari nilai referensi" },
  { k: "Effect size", v: "1e-4", note: "termasuk Cohen's d, η², r" },
  { k: "Ransom saat gagal", v: "blokir", note: "rilis berhenti, bukan lolos" },
];

/**
 * Cakupan validasi — sengaja dipisah-pisah agar tidak ada lapisan yang
 * disamakan dengan lapisan lain. Status di bawah mencerminkan bukti yang
 * benar-benar ada per Okt 2026 (lihat docs/claims-registry.md).
 */
const SCOPE: Array<{ k: string; v: string; state: "ok" | "pending" }> = [
  {
    k: "Uji unit & regresi (CI)",
    v: "61 pengujian otomatis, fixture berversi di repo",
    state: "ok",
  },
  {
    k: "Bandingkan numerik vs SciPy/StatsModels",
    v: "Fixture benchmark dibandingkan dengan pustaka yang sama",
    state: "ok",
  },
  {
    k: "Validasi silang R (base R)",
    v: "32 perbandingan, 0 gagal, mencakup 15 metode",
    state: "ok",
  },
  {
    k: "Validasi silang SPSS",
    v: "Prosedur setara disiap; tabel hasil masih kosong",
    state: "pending",
  },
  {
    k: "Persetujuan metodolog (manusia)",
    v: "Menunggu tanda tangan validator statistik",
    state: "pending",
  },
];

const TOTAL = CHECKS.reduce((n, c) => n + c.items.length, 0);

function familyLabel(f: MethodFamily) {
  return FAMILY_LABEL[f];
}

export default function ValidationEvidence() {
  return (
    <section className="bg-paper-2">
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
              Bukti validasi
            </p>
            <h2 className="mt-5 max-w-[16ch] text-[2.25rem] font-bold leading-[1.02] tracking-[-0.035em] text-ink lg:text-[2.75rem]">
              Angka dibandingkan, bukan diklaim.
            </h2>
            <p className="mt-5 max-w-[40ch] text-[14.5px] leading-[1.7] text-ink-2">
              Mesin analisis memakai{" "}
              <span className="tnum text-ink">SciPy</span> dan{" "}
              <span className="tnum text-ink">StatsModels</span> untuk komputasi
              statistik, dengan lapisan orkestrasi aplikasi untuk pemeriksaan
              asumsi, pemilihan metode, interpretasi hasil, dan pencatatan audit.
              Validasi numerik dilakukan terhadap implementasi referensi secara
              terbuka, dan hasilnya dibandingkan — bukan diklaim lebih dari yang
              benar-benar ada.
            </p>

            <dl className="mt-9 divide-y divide-rule border-y border-rule">
              {GATE.map((g) => (
                <div key={g.k} className="py-3.5">
                  <dt className="text-[12.5px] text-ink-3">{g.k}</dt>
                  <dd className="mt-1 flex items-baseline gap-2.5">
                    <span className="tnum text-[15px] font-medium text-ink">{g.v}</span>
                    <span className="text-[11.5px] text-ink-4">{g.note}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            <div className="border-t border-rule">
              {CHECKS.map((c) => (
                <div key={c.family} className="grid gap-x-6 gap-y-2 border-b border-rule py-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <p className="font-mono text-[11px] font-medium uppercase leading-relaxed tracking-[0.2em] text-ink-4">
                    {familyLabel(c.family)}
                  </p>
                  <ul className="divide-y divide-rule/70">
                    {c.items.map((it) => (
                      <li
                        key={it.name}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                      >
                        <span className="tnum text-[12.5px] text-ink">{it.name}</span>
                        <span className="tnum text-[11.5px] text-ink-3">
                          {it.reference}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-7">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">
                Cakupan validasi
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-4">
                Lapisan berikut dipisahkan agar satu tidak disamakan dengan yang
                lain. Yang sudah hijau dan yang masih menunggu keduanya ditampilkan.
              </p>
              <ul className="mt-3 divide-y divide-rule/70 border-y border-rule">
                {SCOPE.map((s) => (
                  <li
                    key={s.k}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                  >
                    <span className="flex items-baseline gap-2">
                      <span
                        aria-hidden="true"
                        className={`mt-px h-1.5 w-1.5 shrink-0 rounded-full ${s.state === 'ok' ? 'bg-accent' : 'bg-warn'}`}
                      />
                      <span className="text-[12.5px] text-ink">{s.k}</span>
                    </span>
                    <span className="text-[11.5px] text-ink-3">{s.v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-ink-4">
              <span className="tnum">15</span> metode MVP dihitung terbuka:{" "}
              <span className="tnum">{TOTAL}</span> di antaranya memanggil{" "}
              <span className="tnum">SciPy</span>/<span className="tnum">StatsModels</span>{" "}
              (terlihat di daftar di atas), sementara{" "}
              <span className="tnum">descriptive</span> memakai agregat pandas
              langsung. Tidak ada implementasi statistik sendiri yang disamarkan.{" "}
              Hasilnya diadu langsung dengan{" "}
              <strong className="font-semibold text-ink-3">base R</strong> pada{" "}
              <span className="tnum">32</span> perbandingan numerik —{" "}
              <strong className="font-semibold text-ink-3">
                <span className="tnum">0</span> gagal
              </strong>
              , termasuk seluruh <span className="tnum">15</span> metode. Selisih
              kecil yang muncul (mis. pada Mann-Whitney) adalah perbedaan{" "}
              <em>continuity correction</em> yang disengaja dan terdokumentasi, bukan
              pembulatan.{" "}
              <strong className="font-semibold text-ink-3">
                Yang belum Kami buktikan: validasi silang SPSS dan persetujuan
                metodolog
              </strong>{" "}
              — keduanya masih kosong, jadi tidak kami tampilkan sebagai bukti.
              Angka lengkap ada di dokumen validasi dalam repositori.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
