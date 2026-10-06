import Link from "next/link";
import Wordmark from "@/components/public/wordmark";
import AppSession from "@/components/app/app-session";

/**
 * Shell konsol. Berbeda dari shell public: lebih rapat, tanpa chrome pemasaran,
 * dan selalu menampilkan tautan ke docs agar peneliti bisa membuka acuan
 * sedang dikerjakan tanpa meninggalkan pekerjaan.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper-2">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="ring-accent rounded-sm" aria-label="Academic Platform — dashboard">
              <Wordmark />
            </Link>
            <span aria-hidden="true" className="hidden h-4 w-px bg-rule sm:block" />
            <span className="tnum hidden text-[10.5px] uppercase tracking-[0.16em] text-ink-4 sm:block">
              Konsol
            </span>
          </div>
          <AppSession />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7 sm:px-8 sm:py-9">
        {children}
      </main>
    </div>
  );
}
