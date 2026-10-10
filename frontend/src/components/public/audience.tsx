import Reveal from "./reveal";

type Audience = {
  role: string;
  need: string;
  answer: string;
};

const AUDIENCE: Audience[] = [
  {
    role: "Dosen",
    need: "Menyiapkan bahan ajar dan contoh analisis yang bisa ditiru mahasiswanya.",
    answer:
      "Contoh analisis disertai Analysis ID, sehingga mahasiswa bisa menelusuri langkah demi langkah alih-alih menebak cara mengulanginya.",
  },
  {
    role: "Mahasiswa S2 dan S3",
    need: "Tabel dan grafik yang formatnya sudah benar untuk naskah.",
    answer:
      "Ekspor DOCX, TEX, dan PDF sudah membawa tabel, figure, dan lampiran. Tidak perlu merapikan hasil ekspor sebelum dikirim ke pembimbing.",
  },
  {
    role: "Peneliti independen",
    need: "Memastikan hitungannya setara dengan R atau SPSS.",
    answer:
      "Uji pembanding berjalan di CI dengan toleransi 1e-6 untuk statistik. Kalau angkanya menyimpang, rilisnya gagal — bukan meloloskan.",
  },
  {
    role: "Konsultan data",
    need: "Menyerahkan hasil yang bisa diaudit klien.",
    answer:
      "Setiap analisis meninggalkan research log dan result_hash, sehingga klien bisa memeriksa sendiri apa yang dihitung dan dari data mana.",
  },
];

export default function Audience() {
  return (
    <section>
      <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 lg:py-32">
        <Reveal>
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3 lg:col-span-3">
              Untuk siapa
            </p>
            <h2 className="max-w-[24ch] text-[2.25rem] font-bold leading-[1.02] tracking-[-0.035em] text-ink lg:col-span-6 lg:text-[2.9rem]">
              Dibuat untuk pekerjaan yang hasilnya ditanggung.
            </h2>
          </div>
        </Reveal>

        {/* zig-zag: kolom kedua bergeser turun, bukan baris kartu simetris */}
        <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {AUDIENCE.map((a, i) => (
            <Reveal
              key={a.role}
              index={i}
              className={`group border-t border-rule pt-6 ${
                i % 2 === 1 ? "md:mt-14" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-[17px] font-medium tracking-[-0.02em] text-ink">
                  {a.role}
                </h3>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-rule-2 transition-colors duration-500 group-hover:bg-primary"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-4 max-w-[44ch] text-[14px] leading-[1.7] text-ink">
                {a.need}
              </p>
              <p className="mt-3 max-w-[46ch] border-l border-rule-2 pl-4 text-[13px] leading-[1.7] text-ink-3">
                {a.answer}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
