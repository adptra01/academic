"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api, apiUrl, authHeaders, downloadExport } from "@/lib/api";
import ProcessRail from "@/components/app/process-rail";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Version = { version_number: number };
type ProjectMeta = {
  id: string;
  title: string;
  description: string | null;
  research_type: string;
  created_at: string;
  updated_at: string;
};
type Dataset = { id: string; filename: string; file_type: string; rows_count: number; cols_count: number; versions: Version[] };
type AnalysisItem = { analysis_uid: string; method: string; created_at: string; dataset_version_number?: number | null; result_hash?: string | null; params?: Record<string, unknown> };
type ExportItem = { analysis_uid: string; method: string; format: string; created_at: string };
type Variable = { id: string; name: string; var_type: string; var_role: string };
type Profile = { rows: number; cols: number; missing_pct: number; duplicate_rows: number; columns: { name: string; detected_type: string; missing_count: number; unique_count: number }[] };
type Diff = { from: number; to: number; rows_from: number; rows_to: number; rows_delta: number; columns_added: string[]; columns_removed: string[]; numeric_drift: { column: string; mean_from: number | null; mean_to: number | null; missing_from: number; missing_to: number }[] };

const METHODS = ["descriptive", "normality", "pearson", "spearman", "ttest_1samp", "ttest_ind", "ttest_paired", "anova_oneway", "chi2_independence", "chi2_gof", "mannwhitney", "wilcoxon", "kruskal", "linreg_simple", "linreg_multiple", "ml_classify", "ml_cluster", "text_tfidf", "text_lda", "apriori"];
const OPS = ["drop_missing", "fill_missing", "remove_outlier_iqr", "scale_standard", "scale_minmax", "transform_log", "transform_sqrt", "mapping", "onehot", "rename", "drop_columns", "text_lowercase", "text_remove_punct", "text_remove_stopwords", "remove_duplicates"];
const VTYPES = ["Numerical", "Ordinal", "Nominal", "Binary", "Text", "Datetime", "ID"];
const VROLES = ["Independent", "Dependent", "Control", "Grouping", "ID", "Ignore"];

/** Tab → nomor tahap pada ProcessRail, supaya rel proses selalu sinkron dengan layar. */
const STAGE_BY_TAB: Record<string, number> = {
  dataset: 2,
  variables: 3,
  preprocess: 4,
  diff: 4,
  analysis: 5,
  log: 6,
  exports: 7,
};

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

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
  const [delTarget, setDelTarget] = useState<Dataset | null>(null);
  const [sources, setSources] = useState<{ id: string; kind: string; provider: string; record_count: number | null; dataset_id: string | null; created_at: string }[]>([]);
  const [srcProvider, setSrcProvider] = useState("generic_rest");
  const [presets, setPresets] = useState<{ id: string; name: string; description: string; example_url: string; table_index: number }[]>([]);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [inspect, setInspect] = useState<{ final_url: string; tables: { index: number; rows: number; cols: number; columns: string[]; sample: Record<string, unknown>[] }[] } | null>(null);
  const [pickTable, setPickTable] = useState(0);
  const [srcConfig, setSrcConfig] = useState('{\n  "url": "https://.../records",\n  "params": {"limit": 100},\n  "records_path": "data.items",\n  "mapping": {"kolom_tujuan": "path.sumber"}\n}');
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [tab, setTab] = useState("dataset");

  async function load() {
    try {
      const ds = await api<Dataset[]>(`/api/v1/projects/${id}/datasets`);
      setDatasets(ds);
      if (!sel && ds[0]) setSel(ds[0].id);
      setAnalyses(await api<AnalysisItem[]>(`/api/v1/projects/${id}/analyses`));
      setExports(await api<ExportItem[]>(`/api/v1/projects/${id}/exports`));
      setSources(await api(`/api/v1/projects/${id}/data-sources`));
      setMeta(await api<ProjectMeta>(`/api/v1/projects/${id}`));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setLoading(false);
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
    api<typeof presets>(`/api/v1/scraper/presets`).then(setPresets).catch(() => setPresets([]));
  }, []);
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

  async function inspectTables() {
    setErr(""); setMsg(""); setInspect(null);
    try {
      setInspect(await api(`/api/v1/scraper/inspect`, { method: "POST", body: JSON.stringify({ url: scrapeUrl || undefined }) }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Inspect gagal");
    }
  }

  async function fetchSource(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      const config = srcProvider === "html_table" && !advanced
        ? { url: scrapeUrl, table_index: pickTable }
        : JSON.parse(srcConfig);
      const kind = srcProvider === "html_table" ? "scraper" : "api";
      const j = await api<{ dataset_id: string; profile: { rows: number; cols: number } }>(`/api/v1/projects/${id}/data-sources/fetch`, {
        method: "POST", body: JSON.stringify({ kind, provider: srcProvider, config }),
      });
      setMsg(`Import OK: ${j.profile.rows} rows → dataset ${j.dataset_id.slice(0, 8)} (provenance tersimpan)`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Fetch gagal");
    }
  }

  async function removeDataset() {
    if (!delTarget) return;
    setErr(""); setMsg("");
    try {
      const res = await fetch(`${apiUrl()}/api/v1/datasets/${delTarget.id}`, { method: "DELETE", headers: { ...authHeaders() } });
      if (res.status !== 204) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      setMsg(`Dataset ${delTarget.filename} dihapus`);
      if (sel === delTarget.id) { setSel(""); setPreview(null); setProfile(null); setVariables([]); }
      setDelTarget(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hapus gagal");
      setDelTarget(null);
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
  const [loading, setLoading] = useState(true);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="ring-accent inline-flex items-center gap-1.5 rounded-sm text-[11.5px] font-medium text-ink-3 hover:text-accent"
          >
            <ChevronLeft size={12} strokeWidth={1.5} aria-hidden="true" />
            Dashboard
          </Link>
          <h1 className="mt-2 truncate text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">
            {loading ? (
              <span className="shimmer inline-block h-7 w-72 rounded-sm bg-paper-3 align-middle" />
            ) : (
              (meta?.title ?? "Project")
            )}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {meta && <Badge variant="info">{meta.research_type}</Badge>}
            <span className="tnum text-[11.5px] text-ink-4">
              {loading
                ? "memuat…"
                : `${datasets.length} dataset · ${analyses.length} analisis · ${exports.length} export`}
            </span>
          </div>
          {meta?.description && (
            <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-ink-2">
              {meta.description}
            </p>
          )}
        </div>
        <Link
          href="/alur"
          className="ring-accent shrink-0 rounded-md border border-rule-2 px-3 py-2 text-[12px] font-medium text-ink hover:border-ink-4 hover:bg-paper-2"
        >
          Panduan alur
        </Link>
      </div>

      {/* Tahap aktif mengikuti tab yang sedang dibuka — DNA project → export. */}
      <ProcessRail
        className="mt-6"
        current={STAGE_BY_TAB[tab] ?? 1}
        hrefFor={(key) => (key === "project" ? "/dashboard" : undefined)}
      />

      {err && <Alert variant="destructive" className="mt-5">{err}</Alert>}
      {msg && <Alert variant="success" className="mt-5">{msg}</Alert>}

      {!selDs && (
        <section className="mt-7 grid gap-x-10 gap-y-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rounded-lg border border-rule bg-paper p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">
                  Unggah dataset
                </h2>
                <span className="tnum text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                  langkah 02
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
                CSV, XLSX, XLS, SAV, atau JSON — maksimal 50&nbsp;MB. File
                diunggah apa adanya; delimiter dan header dideteksi otomatis.
              </p>
              <form onSubmit={upload} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ds-file">Berkas dataset</Label>
                  <Input id="ds-file" type="file" name="file" accept=".csv,.xlsx,.xls,.sav,.json" />
                </div>
                {uploadPct != null ? (
                  <div className="space-y-1.5">
                    <Progress value={uploadPct} />
                    <p className="tnum text-[11px] text-ink-3">Mengunggah {uploadPct}%</p>
                  </div>
                ) : (
                  <Button type="submit">Unggah dataset</Button>
                )}
              </form>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-lg border border-dashed border-rule-2 px-5 py-10 text-center">
              <span
                aria-hidden="true"
                className="mx-auto block h-7 w-7 border border-rule-2"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(-45deg, var(--color-paper-3) 0 1px, transparent 1px 6px)",
                }}
              />
              <p className="mt-4 text-[13.5px] font-medium text-ink">Belum ada dataset</p>
              <p className="mx-auto mt-1.5 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-3">
                Tujuh tahap berikutnya — variabel, pembersihan, analisis, hasil,
                dan ekspor — baru terbuka setelah ada data yang bisa dibaca.
              </p>
            </div>
          </div>
        </section>
      )}

      {datasets.length > 0 && (
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2.5">
          <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">
            Dataset
          </h2>
          <span className="tnum text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
            {datasets.length} berkas
          </span>
        </div>
        {loading ? (
          <ul className="divide-y divide-rule" aria-busy="true">
            {[0, 1].map((i) => (
              <li key={i} className="flex items-center gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="shimmer h-4 w-52 rounded-sm bg-paper-3" />
                  <div className="shimmer mt-2 h-3 w-40 rounded-sm bg-paper-3" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
        <ul className="divide-y divide-rule">
          {datasets.map((d) => {
            const active = d.id === sel;
            return (
              <li key={d.id} className="flex items-center gap-4 py-3">
                <button
                  type="button"
                  onClick={() => { setSel(d.id); setVer(1); setPreviewOff(0); }}
                  aria-current={active ? "true" : undefined}
                  className={`pressable ring-accent min-w-0 flex-1 rounded-sm text-left ${
                    active ? "text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  <span className="block truncate text-[13.5px] font-medium">{d.filename}</span>
                  <span className="tnum mt-1 block text-[11px] text-ink-4">
                    {d.rows_count}×{d.cols_count} ·{" "}
                    {d.versions.length > 0
                      ? `v${d.versions.map((v) => v.version_number).join(", ")}`
                      : "tanpa versi"}{" "}
                    · {d.file_type.toUpperCase()} · {d.id.slice(0, 8)}
                  </span>
                </button>
                {active && <Badge variant="success">dipakai</Badge>}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDelTarget(d)}
                  aria-label={`Hapus dataset ${d.filename}`}
                >
                  Hapus
                </Button>
              </li>
            );
          })}
        </ul>
        )}
      </section>
      )}
      <Dialog open={!!delTarget} onOpenChange={(o) => { if (!o) setDelTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus dataset?</DialogTitle>
            <DialogDescription>{delTarget?.filename} beserta semua versinya akan dihapus. Ditolak server jika sudah ada analysis.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => void removeDataset()}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <details className="group mt-4 rounded-lg border border-rule bg-paper">
        <summary className="ring-accent flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <span className="flex items-center gap-2.5">
            <span className="text-ink-4 transition-transform duration-200 group-open:rotate-90">›</span>
            <span className="text-[13.5px] font-semibold tracking-tight text-ink">
              Import via API atau scraper
            </span>
          </span>
          <span className="tnum text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
            opsional
          </span>
        </summary>
        <div className="border-t border-rule px-5 py-5">
          <form onSubmit={fetchSource} className="space-y-2">
            <Select value={srcProvider} onValueChange={setSrcProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="generic_rest">API generik (REST JSON)</SelectItem>
                <SelectItem value="youtube">YouTube Data API (OAuth/API key)</SelectItem>
                <SelectItem value="html_table">Scraper tabel HTML (allowlist)</SelectItem>
              </SelectContent>
            </Select>
            {srcProvider === "html_table" && !advanced ? (
              <>
                <select aria-label="Preset" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value="" onChange={(e) => {
                  const pr = presets.find((x) => x.id === e.target.value);
                  if (pr) { setScrapeUrl(pr.example_url); }
                }}>
                  <option value="">— Pilih preset (opsional) —</option>
                  {presets.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} — {pr.description}</option>)}
                </select>
                <div className="flex gap-2">
                  <Input placeholder="https://domain-allowlisted/halaman" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} aria-label="URL halaman" />
                  <Button type="button" variant="secondary" onClick={() => void inspectTables()}>Cek tabel</Button>
                </div>
                {inspect && (
                  <div className="space-y-2">
                    {inspect.tables.map((t) => (
                      <label key={t.index} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                        <input type="radio" name="picktable" checked={pickTable === t.index} onChange={() => setPickTable(t.index)} className="mt-1" />
                        <span>
                          <strong>Tabel {t.index}</strong> — {t.rows}×{t.cols} · {t.columns.slice(0, 6).join(", ")}
                          {t.sample[0] && <span className="tnum block text-[11px] text-ink-3">{JSON.stringify(t.sample[0]).slice(0, 120)}</span>}
                        </span>
                      </label>
                    ))}
                    {inspect.tables.length === 0 && <p className="text-[12.5px] text-ink-3">Tidak ada tabel di halaman ini.</p>}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button type="submit">Fetch → dataset versioned</Button>
                  <button type="button" className="ring-accent rounded-sm text-[11.5px] font-medium text-accent hover:text-accent-2" onClick={() => setAdvanced(true)}>Mode advanced (JSON)</button>
                </div>
              </>
            ) : (
              <>
                <Textarea rows={6} value={srcConfig} onChange={(e) => setSrcConfig(e.target.value)} />
                <div className="flex items-center gap-2">
                  <Button type="submit">Fetch → dataset versioned</Button>
                  {srcProvider === "html_table" && <button type="button" className="ring-accent rounded-sm text-[11.5px] font-medium text-accent hover:text-accent-2" onClick={() => setAdvanced(false)}>Kembali ke wizard</button>}
                </div>
              </>
            )}
          </form>
          {sources.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>Sumber</TableHead><TableHead>Records</TableHead><TableHead>Dataset</TableHead><TableHead>Waktu</TableHead></TableRow></TableHeader>
              <TableBody>
                {sources.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>{x.kind}:{x.provider}</TableCell>
                    <TableCell>{x.record_count ?? "-"}</TableCell>
                    <TableCell className="tnum text-[11px] text-ink-4">{x.dataset_id?.slice(0, 8) || "-"}</TableCell>
                    <TableCell className="tnum text-[11px] text-ink-4">{x.created_at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </details>
      {selDs && (
        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList>
            <TabsTrigger value="dataset">Dataset</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="preprocess">Preprocess</TabsTrigger>
            <TabsTrigger value="diff">Diff</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="exports">Export</TabsTrigger>
          </TabsList>
          <TabsContent value="dataset">
            <Card>
              <CardHeader><CardTitle>Preview — {selDs.filename} (v{ver})</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">
                  <span className="text-slate-500">Version: </span>
                  {selDs.versions.map((v) => (
                    <Button key={v.version_number} size="sm" variant="secondary" className="mr-1" onClick={() => { setVer(v.version_number); setPreviewOff(0); }}>v{v.version_number}</Button>
                  ))}{" "}
                  <Button size="sm" variant="secondary" onClick={() => void downloadVersion()}>Unduh CSV v{ver}</Button>
                </p>
                {preview && (
                  <>
                    <Table>
                      <TableHeader><TableRow>{preview.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
                      <TableBody>
                        {preview.rows.map((r, i) => <TableRow key={i}>{preview.columns.map((c) => <TableCell key={c}>{String(r[c] ?? "")}</TableCell>)}</TableRow>)}
                      </TableBody>
                    </Table>
                    <p className="tnum mt-1 text-[11.5px] text-ink-3">
                      Baris {previewOff + 1}–{previewOff + preview.rows.length} dari {preview.total_rows}{" "}
                      <Button size="sm" variant="secondary" disabled={previewOff === 0} onClick={() => { const n = Math.max(0, previewOff - 10); setPreviewOff(n); void loadDetail(sel, ver, n); }}>← Prev</Button>{" "}
                      <Button size="sm" variant="secondary" disabled={previewOff + 10 >= preview.total_rows} onClick={() => { const n = previewOff + 10; setPreviewOff(n); void loadDetail(sel, ver, n); }}>Next →</Button>
                    </p>
                  </>
                )}
                {profile && (
                  <>
                    <h3 className="mt-4 text-base font-semibold">Profil</h3>
                    <p className="tnum text-[11.5px] text-ink-3">rows {profile.rows} · cols {profile.cols} · missing {profile.missing_pct}% · duplikat {profile.duplicate_rows}</p>
                    <Table>
                      <TableHeader><TableRow><TableHead>Kolom</TableHead><TableHead>Tipe</TableHead><TableHead>Missing</TableHead><TableHead>Unik</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {profile.columns.map((c) => <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell><Badge>{c.detected_type}</Badge></TableCell><TableCell>{c.missing_count}</TableCell><TableCell>{c.unique_count}</TableCell></TableRow>)}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="variables">
            <Card>
              <CardHeader><CardTitle>Variables (v{ver})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Type</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {variables.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.name}</TableCell>
                        <TableCell>
                          <Select value={v.var_type} onValueChange={(x) => void saveVar(v, { var_type: x })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{VTYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={v.var_role} onValueChange={(x) => void saveVar(v, { var_role: x })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{VROLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="preprocess">
            <Card>
              <CardHeader><CardTitle>Preprocessing → version baru</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={addOp} className="flex gap-2">
                  <Select value={op} onValueChange={setOp}>
                    <SelectTrigger aria-label="Operasi"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input aria-label="Kolom" placeholder="kolom" value={opCol} onChange={(e) => setOpCol(e.target.value)} />
                  <Button type="submit" variant="secondary">Tambah</Button>
                </form>
                <Input aria-label="Params JSON" className="mt-2" placeholder='params JSON, mis. {"strategy":"median"}' value={opParams} onChange={(e) => setOpParams(e.target.value)} />
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
                  <Button type="submit">Jalankan {chain.length} operasi (base v{ver})</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="diff">
            <Card>
              <CardHeader><CardTitle>Bandingkan version (diff)</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={showDiff} className="flex gap-2">
                  <Input aria-label="Dari version" value={diffFrom} onChange={(e) => setDiffFrom(e.target.value)} />
                  <Input aria-label="Ke version" value={diffTo} onChange={(e) => setDiffTo(e.target.value)} />
                  <Button type="submit">Bandingkan</Button>
                </form>
                {diff && (
                  <div className="mt-2 text-sm">
                    <p>Baris: {diff.rows_from} → {diff.rows_to} (Δ {diff.rows_delta >= 0 ? "+" : ""}{diff.rows_delta})</p>
                    <p>Kolom tambah: {diff.columns_added.join(", ") || "-"}</p>
                    <p>Kolom hilang: {diff.columns_removed.join(", ") || "-"}</p>
                    <Table>
                      <TableHeader><TableRow><TableHead>Kolom</TableHead><TableHead>Mean awal</TableHead><TableHead>Mean akhir</TableHead><TableHead>Missing</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {diff.numeric_drift.map((d) => (
                          <TableRow key={d.column}><TableCell>{d.column}</TableCell><TableCell>{d.mean_from ?? "-"}</TableCell><TableCell>{d.mean_to ?? "-"}</TableCell><TableCell>{d.missing_from}→{d.missing_to}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="analysis">
            <Card>
              <CardHeader><CardTitle>Run analysis (base v{ver})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <form onSubmit={runAnalysis} className="space-y-2">
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  {methodSpec?.variables && (
                    <p className="tnum text-[11.5px] text-ink-3">Butuh: {Object.entries(methodSpec.variables).map(([k, v]) => `${k} (${v})`).join(", ")}</p>
                  )}
                  <Textarea rows={3} value={varsJson} onChange={(e) => setVarsJson(e.target.value)} />
                  <Button type="submit">Run</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="log">
            <Card>
              <CardHeader><CardTitle>Research Log ({analyses.length})</CardTitle></CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={downloadLogCsv}>Unduh Log CSV</Button>
                <Table>
                  <TableHeader><TableRow><TableHead>Analysis ID</TableHead><TableHead>Method</TableHead><TableHead>Ver</TableHead><TableHead>Hash</TableHead><TableHead>Waktu</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {analyses.map((a) => (
                      <TableRow key={a.analysis_uid}>
                        <TableCell><Link className="ring-accent text-accent hover:text-accent-2" href={`/analyses/${a.analysis_uid}`}>{a.analysis_uid}</Link></TableCell>
                        <TableCell><Badge variant="info">{a.method}</Badge></TableCell>
                        <TableCell>v{a.dataset_version_number ?? "-"}</TableCell>
                        <TableCell className="tnum text-[11px] text-ink-4">{a.result_hash || "-"}</TableCell>
                        <TableCell className="tnum text-[11px] text-ink-4">{a.created_at}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="exports">
            <Card>
              <CardHeader><CardTitle>Pusat Export ({exports.length})</CardTitle></CardHeader>
              <CardContent>
                {exports.length === 0 ? (
                  <p className="text-[12.5px] text-ink-3">Belum ada file. Export dari halaman hasil analisis.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Analysis</TableHead><TableHead>Method</TableHead><TableHead>Format</TableHead><TableHead>Waktu</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {exports.map((x, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs"><Link className="ring-accent text-accent hover:text-accent-2" href={`/analyses/${x.analysis_uid}`}>{x.analysis_uid}</Link></TableCell>
                          <TableCell>{x.method}</TableCell>
                          <TableCell><Badge>{x.format.toUpperCase()}</Badge></TableCell>
                          <TableCell className="tnum text-[11px] text-ink-4">{x.created_at}</TableCell>
                          <TableCell><Button size="sm" variant="secondary" onClick={() => void downloadExport(x.analysis_uid, x.format)}>Unduh</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
