import type { Metadata } from "next";
import PageHeader from "@/components/public/page-header";
import MethodsIndex from "@/components/public/methods-index";
import ClosingCta from "@/components/public/closing-cta";
import { AVAILABLE_METHODS, METHODS } from "@/lib/methods";

export const metadata: Metadata = {
  title: "Katalog Metode — Academic Research Platform",
  description:
    "Katalog lengkap metode statistik beserta syarat data dan asumsi yang diperiksa otomatis: deskriptif, korelasi, uji beda parametrik dan non-parametrik, asosiasi, serta regresi.",
};

export default function MetodePage() {
  return (
    <>
      <PageHeader
        eyebrow="Katalog metode"
        title="Buka metode hanya kalau syaratnya memang terpenuhi."
        lede="Indeks lengkap metode yang tersedia beserta data yang dibutuhkan. Setiap entri menampilkan asumsi yang diperiksa otomatis sebelum hasil boleh dipakai."
        facts={[
          { k: "Metode tersedia", v: String(AVAILABLE_METHODS.length) },
          { k: "Dalam pengembangan", v: String(METHODS.length - AVAILABLE_METHODS.length) },
          { k: "Kelompok metode", v: "6 + fase 2" },
          { k: "Effect size", v: "selalu" },
        ]}
      />
      <MethodsIndex />
      <ClosingCta />
    </>
  );
}
