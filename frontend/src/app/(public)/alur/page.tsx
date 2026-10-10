import type { Metadata } from "next";
import PageHeader from "@/components/public/page-header";
import Pipeline from "@/components/public/pipeline";
import Formats from "@/components/public/formats";
import Audience from "@/components/public/audience";
import ClosingCta from "@/components/public/closing-cta";

export const metadata: Metadata = {
  title: "Alur Kerja — Academic Research Platform",
  description:
    "Delapan langkah dari project sampai ekspor: unggah dataset, tetapkan variabel, 15 operasi preprocessing, analisis, dan ekspor ke enam format.",
};

export default function AlurPage() {
  return (
    <>
      <PageHeader
        eyebrow="Alur kerja"
        title="Delapan langkah, setiap langkah meninggalkan jejak."
        lede="Tidak ada langkah yang menghapus langkah sebelumnya. Unggah, tetapkan variabel, bersihkan, jalankan, baca, ekspor, lalu buktikan bisa diulang."
        facts={[
          { k: "Langkah", v: "8" },
          { k: "Operasi preprocessing", v: "15" },
          { k: "Format input", v: "5" },
          { k: "Format export", v: "6" },
        ]}
      />
      <Pipeline />
      <Formats />
      <Audience />
      <ClosingCta />
    </>
  );
}
