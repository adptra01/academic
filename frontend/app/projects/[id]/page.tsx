"use client";
import { useEffect, useState } from "react";
import { api, apiUrl, authHeaders, downloadExport } from "../../../lib/api";

type Version = { version_number: number };
type Dataset = { id: string; filename: string; file_type: string; rows_count: number; cols_count: number; versions: Version[] };
type AnalysisItem = { analysis_uid: string; method: string; created_at: string; dataset_version_number?: number | null; result_hash?: string | null; params?: Record<string, unknown> };
type ExportItem = { analysis_uid: string; method: string; format: string; created_at: string };
type Variable = { id: string; name: string; var_type: string; var_role: string };
type Profile = { rows: number; cols: number; missing_pct: number; duplicate_rows: number; columns: { name: string; detected_type: string; missing_count: number; unique_count: number }[] };
type Diff = { from: number; to: number; rows_from: number; rows_to: number; rows_delta: number; columns_added: string[]; columns_removed: string[]; numeric_drift: { column: string; mean_from: number | null; mean_to: number | null; missing_from: number; missing_to: number }[] };

const METHODS = ["descriptive", "normality", "pearson", "spearman", "ttest_1samp", "ttest_ind", "ttest_paired", "anova_oneway", "chi2_independence", "chi2_gof", "mannwhitney", "wilcoxon", "kruskal", "linreg_simple", "linreg_multiple", "ml_classify", "ml_cluster", "text_tfidf", "text_lda"];
const OPS = ["drop_missing", "fill_missing", "remove_outlier_iqr", "scale_standard", "scale_minmax", "transform_log", "transform_sqrt", "mapping", "onehot", "rename", "drop_columns", "text_lowercase", "text_remove_punct", "text_remove_stopwords", "remove_duplicates"];
const VTYPES = ["Numerical", "Ordinal", "Nominal", "Binary", "Text", "Datetime", "ID"];
const VROLES = ["Independent", "Dependent", "Control", "Grouping", "ID", "Ignore"];

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const h3 = "text-base font-semibold";
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none";
const btn = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800";
const btn2 = "rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700";
const th = "border border-slate-200 bg-slate-100 px-2 py-1.5 text-left text-xs font-semibold";
const td = "border border-slate-200 px-2 py-1.5 text-sm";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [sel, setSel] = useState<string>("");
  const [ver, setVer] = useState<number>(1);
  const [preview, setPreview] = useState<{ columns: string[]; rows: Record<string, unknown>[]; total_rows: number } | null>(null);
  const [previewOff, setPreviewOff] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [method, setMethod] = useState("pearson");
  const [methodSpec, setMethodSpec] = useState<{ variables?: Record<string, string> } | null>(null);
  const [varsJson, setVarsJson] = useState('{"x": "service_quality", "y": "satisfaction"}');
  const [op, setOp] = useState("scale_standard");
  const [opCol, setOpCol] = useState("");
  const [opParams, setOpParams] = useState("{}");
  const [chain, setChain] = useState<Record<string, unknown>[]>([]);
  const [diffFrom, setDiffFrom] = useState("1");
  const [diffTo, setDiffTo] = useState("2");
  const [diff, setDiff] = useState<Diff | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const ds = await api<Dataset[]>(`/api/v1/projects/${id}/datasets`);
      setDatasets(ds);
      if (!sel && ds[0]) setSel(ds[0].id);
      setAnalyses(await api<AnalysisItem[]>(`/api/v1/projects/${id}/analyses`));
      setExports(await api<ExportItem[]>(`/api/v1/projects/${id}/exports`));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    }
  }
  useEffect(() => { void load(); }, []);

  async function loadDetail(dsid: string, v: number, off = previewOff) {
    try {
      setPreview(await api(`/api/v1/datasets/${dsid}/preview?version=${v}&limit=10&offset=${off}`));
      setProfile(await api<Profile>(`/api/v1/datasets/${dsid}/profile?version=${v}`));
      setVariables(await api<Variable[]>(`/api/v1/datasets/${dsid}/versions/${v}/variables`));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal detail");
    }
  }
  useEffect(() => { if (sel) void loadDetail(sel, ver); }, [sel, ver]);
  useEffect(() => {
    api<{ variables?: Record<string, string> }>(`/api/v1/methods/${method}`).then(setMethodSpec).catch(() => setMethodSpec(null));
  }, [method]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(""); setMsg(""); setUploadPct(0);
    try {
      const token = window.localStorage.getItem("token");
      const done = await new Promise<{ rows: number; cols: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${apiUrl()}/api/v1/projects/${id}/datasets/upload`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const j = JSON.parse(xhr.responseText);
              resolve(j.profile);
            } catch { reject(new Error("Respons tidak valid")); }
          } else {
            try {
              const j = JSON.parse(xhr.responseText);
              reject(new Error(j.detail || `HTTP ${xhr.status}`));
            } catch { reject(new Error(`HTTP ${xhr.status}`)); }
          }
        };
        xhr.onerror = () => reject(new Error("Jaringan gagal"));
        xhr.send(fd);
      });
      setMsg(`Upload OK: ${done.rows} rows × ${done.cols} cols`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload gagal");
    } finally {
      setUploadPct(null);
    }
  }

  async function saveVar(v: Variable, patch: Partial<Variable>) {
    try {
      await api(`/api/v1/variables/${v.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setVariables((vs) => vs.map((x) => (x.id === v.id ? { ...x, ...patch } : x)));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update variabel gagal");
    }
  }

  function addOp(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const extra = opParams.trim() ? JSON.parse(opParams) : {};
      setChain((c) => [...c, { op, ...(opCol ? { column: opCol } : {}), ...extra }]);
      setOpCol(""); setOpParams("{}");
    } catch {
      setErr("Params JSON tidak valid");
    }
  }

  async function runPreprocess(e: React.FormEvent) {
    e.preventDefault();
    if (chain.length === 0) { setErr("Tambahkan minimal 1 operasi dulu"); return; }
    setErr(""); setMsg("");
    try {
      const ops = chain;
      const j = await api<{ new_version?: number; job_id?: string }>(`/api/v1/datasets/${sel}/preprocess`, {
        method: "POST", body: JSON.stringify({ base_version: ver, operations: ops }),
      });
      if (j.job_id) {
        setMsg(`Masuk antrean async, menunggu worker...`);
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const st = await api<{ state: string; result?: { new_version: number }; error?: string }>(`/api/v1/jobs/${j.job_id}`);
          if (st.state === "SUCCESS") { setMsg(`Version baru v${st.result?.new_version} dibuat (async, ${ops.length} ops)`); break; }
          if (st.state === "FAILURE") throw new Error(st.error || "Job gagal");
          setMsg(`Worker: ${st.state}...`);
        }
      } else setMsg(`Version baru v${j.new_version} dibuat (${ops.length} ops)`);
      setChain([]);
      await load();
      const vs = await api<{ versions: { version_number: number }[] }>(`/api/v1/datasets/${sel}`);
      setVer(Math.max(...vs.versions.map((v) => v.version_number)));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Preprocess gagal");
    }
  }

  function downloadLogCsv() {
    const rows = [["analysis_uid", "method", "version", "hash", "created_at"],
      ...analyses.map((a) => [a.analysis_uid, a.method, `v${a.dataset_version_number ?? "-"}`, a.result_hash || "", a.created_at])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const el = document.createElement("a");
    el.href = url; el.download = "research_log.csv"; el.click();
    URL.revokeObjectURL(url);
  }

  async function showDiff(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      setDiff(await api<Diff>(`/api/v1/datasets/${sel}/diff?from=${diffFrom}&to=${diffTo}`));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Diff gagal");
    }
  }

  async function runAnalysis(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg("");
    const t0 = performance.now();
    try {
      const j = await api<{ analysis_uid: string }>(`/api/v1/analyses/run`, {
        method: "POST",
        body: JSON.stringify({ project_id: id, dataset_id: sel || datasets[0]?.id, base_version: ver, method, variables: JSON.parse(varsJson) }),
      });
      setMsg(`Analysis ${j.analysis_uid} selesai dalam ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Run gagal");
    }
  }

  async function removeDataset(dsid: string, filename: string) {
    if (!window.confirm(`Hapus dataset ${filename}? Ditolak jika sudah ada analysis.`)) return;
    setErr(""); setMsg("");
    try {
      const res = await fetch(`${apiUrl()}/api/v1/datasets/${dsid}`, { method: "DELETE", headers: { ...authHeaders() } });
      if (res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      setMsg(`Dataset ${filename} dihapus`);
      if (sel === dsid) { setSel(""); setPreview(null); setProfile(null); setVariables([]); }
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hapus gagal");
    }
  }

  async function downloadVersion() {
    try {
      const res = await fetch(`${apiUrl()}/api/v1/datasets/${sel}/download?version=${ver}`, { headers: { ...authHeaders() } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dataset_v${ver}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unduh gagal");
    }
  }

  const selDs = datasets.find((d) => d.id === sel);
  return (
    <>
      <h2 className="text-2xl font-bold">Project</h2>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="mt-2 text-sm font-medium text-green-700">{msg}</p>}
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Upload dataset (CSV/XLSX/XLS/SAV/JSON ≤50MB)</h3>
        <form onSubmit={upload} className="mt-2 flex items-center gap-2">
          <input type="file" name="file" className="text-sm" />
          <button type="submit" className={btn}>Upload</button>
        </form>
        {uploadPct != null && (
          <div className="mt-2 h-2 w-full rounded bg-slate-200">
            <div className="h-2 rounded bg-blue-700 transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        )}
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Datasets ({datasets.length})</h3>
        <div className="mt-2 space-y-1">
          {datasets.map((d) => (
            <p key={d.id} className="text-sm">
              <button className={btn2} onClick={() => { setSel(d.id); setVer(1); setPreviewOff(0); }}>{d.filename}</button>{" "}
              {d.rows_count}×{d.cols_count} · v{d.versions.map((v) => v.version_number).join(",")}{" "}
              <span className="text-xs text-slate-400">{d.id.slice(0, 8)}</span>{" "}
              <button className={btn2} onClick={() => void removeDataset(d.id, d.filename)}>Hapus</button>
            </p>
          ))}
        </div>
      </div>
      {selDs && (
        <>
          <div className={`${card} mt-4`}>
            <h3 className={h3}>Preview — {selDs.filename} (v{ver})</h3>
            <p className="mt-2 text-sm">
              <span className="text-slate-500">Version: </span>
              {selDs.versions.map((v) => (
                <button key={v.version_number} className={`${btn2} mr-1`} onClick={() => { setVer(v.version_number); setPreviewOff(0); }}>v{v.version_number}</button>
              ))}{" "}
              <button className={btn2} onClick={() => void downloadVersion()}>Unduh CSV v{ver}</button>
            </p>
            {preview && (
              <>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead><tr>{preview.columns.map((c) => <th key={c} className={th}>{c}</th>)}</tr></thead>
                    <tbody>
                      {preview.rows.map((r, i) => <tr key={i}>{preview.columns.map((c) => <td key={c} className={td}>{String(r[c] ?? "")}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Baris {previewOff + 1}–{previewOff + preview.rows.length} dari {preview.total_rows}{" "}
                  <button className={btn2} disabled={previewOff === 0} onClick={() => { const n = Math.max(0, previewOff - 10); setPreviewOff(n); void loadDetail(sel, ver, n); }}>← Prev</button>{" "}
                  <button className={btn2} disabled={previewOff + 10 >= preview.total_rows} onClick={() => { const n = previewOff + 10; setPreviewOff(n); void loadDetail(sel, ver, n); }}>Next →</button>
                </p>
              </>
            )}
            {profile && (
              <>
                <h3 className={`${h3} mt-4`}>Profil</h3>
                <p className="text-xs text-slate-500">rows {profile.rows} · cols {profile.cols} · missing {profile.missing_pct}% · duplikat {profile.duplicate_rows}</p>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead><tr><th className={th}>Kolom</th><th className={th}>Tipe</th><th className={th}>Missing</th><th className={th}>Unik</th></tr></thead>
                  <tbody>
                    {profile.columns.map((c) => <tr key={c.name}><td className={td}>{c.name}</td><td className={td}>{c.detected_type}</td><td className={td}>{c.missing_count}</td><td className={td}>{c.unique_count}</td></tr>)}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div className={`${card} mt-4`}>
            <h3 className={h3}>Variables (v{ver})</h3>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead><tr><th className={th}>Nama</th><th className={th}>Type</th><th className={th}>Role</th></tr></thead>
              <tbody>
                {variables.map((v) => (
                  <tr key={v.id}>
                    <td className={td}>{v.name}</td>
                    <td className={td}><select className={input} value={v.var_type} onChange={(e) => void saveVar(v, { var_type: e.target.value })}>{VTYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></td>
                    <td className={td}><select className={input} value={v.var_role} onChange={(e) => void saveVar(v, { var_role: e.target.value })}>{VROLES.map((t) => <option key={t} value={t}>{t}</option>)}</select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`${card} mt-4`}>
            <h3 className={h3}>Preprocessing → version baru</h3>
            <form onSubmit={addOp} className="mt-2 flex gap-2">
              <select aria-label="Operasi" className={input} value={op} onChange={(e) => setOp(e.target.value)}>{OPS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <input aria-label="Kolom" className={input} placeholder="kolom" value={opCol} onChange={(e) => setOpCol(e.target.value)} />
              <button type="submit" className={btn2}>Tambah</button>
            </form>
            <input aria-label="Params JSON" className={`${input} mt-2`} placeholder='params JSON, mis. {"strategy":"median"}' value={opParams} onChange={(e) => setOpParams(e.target.value)} />
            {chain.length > 0 && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {chain.map((c, i) => (
                  <li key={i}>{String(c.op)}{c.column ? `(${String(c.column)})` : ""}{" "}
                    <button className="text-red-700 hover:underline" onClick={() => setChain((x) => x.filter((_, j) => j !== i))}>hapus</button>
                  </li>
                ))}
              </ol>
            )}
            <form onSubmit={runPreprocess} className="mt-2">
              <button type="submit" className={btn}>Jalankan {chain.length} operasi (base v{ver})</button>
            </form>
          </div>
        </>
      )}
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Bandingkan version (diff)</h3>
        <form onSubmit={showDiff} className="mt-2 flex gap-2">
          <input aria-label="Dari version" className={input} value={diffFrom} onChange={(e) => setDiffFrom(e.target.value)} />
          <input aria-label="Ke version" className={input} value={diffTo} onChange={(e) => setDiffTo(e.target.value)} />
          <button type="submit" className={btn}>Bandingkan</button>
        </form>
        {diff && (
          <div className="mt-2 text-sm">
            <p>Baris: {diff.rows_from} → {diff.rows_to} (Δ {diff.rows_delta >= 0 ? "+" : ""}{diff.rows_delta})</p>
            <p>Kolom tambah: {diff.columns_added.join(", ") || "-"}</p>
            <p>Kolom hilang: {diff.columns_removed.join(", ") || "-"}</p>
            <table className="mt-2 w-full border-collapse">
              <thead><tr><th className={th}>Kolom</th><th className={th}>Mean awal</th><th className={th}>Mean akhir</th><th className={th}>Missing</th></tr></thead>
              <tbody>
                {diff.numeric_drift.map((d) => (
                  <tr key={d.column}><td className={td}>{d.column}</td><td className={td}>{d.mean_from ?? "-"}</td><td className={td}>{d.mean_to ?? "-"}</td><td className={td}>{d.missing_from}→{d.missing_to}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Run analysis (base v{ver})</h3>
        <form onSubmit={runAnalysis} className="mt-2 space-y-2">
          <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {methodSpec?.variables && (
            <p className="text-xs text-slate-500">Butuh: {Object.entries(methodSpec.variables).map(([k, v]) => `${k} (${v})`).join(", ")}</p>
          )}
          <textarea className={input} rows={3} value={varsJson} onChange={(e) => setVarsJson(e.target.value)} />
          <button type="submit" className={btn}>Run</button>
        </form>
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Pusat Export ({exports.length})</h3>
        {exports.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum ada file. Export dari halaman hasil analisis.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead><tr><th className={th}>Analysis</th><th className={th}>Method</th><th className={th}>Format</th><th className={th}>Waktu</th><th className={th}>Aksi</th></tr></thead>
            <tbody>
              {exports.map((x, i) => (
                <tr key={i}>
                  <td className={`${td} text-xs`}><a className="text-blue-700 hover:underline" href={`/analyses/${x.analysis_uid}`}>{x.analysis_uid}</a></td>
                  <td className={td}>{x.method}</td>
                  <td className={td}>{x.format.toUpperCase()}</td>
                  <td className={`${td} text-xs text-slate-400`}>{x.created_at}</td>
                  <td className={td}><button className={btn2} onClick={() => void downloadExport(x.analysis_uid, x.format)}>Unduh</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className={`${card} mt-4`}>
        <h3 className={h3}>Research Log ({analyses.length})</h3>
        <button className={`${btn2} mt-2`} onClick={downloadLogCsv}>Unduh Log CSV</button>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead><tr><th className={th}>Analysis ID</th><th className={th}>Method</th><th className={th}>Ver</th><th className={th}>Hash</th><th className={th}>Waktu</th></tr></thead>
          <tbody>
            {analyses.map((a) => (
              <tr key={a.analysis_uid}>
                <td className={td}><a className="text-blue-700 hover:underline" href={`/analyses/${a.analysis_uid}`}>{a.analysis_uid}</a></td>
                <td className={td}>{a.method}</td>
                <td className={td}>v{a.dataset_version_number ?? "-"}</td>
                <td className={`${td} text-xs text-slate-400`}>{a.result_hash || "-"}</td>
                <td className={`${td} text-xs text-slate-400`}>{a.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
