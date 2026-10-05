"use client";
import { useEffect, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import dynamic from "next/dynamic";
import { api, apiUrl, apaStyle, authHeaders, downloadExport } from "../../../lib/api";
import type { Viz } from "../../../components/EChartView";

const EChartView = dynamic(() => import("../../../components/EChartView"), { ssr: false });
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Alert } from "../../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "../../../components/ui/select";

type Detail = {
  analysis_uid: string; method: string; variables: Record<string, unknown>; params: Record<string, unknown>;
  dataset_filename?: string | null; dataset_version_number?: number | null;
  result: { method_name?: string; n?: number; statistics?: Record<string, unknown>; assumptions?: { name: string; passed?: boolean | null; p_value?: number; note?: string }[]; decision?: { text: string; p?: number; alpha?: number } | null; effect_size?: Record<string, unknown> | null; parameters?: Record<string, unknown>; formula_latex?: string; calculation?: string[]; interpretation?: string; warnings?: string[] };
  result_hash: string; software_version: string; timestamp: string;
};

const CHARTS = ["histogram", "boxplot", "scatter", "bar", "residual", "qq", "confusion", "roc", "cluster", "dendrogram", "topics", "topterms", "rules"];
const FBCATS = [["statistical_result", "Hasil statistik"], ["assumption", "Asumsi"], ["formula", "Formula"], ["data_processing", "Data processing"], ["export", "Export"], ["ui", "UI"], ["other", "Lainnya"]];
const EXPORTS = ["csv", "xlsx", "pdf", "docx", "tex", "json"] as const;

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
    <Table>
      <TableHeader><TableRow><TableHead>Key</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
      <TableBody>
        {flatten(data).map(([k, v]) => <TableRow key={k}><TableCell><code>{k}</code></TableCell><TableCell>{v}</TableCell></TableRow>)}
      </TableBody>
    </Table>
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
  const [chartType, setChartType] = useState("default");
  const [chartCol, setChartCol] = useState("all");
  const [chartUrl, setChartUrl] = useState("");
  const [vizMode, setVizMode] = useState<"png" | "echarts">("png");
  const [viz, setViz] = useState<Viz | null>(null);
  const [vizErr, setVizErr] = useState("");
  const [rerunMsg, setRerunMsg] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<Detail>(`/api/v1/analyses/${uid}`).then(setD).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Gagal"));
  }, [uid]);
  useEffect(() => {
    if (vizMode !== "png") return;
    let url = "";
    const qs = new URLSearchParams();
    if (chartType && chartType !== "default") qs.set("type", chartType);
    if (chartCol && chartCol !== "all") qs.set("column", chartCol);
    const q = qs.toString() ? `?${qs.toString()}` : "";
    fetch(`${apiUrl()}/api/v1/analyses/${uid}/chart${q}`, { headers: { ...authHeaders() } })
      .then((res) => { if (!res.ok) throw new Error(`Chart HTTP ${res.status}`); return res.blob(); })
      .then((blob) => { url = URL.createObjectURL(blob); setChartUrl(url); })
      .catch(() => setChartUrl(""));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [uid, chartType, chartCol, vizMode]);
  useEffect(() => {
    if (vizMode !== "echarts") return;
    setVizErr("");
    const qs = new URLSearchParams();
    if (chartType && chartType !== "default") qs.set("type", chartType);
    if (chartCol && chartCol !== "all") qs.set("column", chartCol);
    api<Viz>(`/api/v1/analyses/${uid}/viz${qs.toString() ? `?${qs.toString()}` : ""}`)
      .then(setViz)
      .catch((e: unknown) => setVizErr(e instanceof Error ? e.message : "Viz gagal"));
  }, [uid, chartType, chartCol, vizMode]);
  if (err) return <Alert variant="destructive">{err}</Alert>;
  if (!d) return <p className="text-slate-500">Memuat...</p>;
  const r = d.result;
  const reject = r.decision?.text === "Tolak H0";
  const descCols = d.method === "descriptive" && Array.isArray((d.variables as Record<string, unknown>).columns)
    ? ((d.variables as Record<string, unknown>).columns as unknown[]).map(String) : [];
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
      <Card className="mt-4">
        <CardContent className="pt-5">
          <p className="text-sm">Keputusan: <Badge variant={reject ? "destructive" : "success"}>{r.decision?.text || "-"}</Badge> <span className="text-xs text-slate-500">(α = {r.decision?.alpha ?? "-"})</span></p>
          <p className="mt-2 text-sm leading-6">{r.interpretation}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => { void navigator.clipboard.writeText(apaStyle(r as unknown as Record<string, unknown>)); setCopied(true); }}>
            {copied ? "Tersalin!" : "Copy APA-style"}
          </Button>
        </CardContent>
      </Card>
      <Tabs defaultValue="hasil" className="mt-4">
        <TabsList>
          <TabsTrigger value="hasil">Hasil</TabsTrigger>
          <TabsTrigger value="grafik">Grafik</TabsTrigger>
          <TabsTrigger value="formula">Formula</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="repro">Repro</TabsTrigger>
          <TabsTrigger value="lapor">Lapor</TabsTrigger>
        </TabsList>
        <TabsContent value="hasil">
          <Card>
            <CardHeader><CardTitle>Tabel statistik (n = {String(r.n ?? "-")})</CardTitle></CardHeader>
            <CardContent>
              <StatTable data={r.statistics} />
              {r.effect_size && (<><h3 className="mt-4 text-base font-semibold">Effect size</h3><StatTable data={r.effect_size} /></>)}
            </CardContent>
          </Card>
          {(r.assumptions || []).length > 0 && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Asumsi</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Asumsi</TableHead><TableHead>Status</TableHead><TableHead>Catatan</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(r.assumptions || []).map((a, i) => (
                      <TableRow key={i}>
                        <TableCell>{a.name}{a.p_value != null ? ` (p=${Number(a.p_value).toFixed(4)})` : ""}</TableCell>
                        <TableCell>{a.passed == null ? <span className="text-slate-400">cek manual</span> : <Badge variant={a.passed ? "success" : "destructive"}>{a.passed ? "PASS" : "FAIL"}</Badge>}</TableCell>
                        <TableCell className="text-xs text-slate-500">{a.note || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="grafik">
          <Card>
            <CardHeader><CardTitle>Grafik akademik</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant={vizMode === "png" ? "default" : "secondary"} onClick={() => setVizMode("png")}>Statis (PNG)</Button>
                <Button size="sm" variant={vizMode === "echarts" ? "default" : "secondary"} onClick={() => setVizMode("echarts")}>Interaktif</Button>
              </div>
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  {CHARTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {descCols.length > 1 && (
                <Select value={chartCol} onValueChange={setChartCol}>
                  <SelectTrigger aria-label="Kolom grafik"><SelectValue placeholder="Semua (kolom pertama)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua (kolom pertama)</SelectItem>
                    {descCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {vizMode === "png" ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {chartUrl ? <img className="chart" src={chartUrl} alt="chart" /> : <p className="text-xs text-slate-500">Memuat grafik...</p>}
                </>
              ) : viz ? (
                <EChartView viz={viz} />
              ) : (
                <p className="text-xs text-slate-500">{vizErr || "Memuat grafik interaktif..."}</p>
              )}
              {chartUrl && <a className="inline-block text-sm text-blue-700 hover:underline" href={chartUrl} download={`${uid}.png`}>Unduh PNG grafik</a>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="formula">
          <Card>
            <CardHeader><CardTitle>Formula</CardTitle></CardHeader>
            <CardContent>
              <Formula latex={r.formula_latex} />
              <h3 className="mt-4 text-base font-semibold">Parameters & variables</h3>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-3 text-xs">{JSON.stringify({ variables: d.variables, params: d.params }, null, 2)}</pre>
              <h3 className="mt-4 text-base font-semibold">Calculation</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{(r.calculation || []).map((c, i) => <li key={i}>{c}</li>)}</ol>
              {(r.warnings || []).length > 0 && <><h3 className="mt-4 text-base font-semibold">Warnings</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{r.warnings!.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="export">
          <Card>
            <CardHeader><CardTitle>Export</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {EXPORTS.map((f) => (
                  <Button key={f} variant="secondary" size="sm" onClick={() => void downloadExport(uid, f)}>Unduh {f.toUpperCase()}</Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="repro">
          <Card>
            <CardHeader><CardTitle>Reproducibility</CardTitle></CardHeader>
            <CardContent>
              <Button variant="secondary" size="sm" onClick={() => void rerun()}>Rerun (verifikasi identik)</Button>
              {rerunMsg && <p className="mt-2 text-sm text-slate-700">{rerunMsg}</p>}
              <p className="mt-1 text-xs text-slate-500">hash: {d.result_hash.slice(0, 16)}… · {d.software_version} · {d.timestamp}</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="lapor">
          <Card>
            <CardHeader><CardTitle>Report a Problem</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">Terkirim bersama {d.analysis_uid} · dataset v{d.dataset_version_number ?? "-"} — tim dapat mereproduksi langsung.</p>
              <form onSubmit={sendFeedback} className="mt-2 space-y-2">
                <Select value={fbCat} onValueChange={setFbCat}>
                  <SelectTrigger aria-label="Kategori"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["statistical_result", "Hasil statistik"], ["assumption", "Asumsi"], ["formula", "Formula"], ["data_processing", "Data processing"], ["export", "Export"], ["ui", "UI"], ["other", "Lainnya"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea aria-label="Deskripsi masalah" rows={3} placeholder="Jelaskan masalahnya (min 10 karakter)..." value={fbDesc} onChange={(e) => setFbDesc(e.target.value)} />
                <Button type="submit" variant="secondary" size="sm">Kirim laporan</Button>
              </form>
              {fbMsg && <p className="mt-2 text-sm text-slate-700">{fbMsg}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
