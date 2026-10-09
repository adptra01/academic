"use client";

import { memo, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  AVAILABLE_METHODS,
  FAMILY_LABEL,
  FAMILY_ORDER,
  METHODS,
  type Method,
  type MethodFamily,
} from "@/lib/methods";
import Reveal from "./reveal";

const FILTERS: Array<{ key: MethodFamily | "all"; label: string }> = [
  { key: "all", label: "Semua" },
  ...FAMILY_ORDER.map((f) => ({ key: f, label: FAMILY_LABEL[f].split(" — ")[0] })),
];

const PHASE_2_COUNT = METHODS.length - AVAILABLE_METHODS.length;

const MethodRow = memo(function MethodRow({ m }: { m: Method }) {
  const fase2 = m.family === "fase-2";
  return (
    <li
      id={m.id}
      className="group scroll-mt-28 grid gap-x-6 gap-y-2 border-t border-rule py-5 md:grid-cols-[minmax(0,1fr)_9rem]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={`tnum text-[11px] transition-colors duration-300 ${
              fase2 ? "text-ink-4" : "text-ink-4 group-hover:text-accent"
            }`}
          >
            {m.id}
          </span>
          <h4
            className={`text-[15px] font-medium leading-snug tracking-tight ${
              fase2 ? "text-ink-2" : "text-ink"
            }`}
          >
            {m.name}
          </h4>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{m.requires}</p>
        {m.assumptions && m.assumptions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {m.assumptions.map((a) => (
              <li
                key={a}
                className="rounded border border-rule bg-paper-2/60 px-2 py-0.5 text-[11px] text-ink-3"
              >
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="md:pt-1 md:text-right">
        {fase2 ? (
          <span className="tnum inline-block rounded border border-warn/35 bg-warn-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-warn">
            fase 2
          </span>
        ) : (
          <span className="tnum inline-flex items-center gap-1.5 text-[10.5px] text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            tersedia
          </span>
        )}
      </div>
    </li>
  );
});

export default function MethodsIndex() {
  const [family, setFamily] = useState<MethodFamily | "all">("all");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = METHODS.filter((m) => {
      const byFamily = family === "all" || m.family === family;
      const byQuery =
        q === "" ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.requires.toLowerCase().includes(q);
      return byFamily && byQuery;
    });
    return FAMILY_ORDER.map((f) => ({
      family: f,
      items: filtered.filter((m) => m.family === f),
    })).filter((g) => g.items.length > 0);
  }, [family, query]);

  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  const empty = shown === 0;

  return (
    <section id="metode" className="scroll-mt-24 border-b border-rule">
      <div className="mx-auto max-w-[1400px] px-5 py-14 sm:px-8 lg:py-16">
        <div className="grid gap-x-10 gap-y-9 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal>
              <h2 className="max-w-[18ch] text-[1.35rem] font-semibold leading-snug tracking-tight text-ink">
                Saring menurut kelompok, atau cari satu metode.
              </h2>
              <p className="mt-4 max-w-[40ch] text-[14px] leading-[1.7] text-ink-2">
                Rumus, asumsi, keluaran, dan aturan interpretasi setiap metode
                ditulis di dalam spec — bukan ditebak saat analisis berjalan.
                Asumsi dicek otomatis, effect size selalu dihitung, dan tidak ada
                hasil tanpa <span className="tnum text-ink">Analysis&nbsp;ID</span>.
              </p>
            </Reveal>
          </div>

          {/* kontrol: label di atas input, helper text, aria pressed */}
          <div className="lg:col-span-8 lg:col-start-5">
            <Reveal>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saring menurut kelompok metode">
                  {FILTERS.map((f) => {
                    const active = family === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFamily(f.key)}
                        className={`pressable ring-accent rounded border px-2.5 py-1.5 text-[12px] font-medium ${
                          active
                            ? "border-accent bg-accent text-paper"
                            : "border-rule-2 text-ink-2 hover:border-ink-4 hover:text-ink"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="w-full sm:max-w-[17rem]">
                  <label
                    htmlFor="method-search"
                    className="block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-4"
                  >
                    Cari metode
                  </label>
                  <div className="relative mt-2">
                    <Search
                      size={14}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4"
                    />
                    <input
                      id="method-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="anova, wilcoxon…"
                      className="ring-accent w-full rounded border border-rule-2 bg-white py-2 pl-8 pr-8 text-[13px] text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Bersihkan pencarian"
                        className="pressable ring-accent absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-4 hover:text-ink"
                      >
                        <X size={13} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[11.5px] text-ink-4">
                    {empty ? (
                      "Tidak ada metode yang cocok."
                    ) : (
                      <>
                        Menampilkan {shown} dari {METHODS.length} ·{" "}
                        {AVAILABLE_METHODS.length} tersedia, {PHASE_2_COUNT} fase 2
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Reveal>

            {/* daftar */}
            <div className="mt-9">
              {empty ? (
                <div className="rounded-md border border-dashed border-rule-2 px-6 py-14 text-center">
                  <span
                    aria-hidden="true"
                    className="mx-auto block h-8 w-8 border border-rule-2"
                    style={{ backgroundImage: "repeating-linear-gradient(-45deg, var(--color-paper-3) 0 1px, transparent 1px 6px)" }}
                  />
                  <p className="mt-5 text-[15px] font-medium text-ink">
                    Metode tidak ditemukan
                  </p>
                  <p className="mx-auto mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-3">
                    Coba kata kunci lain, atau kembalikan saringan ke seluruh
                    kelompok metode.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFamily("all");
                      setQuery("");
                    }}
                    className="pressable ring-accent mt-5 rounded border border-rule-2 px-3.5 py-2 text-[13px] font-medium text-ink hover:border-ink-4 hover:bg-paper-2"
                  >
                    Tampilkan semua metode
                  </button>
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.family} className="mb-10 last:mb-0">
                    <div className="grid gap-x-6 md:grid-cols-[12rem_minmax(0,1fr)]">
                      <h3 className="tnum pb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-4 md:pt-1">
                        {FAMILY_LABEL[g.family]}
                      </h3>
                      <ul>
                        {g.items.map((m) => (
                          <MethodRow key={m.id} m={m} />
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
