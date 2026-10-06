/**
 * Katalog metode — cerminan `backend/methods/registry.yaml`.
 * Kolom `id` sengaja ditampilkan apa adanya: itu identifier yang muncul di
 * Analysis Log dan result_hash, bukan nomor marketing.
 */

export type MethodFamily =
  | "deskriptif"
  | "korelasi"
  | "beda-parametrik"
  | "asosiasi"
  | "beda-nonparametrik"
  | "prediksi"
  | "fase-2";

export type Method = {
  id: string;
  name: string;
  family: MethodFamily;
  /** Syarat data minimum, ditulis supaya peneliti tahu kapan metode ini sah. */
  requires: string;
  /** Nama pendek untuk pratinjau katalog di halaman welcome. */
  short?: string;
  /** Asumsi yang diperiksa otomatis sebelum hasil dipakai. */
  assumptions?: string[];
};

export const FAMILY_LABEL: Record<MethodFamily, string> = {
  deskriptif: "Deskriptif & diagnostik",
  korelasi: "Korelasi",
  "beda-parametrik": "Uji beda parametrik",
  asosiasi: "Uji asosiasi",
  "beda-nonparametrik": "Uji beda non-parametrik",
  prediksi: "Prediksi",
  "fase-2": "Fase 2 — dalam pengembangan",
};

export const METHODS: Method[] = [
  {
    id: "descriptive",
    name: "Descriptive Statistics",
    short: "Descriptive Statistics",
    family: "deskriptif",
    requires: "Kolom numerik atau kategorik",
    assumptions: ["Ringkasan lengkap + proporsi"],
  },
  {
    id: "normality",
    name: "Normality Test — Shapiro-Wilk + Kolmogorov-Smirnov",
    short: "Normality Test",
    family: "deskriptif",
    requires: "Variabel numerik",
    assumptions: ["Dua uji dilaporkan berdampingan"],
  },
  {
    id: "pearson",
    name: "Pearson Correlation",
    short: "Pearson r",
    family: "korelasi",
    requires: "Dua variabel numerik",
    assumptions: ["Linearitas", "Tanpa outlier ekstrem"],
  },
  {
    id: "spearman",
    name: "Spearman Correlation",
    short: "Spearman ρ",
    family: "korelasi",
    requires: "Dua variabel numerik atau ordinal",
    assumptions: ["Hubungan monotonik"],
  },
  {
    id: "ttest_1samp",
    name: "One-Sample t-Test",
    short: "One-Sample t",
    family: "beda-parametrik",
    requires: "Satu variabel numerik vs nilai uji",
    assumptions: ["Normalitas residu"],
  },
  {
    id: "ttest_ind",
    name: "Independent Samples t-Test",
    short: "Independent t",
    family: "beda-parametrik",
    requires: "Dua kelompok independen",
    assumptions: ["Normalitas residu", "Homogenitas varians (Levene)"],
  },
  {
    id: "ttest_paired",
    name: "Paired Samples t-Test",
    short: "Paired t",
    family: "beda-parametrik",
    requires: "Dua pengukuran pada subjek yang sama",
    assumptions: ["Selisih berdistribusi normal"],
  },
  {
    id: "anova_oneway",
    name: "One-Way ANOVA",
    short: "One-Way ANOVA",
    family: "beda-parametrik",
    requires: "Minimal dua kelompok independen",
    assumptions: ["Normalitas residu", "Homogenitas varians"],
  },
  {
    id: "chi2_independence",
    name: "Chi-Square Independence",
    short: "Chi-Square",
    family: "asosiasi",
    requires: "Dua variabel kategorik",
    assumptions: ["Expected count ≥ 5 per sel"],
  },
  {
    id: "chi2_gof",
    name: "Chi-Square Goodness of Fit",
    short: "Goodness of Fit",
    family: "asosiasi",
    requires: "Satu variabel kategorik vs distribusi harapan",
    assumptions: ["Expected count ≥ 5 per kategori"],
  },
  {
    id: "mannwhitney",
    name: "Mann-Whitney U",
    short: "Mann-Whitney U",
    family: "beda-nonparametrik",
    requires: "Dua kelompok independen",
    assumptions: ["Tanpa asumsi normalitas"],
  },
  {
    id: "wilcoxon",
    name: "Wilcoxon Signed-Rank",
    short: "Wilcoxon",
    family: "beda-nonparametrik",
    requires: "Dua pengukuran berpasangan",
    assumptions: ["Selisih simetris"],
  },
  {
    id: "kruskal",
    name: "Kruskal-Wallis",
    short: "Kruskal-Wallis",
    family: "beda-nonparametrik",
    requires: "Minimal tiga kelompok independen",
    assumptions: ["Tanpa asumsi normalitas"],
  },
  {
    id: "linreg_simple",
    name: "Simple Linear Regression",
    short: "Regresi Linier",
    family: "prediksi",
    requires: "Satu Y numerik, satu X numerik",
    assumptions: ["Linearitas", "Residual normal", "Homoskedastisitas"],
  },
  {
    id: "linreg_multiple",
    name: "Multiple Linear Regression",
    short: "Regresi Berganda",
    family: "prediksi",
    requires: "Satu Y numerik, dua X atau lebih",
    assumptions: ["Asumsi regresi + multikolinearitas (VIF)"],
  },
  {
    id: "ml_classify",
    name: "ML Classification",
    short: "ML Classification",
    family: "fase-2",
    requires: "Variabel target kategorik",
  },
  {
    id: "ml_cluster",
    name: "ML Clustering",
    short: "ML Clustering",
    family: "fase-2",
    requires: "Numerik, skala perlu distandardisasi",
  },
  {
    id: "text_tfidf",
    name: "Text Vectorization — TF-IDF / BoW",
    short: "TF-IDF / BoW",
    family: "fase-2",
    requires: "Kolom teks",
  },
  {
    id: "text_lda",
    name: "Topic Modeling — LDA",
    short: "Topic Modeling LDA",
    family: "fase-2",
    requires: "Dokumen + jumlah topik dipilih",
  },
  {
    id: "apriori",
    name: "Association Rules — Apriori",
    short: "Apriori",
    family: "fase-2",
    requires: "Data transaksional / kategorik",
  },
];

/** Metode yang tersedia hari ini (MVP). */
export const AVAILABLE_METHODS = METHODS.filter((m) => m.family !== "fase-2");

export const FAMILY_ORDER: MethodFamily[] = [
  "deskriptif",
  "korelasi",
  "beda-parametrik",
  "asosiasi",
  "beda-nonparametrik",
  "prediksi",
  "fase-2",
];

/** Format input yang diterima. */
export const INPUT_FORMATS = ["CSV", "XLSX", "XLS", "SAV", "JSON"];

/** Format export. */
export const EXPORT_FORMATS = ["CSV", "XLSX", "PDF", "DOCX", "TEX", "JSON"];

/** Tipe grafik yang dapat dipilih per metode. */
export const CHART_TYPES = [
  "histogram",
  "boxplot",
  "scatter",
  "bar",
  "residual",
  "qq",
  "confusion",
  "roc",
  "cluster",
  "dendrogram",
  "topics",
  "topterms",
  "rules",
];
