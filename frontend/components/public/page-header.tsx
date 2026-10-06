import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Reveal from "./reveal";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  lede: string;
  /** Remah roti — hanya ditampilkan jika halaman punya induk yang jelas. */
  parent?: { href: string; label: string };
  /** Satu-duanya angka ringkas di kanan atas header. */
  facts?: Array<{ k: string; v: string }>;
};

/** Header untuk halaman public di dalam situs (bukan welcome). */
export default function PageHeader({ eyebrow, title, lede, parent, facts }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden border-b border-rule">
      <div className="graph-paper graph-paper-fade absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1400px] px-5 pb-14 pt-12 sm:px-8 lg:pb-16 lg:pt-16">
        {parent && (
          <Reveal>
            <Link
              href={parent.href}
              className="ring-accent group inline-flex items-center gap-1.5 rounded-sm text-[12px] font-medium text-ink-3 transition-colors duration-300 hover:text-accent"
            >
              <ChevronLeft
                size={13}
                strokeWidth={1.5}
                className="transition-transform duration-300 group-hover:-translate-x-0.5"
              />
              {parent.label}
            </Link>
          </Reveal>
        )}

        <div className="grid gap-x-10 gap-y-9 lg:grid-cols-12">
          <div className={parent ? "lg:col-span-8" : "lg:col-span-8"}>
            <Reveal index={parent ? 1 : 0}>
              <p className="tnum text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-3">
                {eyebrow}
              </p>
            </Reveal>
            <Reveal index={parent ? 2 : 1}>
              <h1 className="mt-5 max-w-[18ch] text-[2.3rem] font-semibold leading-[1.03] tracking-tight text-ink sm:text-[2.9rem] lg:text-[3.3rem]">
                {title}
              </h1>
            </Reveal>
            <Reveal index={parent ? 3 : 2}>
              <p className="mt-6 max-w-[56ch] text-[15.5px] leading-[1.7] text-ink-2">{lede}</p>
            </Reveal>
          </div>

          {facts && facts.length > 0 && (
            <div className="lg:col-span-4">
              <Reveal index={parent ? 4 : 3}>
                <dl className="divide-y divide-rule border-y border-rule">
                  {facts.map((f) => (
                    <div key={f.k} className="flex items-baseline justify-between gap-4 py-3.5">
                      <dt className="text-[12.5px] text-ink-3">{f.k}</dt>
                      <dd className="tnum text-[13px] font-medium text-ink">{f.v}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
