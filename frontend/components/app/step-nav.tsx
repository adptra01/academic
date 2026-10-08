import { Check, ChevronRight, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "done" | "current" | "todo" | "locked";

export type StepItem = {
  key: string;
  n: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  status: StepStatus;
  /** Satu baris hasil, mis. "2 file · v3 aktif". */
  summary?: string;
};

type StepNavProps = {
  steps: StepItem[];
  onSelect: (key: string) => void;
  className?: string;
};

/**
 * Navigasi tahap vertikal untuk alur kerja project (tahap 02–07).
 *
 * Satu daftar, dua arah: horizontal scroll di ponsel, kolom sticky di desktop.
 * Status mengikuti pola component-spec: done = accent-wash + ceklis,
 * current = accent solid + aria-current, locked = redup + tidak bisa diklik.
 */
export default function StepNav({ steps, onSelect, className }: StepNavProps) {
  return (
    <nav aria-label="Tahapan kerja" className={cn("w-full max-w-full min-w-0", className)}>
      <ol className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {steps.map((s) => {
          const Icon = s.icon;
          const locked = s.status === "locked";
          const current = s.status === "current";
          const done = s.status === "done";

          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
                  current && "bg-accent text-paper",
                  done && "bg-accent-wash text-accent-2",
                  !current && !done && "bg-paper-3 text-ink-4"
                )}
              >
                {locked ? (
                  <Lock size={14} strokeWidth={1.75} />
                ) : done && !current ? (
                  <Check size={15} strokeWidth={2} />
                ) : (
                  <Icon size={15} strokeWidth={1.75} />
                )}
              </span>
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span
                  className={cn(
                    "block truncate text-[13px]",
                    current ? "font-semibold text-ink" : "font-medium text-ink-2",
                    locked && "text-ink-4"
                  )}
                >
                  {s.label}
                </span>
                <span className="tnum mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-ink-4">
                  Tahap {s.n}
                  {s.summary ? ` · ${s.summary}` : ""}
                </span>
              </span>
              {current && (
                <ChevronRight
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="shrink-0 text-accent"
                />
              )}
            </>
          );

          return (
            <li key={s.key} className="min-w-[11rem] flex-1 lg:min-w-0">
              {locked ? (
                <div
                  aria-disabled="true"
                  title={`${s.label} — ${s.hint} (terkunci: unggah file data dulu)`}
                  className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 opacity-60"
                >
                  {body}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(s.key)}
                  aria-current={current ? "step" : undefined}
                  title={`${s.label} — ${s.hint}`}
                  className={cn(
                    "pressable ring-accent flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left",
                    current
                      ? "border-accent-line bg-paper shadow-[0_8px_20px_-14px_rgba(26,24,21,0.4)]"
                      : "border-transparent hover:border-rule hover:bg-paper-2"
                  )}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
