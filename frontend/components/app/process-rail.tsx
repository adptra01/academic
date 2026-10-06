import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tahap kanonis satu penelitian. Urutan ini ikut dengan model data di backend:
 * Project → Dataset (versioned) → Variables → Preprocessing → Analysis →
 * Results → Export. Dipakai sebagai kerangka di dashboard dan project detail.
 */
export const PROCESS_STEPS = [
  { n: "01", key: "project", label: "Buat project" },
  { n: "02", key: "dataset", label: "Unggah data" },
  { n: "03", key: "variables", label: "Variabel" },
  { n: "04", key: "preprocess", label: "Bersihkan" },
  { n: "05", key: "analysis", label: "Analisis" },
  { n: "06", key: "results", label: "Hasil" },
  { n: "07", key: "export", label: "Ekspor" },
] as const;

export type ProcessStepKey = (typeof PROCESS_STEPS)[number]["key"];

type ProcessRailProps = {
  /** 1-based tahap yang sedang aktif. */
  current: number;
  /** Kalau diisi, tahap yang bisa diklik diarahkan ke sini. */
  hrefFor?: (key: ProcessStepKey) => string | undefined;
  className?: string;
};

/**
 * Rel proses. Tahap yang sudah dilewati ditandai accent, tahap aktif diberi
 * penanda, tahap berikutnya masih redup — supaya pengguna selalu tahu posisi kerja.
 */
export default function ProcessRail({ current, hrefFor, className }: ProcessRailProps) {
  return (
    // overflow-x-auto + w-full: rel tahap boleh lebih lebar dari layar dan
    // digulir mendatar, tapi tidak boleh melebarkan dokumen (mobile overflow).
    <nav
      aria-label="Tahap penelitian"
      className={cn("w-full max-w-full overflow-x-auto overscroll-x-contain", className)}
    >
      <ol className="flex w-max min-w-full items-stretch">
        {PROCESS_STEPS.map((s, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          const href = hrefFor?.(s.key);
          const inner = (
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "tnum flex h-5 items-center justify-center rounded-sm px-1.5 text-[10.5px] font-medium transition-colors duration-300",
                  active && "bg-accent text-paper",
                  done && "bg-accent-wash text-accent-2",
                  !active && !done && "bg-paper-3 text-ink-4"
                )}
              >
                {s.n}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[12.5px] transition-colors duration-300",
                  active && "font-medium text-ink",
                  done && "text-ink-2",
                  !active && !done && "text-ink-4"
                )}
              >
                {s.label}
              </span>
            </span>
          );

          return (
            <li key={s.key} className="flex items-center">
              {href ? (
                <Link
                  href={href}
                  aria-current={active ? "step" : undefined}
                  className="ring-accent rounded-sm px-2.5 py-1.5 hover:bg-paper-2"
                >
                  {inner}
                </Link>
              ) : (
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn("px-2.5 py-1.5", active && "bg-paper-2 rounded-sm")}
                >
                  {inner}
                </span>
              )}
              {i < PROCESS_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-0.5 h-px w-5 shrink-0 transition-colors duration-300 sm:w-7",
                    done ? "bg-accent-line" : "bg-rule"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
