"use client";
import { useEffect, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { api, apiUrl, apaStyle, authHeaders, downloadExport } from "../../../lib/api";

type Detail = {
  analysis_uid: string; method: string; variables: Record<string, unknown>; params: Record<string, unknown>;
  dataset_filename?: string | null; dataset_version_number?: number | null;
  result: { method_name?: string; n?: number; statistics?: Record<string, unknown>; assumptions?: { name: string; passed?: boolean | null; p_value?: number; note?: string }[]; decision?: { text: string; p?: number; alpha?: number } | null; effect_size?: Record<string, unknown> | null; parameters?: Record<string, unknown>; formula_latex?: string; calculation?: string[]; interpretation?: string; warnings?: string[] };
  result_hash: string; software_version: string; timestamp: string;
};

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const h3 = "text-base font-semibold";
const th = "border border-slate-200 bg-slate-100 px-2 py-1.5 text-left text-xs font-semibold";
const td = "border border-slate-200 px-2 py-1.5 text-sm";
const btn2 = "rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700";

function flatten(obj: unknown, prefix = ""): [string, string][] {
  if (obj == null) return [[prefix, "-"]];
  if (typeof obj !== "object") return [[prefix, String(obj)]];
  if (Array.isArray(obj)) return [[prefix, obj.slice(0, 10).map(String).join("; ")]];
  const rows: [string, string][] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object") rows.push(...flatten(v, key));
    else rows.push([key, String(v)]);
  }
  return rows;
}

function StatTable({ data }: { data: unknown }) {
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <thead><tr><th className={th}>Key</th><th className={th}>Value</th></tr></thead>
      <tbody>
        {flatten(data).map(([k, v]) => <tr key={k}><td className={td}><code>{k}</code></td><td className={td}>{v}</td></tr>)}
      </tbody>
    </table>
  );
}

function Formula({ latex }: { latex?: string }) {
  if (!latex) return null;
  try {
    const html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
    return <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-xs">{latex}</pre>;
  }
}

export default function AnalysisPage({ params }: { params: { uid: string } }) {
  const uid = params.uid;
  const [d, setD] = useState<Detail | null>(null);
  const [fbCat, setFbCat] = useState("statistical_result");
  const [fbDesc, setFbDesc] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [chartType, setChartType] = useState("");
  const [chartCol, setChartCol] = useState("");
  const [chartUrl, setChartUrl] = useState("");
  const [rerunMsg, setRerunMsg] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<Detail>(`/api/v1/analyses/${uid}`).then(setD).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Gagal"));
  }, [uid]);
  useEffect(() => {
    let url = "";
    const qs = new URLSearchParams();
    if (chartType) qs.set("type", chartType);
    if (chartCol) qs.set("column", chartCol);
    const q = qs.toString() ? `?${qs.toString()}` : "";
    fetch(`${apiUrl()}/api/v1/analyses/${uid}/chart${q}`, { headers: { ...authHeaders() } })
      .then((res) => { if (!res.ok) throw new Error(`Chart HTTP ${res.status}`); return res.blob(); })
      .then((blob) => { url = URL.createObjectURL(blob); setChartUrl(url); })
      .catch(() => setChartUrl(""));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [uid, chartType, chartCol]);
  if (err) return <p className="text-sm text-red-700">{err}</p>;
  if (!d) return <p className="text-slate-500">Memuat...</p>;
  const r = d.result;
  const reject = r.decision?.text === "Tolak H0";
  async function rerun() {
    setRerunMsg("Menjalankan ulang...");
    try {
      const j = await api<{ analysis_uid: string; result: { identical_to_original?: boolean } }>(`/api/v1/analyses/${uid}/rerun`, { method: "POST" });
      setRerunMsg(`Rerun ${j.analysis_uid} — identik: ${j.result.identical_to_original ? "YA ✓" : "TIDAK (selidiki!)"}`);
    } catch (e: unknown) {
      setRerunMsg(e instanceof Error ? e.message : "Rerun gagal");
    }
  }
  async function sendFeedback(e: React.FormEvent) {
    e.preventDefault();
    setFbMsg("");
    try {
      await api(`/api/v1/feedback`, { method: "POST", body: JSON.stringify({ analysis_uid: uid, category: fbCat, description: fbDesc }) });
      setFbDesc("");
      setFbMsg("Laporan terkirim — terima kasih. Tim dapat mereproduksi via Analysis ID + version di atas.");
    } catch (e: unknown) {
      setFbMsg(e instanceof Error ? e.message : "Gagal mengirim");
    }
  }
  return (
    <>
      <h2 className="text-2xl font-bold">{r.method_name || d.method} <span className="text-sm font-normal text-slate-400">{d.analysis_uid}</span></h2>
      <p className="mt-1 text-xs text-slate-500">Dataset: {d.dataset_filename || "-"} · version v{d.dataset_version_number ?? "-"} · {d.software_version} · {d.timestamp}</p>
      <div className={`${card} mt-4`}>
        <p className="text-sm">Keputusan: <strong className={reject ? "text-red-700" : "text-green-700"}>{r.decision?.text || "-"}</strong> <span className="text-xs text-slate-500">(α = {r.decision?.alpha ?? "-"})</span></p>
        <p className="mt-2 text-sm leading-6">{r.interpretation}</p>
        <button className={`${btn2} mt-2`} onClick={() => { void navigator.clipboard.writeText(apaStyle(r as unknown as Record<string, unknown>)); setCopied(true); }}>
          {copied ? "Tersalin!" : "Copy APA-style"}
        </button>
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Tabel statistik (n = {String(r.n ?? "-")})</h3>
        <StatTable data={r.statistics} />
        {r.effect_size && (<><h3 className={`${h3} mt-4`}>Effect size</h3><StatTable data={r.effect_size} /></>)}
      </div>
      {(r.assumptions || []).length > 0 && (
        <div className={`${card} mt-4`}>
          <h3 className={h3}>Asumsi</h3>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead><tr><th className={th}>Asumsi</th><th className={th}>Status</th><th className={th}>Catatan</th></tr></thead>
            <tbody>
              {(r.assumptions || []).map((a, i) => (
                <tr key={i}>
                  <td className={td}>{a.name}{a.p_value != null ? ` (p=${Number(a.p_value).toFixed(4)})` : ""}</td>
                  <td className={td}>{a.passed == null ? <span className="text-slate-400">cek manual</span> : a.passed ? <strong className="text-green-700">PASS</strong> : <strong className="text-red-700">FAIL</strong>}</td>
                  <td className={`${td} text-xs text-slate-500`}>{a.note || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Grafik akademik</h3>
        <select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={chartType} onChange={(e) => setChartType(e.target.value)}>
          <option value="">Default</option>
          {["histogram", "boxplot", "scatter", "bar", "residual", "qq"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {d.method === "descriptive" && Array.isArray((d.variables as Record<string, unknown>).columns) && ((d.variables as Record<string, unknown>).columns as unknown[]).length > 1 && (
          <select aria-label="Kolom grafik" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={chartCol} onChange={(e) => setChartCol(e.target.value)}>
            <option value="">Semua (kolom pertama)</option>
            {((d.variables as Record<string, unknown>).columns as unknown[]).map((c) => <option key={String(c)} value={String(c)}>{String(c)}</option>)}
          </select>
        )}
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {chartUrl ? <img className="chart" src={chartUrl} alt="chart" /> : <p className="text-xs text-slate-500">Memuat grafik...</p>}
        </div>
        {chartUrl && <a className="mt-2 inline-block text-sm text-blue-700 hover:underline" href={chartUrl} download={`${uid}.png`}>Unduh PNG grafik</a>}
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Formula</h3>
        <Formula latex={r.formula_latex} />
        <h3 className={`${h3} mt-4`}>Parameters & variables</h3>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-3 text-xs">{JSON.stringify({ variables: d.variables, params: d.params }, null, 2)}</pre>
        <h3 className={`${h3} mt-4`}>Calculation</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{(r.calculation || []).map((c, i) => <li key={i}>{c}</li>)}</ol>
        {(r.warnings || []).length > 0 && <><h3 className={`${h3} mt-4`}>Warnings</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{r.warnings!.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Report a Problem</h3>
        <p className="mt-1 text-xs text-slate-500">Terkirim bersama {d.analysis_uid} · dataset v{d.dataset_version_number ?? "-"} — tim dapat mereproduksi langsung.</p>
        <form onSubmit={sendFeedback} className="mt-2 space-y-2">
          <select aria-label="Kategori" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={fbCat} onChange={(e) => setFbCat(e.target.value)}>
            {[["statistical_result", "Hasil statistik"], ["assumption", "Asumsi"], ["formula", "Formula"], ["data_processing", "Data processing"], ["export", "Export"], ["ui", "UI"], ["other", "Lainnya"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <textarea aria-label="Deskripsi masalah" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} placeholder="Jelaskan masalahnya (min 10 karakter)..." value={fbDesc} onChange={(e) => setFbDesc(e.target.value)} />
          <button type="submit" className={btn2}>Kirim laporan</button>
        </form>
        {fbMsg && <p className="mt-2 text-sm text-slate-700">{fbMsg}</p>}
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Export</h3>        <div className="mt-2 flex flex-wrap gap-2">
          {(["csv", "xlsx", "pdf", "docx", "tex", "json"] as const).map((f) => (
            <button key={f} className={btn2} onClick={() => void downloadExport(uid, f)}>Unduh {f.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Reproducibility</h3>
        <button className={`${btn2} mt-2`} onClick={() => void rerun()}>Rerun (verifikasi identik)</button>
        {rerunMsg && <p className="mt-2 text-sm text-slate-700">{rerunMsg}</p>}
        <p className="mt-1 text-xs text-slate-500">hash: {d.result_hash.slice(0, 16)}… · {d.software_version} · {d.timestamp}</p>
      </div>
    </>
  );
}
