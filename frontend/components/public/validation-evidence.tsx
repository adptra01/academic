import { FAMILY_LABEL, METHODS, type MethodFamily } from "@/lib/methods";

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

const TOTAL = CHECKS.reduce((n, c) => n + c.items.length, 0);

function familyLabel(f: MethodFamily) {
  return FAMILY_LABEL[f];
}

export default function ValidationEvidence() {
  return (
    <section className="border-b border-rule bg-paper-2/40">
      <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="tnum text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-3">
              Bukti validasi
            </p>
            <h2 className="mt-5 max-w-[16ch] text-[2rem] font-semibold leading-[1.05] tracking-tight text-ink lg:text-[2.5rem]">
              Angka dibandingkan, bukan diklaim.
            </h2>
            <p className="mt-5 max-w-[38ch] text-[14.5px] leading-[1.7] text-ink-2">
              Setiap metode punya implementasinya sendiri di{" "}
              <span className="tnum text-ink">services/stats/</span>, ditulis ulang
              dari rumus aslinya — bukan panggilan satu fungsi SciPy yang
              disembunyikan.
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
                  <p className="tnum text-[10.5px] font-medium uppercase leading-relaxed tracking-[0.14em] text-ink-4">
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
            <p className="mt-5 text-[12px] leading-relaxed text-ink-4">
              <span className="tnum">{TOTAL}</span> metode MVP underwent validasi lintas
              implementasi, ditambah uji manual hitung tangan untuk Apriori. R dan
              SPSS dipakai sebagai acuan; perbedaannya dicatat di dokumen
              validasi, bukan dibulatkan agar terlihat bagus.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
