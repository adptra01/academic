import Reveal from "./reveal";

type Step = {
  title: string;
  body: string;
  meta: string;
};

const STEPS: Step[] = [
  {
    title: "Satu penelitian = satu project",
    body: "Dataset, variabel, analisis, dan log hidup di dalam project yang sama. Tidak ada ruang data yang tercampur antar penelitian.",
    meta: "Project",
  },
  {
    title: "Unggah file apa adanya",
    body: "CSV, XLSX, XLS, SAV, atau JSON. Baris pertama dan delimiter dideteksi otomatis, lalu tampil sebagai pratinjau sebelum dianalisis.",
    meta: "Preview + paging",
  },
  {
    title: "Tetapkan variabel",
    body: "Tipe data dan peran setiap kolom ditetapkan manual atau disarankan otomatis. Peran menentukan metode mana yang sah dipakai.",
    meta: "Type + role",
  },
  {
    title: "Bersihkan tanpa merusak asal",
    body: "15 operasi preprocessing — isi missing, buang outlier IQR, standardisasi, one-hot, dan lainnya. Setiap operasi menghasilkan versi dataset baru.",
    meta: "15 operasi",
  },
  {
    title: "Pilih metode, asumsi diperiksa dulu",
    body: "Normalitas dan homogenitas diuji otomatis sebelum hasil ditampilkan, jadi asumsi yang tidak terpenuhi terlihat sejak awal.",
    meta: "15 metode",
  },
  {
    title: "Baca hasil dalam bentuk yang bisa diperiksa",
    body: "Formula lengkap, tabel statistik, effect size, grafik, dan kalimat interpretasi dalam format APA — semuanya bisa disalin ke naskah.",
    meta: "Formula + APA",
  },
  {
    title: "Ekspor sesuai kebutuhan",
    body: "CSV, XLSX, PDF, DOCX, TEX, atau JSON. Ekspor TEX menghasilkan tabel booktabs siap kompilasi untuk jurnal.",
    meta: "6 format",
  },
  {
    title: "Buktikan bisa diulang",
    body: "Setiap analisis punya Analysis ID, log immutable, dan result_hash. Menjalankan ulang dengan input yang sama menghasilkan hash yang sama.",
    meta: "Analysis ID",
  },
];

export default function Pipeline() {
  return (
    <section id="alur" className="scroll-mt-24 border-b border-rule bg-paper-2/40">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-12">
          {/* Judul halaman sudah ditangani PageHeader; gutter kiri dipakai sebagai
              ruang kosong yang disengaja agar tangga langkah terbaca utuh. */}
          <div className="lg:col-span-8 lg:col-start-5">
            <ol className="border-b border-rule">
              {STEPS.map((s, i) => (
                <Reveal
                  as="li"
                  key={s.title}
                  index={i}
                  className="stair-item group grid gap-x-7 gap-y-2 border-t border-rule py-7 md:grid-cols-[3.25rem_minmax(0,1fr)] md:py-8"
                >
                  <div className="flex items-center gap-2.5 md:block">
                    <span className="tnum text-[11px] font-medium text-accent">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden="true"
                      className="hidden h-px w-full bg-rule-2 transition-colors duration-500 group-hover:bg-accent md:mt-3 md:block"
                    />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h3 className="text-[16.5px] font-medium leading-snug tracking-tight text-ink">
                        {s.title}
                      </h3>
                      <span className="tnum rounded border border-rule px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-4">
                        {s.meta}
                      </span>
                    </div>
                    <p className="mt-2.5 max-w-[52ch] text-[13.5px] leading-[1.7] text-ink-3">
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
