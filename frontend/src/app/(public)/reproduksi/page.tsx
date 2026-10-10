import type { Metadata } from "next";

import PageHeader from "@/components/public/page-header";
import Provenance from "@/components/public/provenance";
import ValidationEvidence from "@/components/public/validation-evidence";
import ClosingCta from "@/components/public/closing-cta";

export const metadata: Metadata = {
  title: "Reproduksi — Academic Research Platform",
  description:
    "Analysis ID, log immutable, dan result_hash sebagai cap integritas. Uji pembanding terhadap R dan SPSS dengan toleransi 1e-6.",
};

export default function ReproduksiPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reproduksi"
        title="Jejak yang masih bisa dibaca tahun depan."
        lede="Apa yang menentukan apakah hasil bisa dipercaya bukan hanya angkanya, melainkan apa yang tersisa setelah tombol ditekan. Di sini semuanya dijelaskan."
        facts={[
          { k: "Cap integritas", v: "sha256" },
          { k: "Toleransi statistik", v: "1e-6" },
          { k: "Toleransi effect size", v: "1e-4" },
          { k: "Pembanding", v: "R + SPSS" },
        ]}
      />
      <Provenance />
      <ValidationEvidence />
      <ClosingCta />
    </>
  );
}
