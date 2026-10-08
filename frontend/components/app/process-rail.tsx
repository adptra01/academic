import Link from "next/link";
import {
  ChartBar,
  Database,
  Download,
  FileText,
  FlaskConical,
  PencilRuler,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tahap kanonis satu penelitian, dengan bahasa yang dipakai dosen saat
 * menjelaskan alur ke mahasiswa.
 *
 * `label` = yang dilihat pengguna. `tech` = istilah teknis yang muncul di URL,
 * nama API, dan nama operasi — sengaja tidak diubah supaya kontrak dengan
 * mesin dan literatur metode tetap utuh.
 */
export const PROCESS_STEPS = [
  {
    n: "01",
    key: "project",
    label: "Mulai Project",
    tech: "create project",
    icon: PencilRuler,
  },
  {
    n: "02",
    key: "dataset",
    label: "Unggah Data",
    tech: "upload dataset",
    icon: Database,
  },
  {
    n: "03",
    key: "variables",
    label: "Cek Kolom",
    tech: "variables",
    icon: Table2,
  },
  {
    n: "04",
    key: "preprocess",
    label: "Bersihkan",
    tech: "preprocessing",
    icon: FlaskConical,
  },
  {
    n: "05",
    key: "analysis",
    label: "Analisis",
    tech: "analysis",
    icon: ChartBar,
  },
  {
    n: "06",
    key: "results",
    label: "Lihat Hasil",
    tech: "results",
    icon: FileText,
  },
  {
    n: "07",
    key: "export",
    label: "Unduh",
    tech: "export",
    icon: Download,
  },
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
 * Rel proses. Setiap tahap membawa ikon + nomor + nama, jadi posisinya terbaca
 * tanpa harus membaca teks panjang. Tahap yang sudah dilewati ditandai accent,
 * tahap aktif diberi penanda solid, tahap berikutnya masih redup.
 *
 * Di bawah `md` rel ini jadi daftar vertikal bertingkat — rail horizontal
 * memaksa pengguna menggulir mendatar untuk mencari posisinya.
 */
export default function ProcessRail({ current, hrefFor, className }: ProcessRailProps) {
  return (
    <nav
      aria-label="Tahapan kerja penelitian"
      className={cn("w-full max-w-full", className)}
    >
      {/* Desktop: rel horizontal dengan ikon */}
      <ol className="hidden items-center md:flex">
        {PROCESS_STEPS.map((s, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          const href = hrefFor?.(s.key);
          const Icon = s.icon;

          const inner = (
            <span
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors duration-300",
                active && "bg-paper",
                !active && "hover:bg-paper-2"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors duration-300",
                  active && "bg-accent text-paper",
                  done && "bg-accent-wash text-accent-2",
                  !active && !done && "bg-paper-3 text-ink-4"
                )}
              >
                <Icon size={13} strokeWidth={1.75} />
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span
                  className={cn(
                    "whitespace-nowrap text-[12.5px] transition-colors duration-300",
                    active && "font-semibold text-ink",
                    done && "font-medium text-ink-2",
                    !active && !done && "text-ink-4"
                  )}
                >
                  {s.label}
                </span>
                <span className="tnum text-[9.5px] uppercase tracking-[0.12em] text-ink-4">
                  Tahap {s.n}
                </span>
              </span>
            </span>
          );

          return (
            <li key={s.key} className="flex items-center">
              {href ? (
                <Link
                  href={href}
                  aria-current={active ? "step" : undefined}
                  className="ring-accent rounded-md"
                >
                  {inner}
                </Link>
              ) : (
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn("rounded-md", active && "bg-paper")}
                >
                  {inner}
                </span>
              )}
              {i < PROCESS_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-0.5 h-px w-4 shrink-0 transition-colors duration-300 sm:w-5",
                    done ? "bg-accent-line" : "bg-rule"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: daftar bertingkat, posisi aktif terlihat tanpa perlu scroll */}
      <ol className="md:hidden">
        {PROCESS_STEPS.map((s, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          const href = hrefFor?.(s.key);
          const Icon = s.icon;

          const row = (
            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm",
                  active && "bg-accent text-paper",
                  done && "bg-accent-wash text-accent-2",
                  !active && !done && "bg-paper-3 text-ink-4"
                )}
              >
                <Icon size={14} strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span
                  className={cn(
                    "text-[13.5px]",
                    active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-4"
                  )}
                >
                  {s.label}
                </span>
                <span className="tnum text-[10px] uppercase tracking-[0.12em] text-ink-4">
                  Tahap {s.n}
                </span>
              </span>
              {active && (
                <span className="ml-auto shrink-0 text-[10.5px] font-medium text-accent">
                  sedang dikerjakan
                </span>
              )}
            </span>
          );

          return (
            <li
              key={s.key}
              className={cn("border-b border-rule last:border-0", active && "bg-paper")}
            >
              {href ? (
                <Link
                  href={href}
                  aria-current={active ? "step" : undefined}
                  className="ring-accent block px-2 py-2.5"
                >
                  {row}
                </Link>
              ) : (
                <div aria-current={active ? "step" : undefined} className="px-2 py-2.5">
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}