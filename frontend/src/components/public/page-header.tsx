import Reveal from "./reveal";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  lede: string;

  /** Satu-duanya angka ringkas di kanan atas header. */
  facts?: Array<{ k: string; v: string }>;
};

/** Header untuk halaman public di dalam situs (bukan welcome). */
export default function PageHeader({ eyebrow, title, lede, facts }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="dot-grid dot-grid-fade absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1400px] px-5 pb-16 pt-14 sm:px-8 lg:pb-20 lg:pt-20">
        <div className="grid gap-x-10 gap-y-9 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
                {eyebrow}
              </p>
            </Reveal>
            <Reveal index={1}>
              <h1 className="mt-5 max-w-[18ch] text-[2.4rem] font-bold leading-[1.0] tracking-[-0.035em] text-ink sm:text-[3rem] lg:text-[3.4rem]">
                {title}
              </h1>
            </Reveal>
            <Reveal index={2}>
              <p className="mt-6 max-w-[56ch] text-[15.5px] leading-[1.7] text-ink-2">{lede}</p>
            </Reveal>
          </div>

          {facts && facts.length > 0 && (
            <div className="lg:col-span-4">
              <Reveal index={3}>
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
