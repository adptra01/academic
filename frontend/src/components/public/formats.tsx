import { CHART_TYPES, EXPORT_FORMATS, INPUT_FORMATS } from "@/lib/methods";
import Reveal from "./reveal";

const INPUT_NOTE: Record<string, string> = {
  CSV: "Deteksi delimiter otomatis",
  XLSX: "Multi-sheet, pilih header",
  XLS: "Format lama Excel",
  SAV: "SPSS, label variabel ikut terbaca",
  JSON: "Nested di-flatten otomatis",
};

const EXPORT_NOTE: Record<string, string> = {
  CSV: "Tabel hasil",
  XLSX: "Multi-sheet plus ringkasan",
  PDF: "Siap dilampirkan ke laporan",
  DOCX: "Naskah, tabel, dan gambar",
  TEX: "booktabs, siap dikompilasi",
  JSON: "uid, hash, dan hasil penuh",
};

const CHART_LABEL: Record<string, string> = {
  histogram: "Histogram",
  boxplot: "Boxplot",
  scatter: "Scatter",
  bar: "Bar",
  residual: "Residual",
  qq: "Normal Q-Q",
  confusion: "Confusion matrix",
  roc: "ROC curve",
  cluster: "Cluster scatter",
  dendrogram: "Dendrogram",
  topics: "Distribusi topik",
  topterms: "Top terms",
  rules: "Aturan asosiasi",
};

/** Nama op + keterangan singkat, diturunkan dari `preprocess_service.py`. */
const OPS: Array<[string, string]> = [
  ["drop_missing", "Buang baris yang punya nilai kosong"],
  ["fill_missing", "Isi kosong: mean, median, modus, atau konstanta"],
  ["remove_outlier_iqr", "Buang baris di luar pagar 1.5×IQR"],
  ["scale_standard", "Standardisasi z-score"],
  ["scale_minmax", "Normalisasi ke rentang 0 sampai 1"],
  ["transform_log", "Logaritma, hanya untuk nilai positif"],
  ["transform_sqrt", "Akar kuadrat"],
  ["mapping", "Petakan nilai kategori ke label lain"],
  ["onehot", "One-hot encoding kolom kategorik"],
  ["rename", "Ganti nama kolom"],
  ["drop_columns", "Hapus kolom tertentu"],
  ["text_lowercase", "Samakan huruf menjadi kecil"],
  ["text_remove_punct", "Hapus tanda baca"],
  ["text_remove_stopwords", "Hapus kata umum Indonesia dan Inggris"],
  ["remove_duplicates", "Buang baris duplikat"],
];

/** Kepala grup: satu pola yang diulang supaya blok mudah dipindai. */
function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 border-t border-ink/25 pt-3">
        <h3 className="text-[13px] font-medium tracking-tight text-ink">{title}</h3>
        <span className="tnum shrink-0 text-[11px] text-ink-4">{count}</span>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="tnum text-[10px] font-medium uppercase tracking-[0.16em] text-ink-4">
      {children}
    </p>
  );
}

function FormatRows({
  formats,
  note,
  accent,
}: {
  formats: string[];
  note: Record<string, string>;
  accent: boolean;
}) {
  return (
    <ul className="divide-y divide-rule border-b border-rule">
      {formats.map((f) => (
        <li key={f} className="flex items-baseline gap-4 py-2.5">
          <span
            className={`tnum w-11 shrink-0 text-[12px] font-medium ${
              accent ? "text-accent" : "text-ink"
            }`}
          >
            {f}
          </span>
          <span className="text-[12.5px] leading-snug text-ink-3">{note[f]}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Formats() {
  return (
    <section id="format" className="scroll-mt-24 border-b border-rule">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
          {/* kiri: konteks, ikut menempel saat sisi kanan digulir */}
          <Reveal className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
            <p className="tnum text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-3">
              Format
            </p>
            <h2 className="mt-5 max-w-[15ch] text-[1.9rem] font-semibold leading-[1.06] tracking-tight text-ink lg:text-[2.3rem]">
              Masuk sebagai file apa adanya.
            </h2>
            <p className="mt-5 max-w-[36ch] text-[14px] leading-[1.7] text-ink-2">
              Tidak ada importer khusus SPSS, tidak ada langkah konversi manual.
              Metadata yang bisa dibaca tetap dibaca.
            </p>
            <p className="mt-6 border-l-2 border-accent pl-3.5 text-[12.5px] leading-[1.7] text-ink-3">
              Operasi preprocessing berjalan berurutan dan setiap langkah
              menulis versi dataset baru. Berkas asli tidak pernah diubah.
            </p>
          </Reveal>

          {/* kanan: empat blok, semuanya pola Group yang sama */}
          <div className="space-y-14 lg:col-span-8 lg:col-start-5">
            <Reveal index={1}>
              <Group title="Format file" count={`${INPUT_FORMATS.length} masuk · ${EXPORT_FORMATS.length} keluar`}>
                <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                  <div>
                    <SubHead>Masuk</SubHead>
                    <div className="mt-3">
                      <FormatRows formats={INPUT_FORMATS} note={INPUT_NOTE} accent />
                    </div>
                  </div>
                  <div>
                    <SubHead>Keluar</SubHead>
                    <div className="mt-3">
                      <FormatRows formats={EXPORT_FORMATS} note={EXPORT_NOTE} accent={false} />
                    </div>
                  </div>
                </div>
              </Group>
            </Reveal>

            <Reveal index={2}>
              <Group title="Tipe grafik" count={`${CHART_TYPES.length} tipe`}>
                <div className="grid grid-cols-2 overflow-hidden border-l border-t border-rule sm:grid-cols-3">
                  {CHART_TYPES.map((c) => (
                    <span
                      key={c}
                      className="border-b border-r border-rule px-3.5 py-2.5 text-[12px] leading-tight text-ink-2"
                    >
                      {CHART_LABEL[c]}
                    </span>
                  ))}
                </div>
              </Group>
            </Reveal>

            <Reveal index={3}>
              <Group title="Operasi preprocessing" count={`${OPS.length} operasi`}>
                <ul className="grid gap-x-10 sm:grid-cols-2">
                  {OPS.map(([op, desc], i) => (
                    <li key={op} className="flex gap-3 border-b border-rule/80 py-3">
                      <span className="tnum w-5 shrink-0 text-[10px] leading-5 text-ink-4">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="tnum block text-[11.5px] leading-5 text-ink">
                          {op}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">
                          {desc}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Group>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
