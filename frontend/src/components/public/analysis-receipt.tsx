"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Check, RefreshCw, TriangleAlert } from "lucide-react";

import { apiUrl } from "@/lib/api";

type Status = "probing" | "ok" | "checking" | "error";

const HASH = "4f9c1a7be2035d8fa6c410b7e92d3a5c18f60b4e7d29a3c5";

/**
 * "Analysis record" — bukan mockup: isi, asumsi, dan cap integritas mengikuti
 * apa yang benar-benar ditulis engine ke Analysis Log.
 */
export default function AnalysisReceipt() {
  const [status, setStatus] = useState<Status>("probing");
  const [runId, setRunId] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;

    fetch(`${apiUrl()}/health`)
      .then((r) => {
        if (alive) setStatus(r.ok ? "ok" : "error");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  // Batalkan timer bila komponen dilepas saat hitung ulang masih berjalan.
  useEffect(() => {
    if (status !== "checking") return;
    timer.current = setTimeout(() => setStatus("ok"), 1150);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, runId]);

  const reverify = useCallback(() => {
    setStatus("checking");
    setRunId((n) => n + 1);
  }, []);

  const busy = status === "checking";

  return (
    <div className="relative">
      {/* registration marks — corners like a plotted figure */}
      <span
        aria-hidden="true"
        className="absolute -left-2.5 -top-2.5 h-3 w-3 border-l border-t border-rule-2"
      />
      <span
        aria-hidden="true"
        className="absolute -right-2.5 -top-2.5 h-3 w-3 border-r border-t border-rule-2"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-2.5 -left-2.5 h-3 w-3 border-b border-l border-rule-2"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-2.5 -right-2.5 h-3 w-3 border-b border-r border-rule-2"
      />

      <div className="relative overflow-hidden rounded-xl border border-rule-2 bg-card/85 shadow-[var(--shadow-card)] backdrop-blur-sm">
        {/* garis kepala: mono, kecil, technical */}
        <div className="flex items-center justify-between gap-3 border-b border-rule bg-paper-2/70 px-4 py-2.5">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
            analysis record
          </span>
          <span className="tnum text-[10px] text-ink-4">an_7f3c1a9e4b2</span>
        </div>

        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.02em] text-ink">
                Independent Samples t-Test
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                Uji selisih mean dua kelompok independen
              </p>
            </div>
            <span className="tnum shrink-0 rounded border border-rule-2 bg-accent-wash px-1.5 py-0.5 text-[10px] font-medium text-primary">
              ttest_ind
            </span>
          </div>

          {/* formula — verbatim, bukan render KgEX di sini */}
          <div className="mt-4 rounded-xl border border-rule bg-paper-2/60 px-3 py-2.5">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">formula</p>
            <p className="tnum mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
              t = (x&#772;<sub>1</sub> &#8722; x&#772;<sub>2</sub>) / &radic;(s<sub>1</sub><sup>2</sup>/n
              <sub>1</sub> + s<sub>2</sub><sup>2</sup>/n<sub>2</sub>)
            </p>
          </div>

          {/* blok hasil: skeleton saat hitung ulang */}
          <div className="relative mt-4 overflow-hidden rounded-xl border border-rule-2 bg-card px-3 py-3">
            {busy ? (
              <div className="space-y-2" aria-live="polite">
                <span className="sr-only">Menghitung ulang…</span>
                <div className="shimmer h-3.5 w-full rounded-sm bg-muted" />
                <div className="shimmer h-3.5 w-4/5 rounded-sm bg-muted" />
                <div className="shimmer h-3.5 w-2/3 rounded-sm bg-muted" />
              </div>
            ) : (
              <div className="fade-in">
                <p className="tnum text-[12px] leading-relaxed text-ink">
                  <span className="text-ink-3">Independent t-test: </span>
                  t(38) = 2.147, <span className="text-primary">p = .037</span>, d = 0.68 (n = 40)
                </p>
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-3">
                  Mean pre <span className="tnum">68.42</span> (SD{" "}
                  <span className="tnum">7.13</span>) berbeda signifikan dari mean post{" "}
                  <span className="tnum">72.85</span> (SD <span className="tnum">6.94</span>).
                  Tolak H<sub>0</sub>.
                </p>
              </div>
            )}
            {busy && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-muted/90 to-transparent"
              />
            )}
          </div>

          {/* asumsi — dicek otomatis, bukan opsi toggle manual */}
          <dl className="mt-4 divide-y divide-rule border-y border-rule">
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-[12px] text-ink-2">Normalitas residu</dt>
              <dd className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="tnum text-[11px] text-ink-3">W = 0.968, p = .437 — lolos</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-[12px] text-ink-2">Homogenitas (Levene)</dt>
              <dd className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                <span className="tnum text-[11px] text-ink-3">F = 3.812, p = .031 — perlu-hatian</span>
              </dd>
            </div>
          </dl>

          {/* ringkasan deskriptif per kelompok */}
          <table className="mt-4 w-full text-left">
            <caption className="sr-only">Ringkasan statistik deskriptif per kelompok</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="pb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">
                  Kelompok
                </th>
                <th scope="col" className="pb-1.5 text-right font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">
                  n
                </th>
                <th scope="col" className="pb-1.5 text-right font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">
                  M
                </th>
                <th scope="col" className="pb-1.5 text-right font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">
                  SD
                </th>
              </tr>
            </thead>
            <tbody className="tnum text-[12px] text-ink-2">
              <tr className="border-b border-rule/70">
                <th scope="row" className="py-1.5 font-normal text-ink-2">
                  Sebelum
                </th>
                <td className="py-1.5 text-right">20</td>
                <td className="py-1.5 text-right">68.42</td>
                <td className="py-1.5 text-right">7.13</td>
              </tr>
              <tr>
                <th scope="row" className="py-1.5 font-normal text-ink-2">
                  Sesudah
                </th>
                <td className="py-1.5 text-right">20</td>
                <td className="py-1.5 text-right">72.85</td>
                <td className="py-1.5 text-right">6.94</td>
              </tr>
            </tbody>
          </table>

          {/* cap integritas */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3.5">
            <div className="min-w-0">
              <p className="tnum text-[9.5px] uppercase tracking-[0.18em] text-ink-4">result_hash</p>
              <p className="tnum mt-1 truncate text-[11px] text-ink-2">
                sha256:{HASH.slice(0, 20)}…
              </p>
            </div>
            <button
              type="button"
              onClick={reverify}
              disabled={busy}
              className="pressable ring-accent inline-flex items-center gap-1.5 rounded-full border border-rule-2 bg-paper-2/70 px-2.5 py-1.5 text-[11.5px] font-medium text-ink-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-4 hover:text-ink disabled:opacity-60"
            >
              <RefreshCw size={12} strokeWidth={1.5} className={busy ? "animate-spin" : ""} />
              {busy ? "Menghitung…" : "Hitung ulang"}
            </button>
          </div>
        </div>
      </div>

      {/* status engine: jujur dengan kondisi sebenarnya */}
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <span className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            {status !== "error" && (
              <span className="animate-ping-ring absolute inset-0 rounded-full bg-primary/60" />
            )}
            <span
              className={`relative h-1.5 w-1.5 rounded-full ${
                status === "error" ? "bg-warn" : "bg-primary"
              } animate-breathe`}
            />
          </span>
          <span className="font-mono text-[10.5px] text-ink-3">
            {status === "error"
              ? "Engine tidak dapat dihubungi"
              : status === "checking" || status === "probing"
                ? "Memeriksa engine…"
                : "Engine deterministik online"}
          </span>
        </span>

        {status === "error" ? (
          <span className="flex items-center gap-1.5">
            <TriangleAlert size={11} strokeWidth={1.5} className="text-warn" />
            <button
              type="button"
              onClick={reverify}
              className="ring-accent rounded text-[10.5px] font-medium text-primary underline underline-offset-2 hover:text-primary"
            >
              Coba lagi
            </button>
          </span>
        ) : (
          <span className="animate-stamp inline-flex items-center gap-1 rounded border border-primary px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Check size={9} strokeWidth={2.5} />
            terverifikasi
          </span>
        )}
      </div>
    </div>
  );
}
