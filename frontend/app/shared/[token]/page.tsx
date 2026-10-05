"use client";
import { useEffect, useState } from "react";
import { apiUrl } from "../../../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Alert } from "../../../components/ui/badge";

type Shared = {
  analysis_uid: string; method: string; variables: Record<string, unknown>;
  dataset: { filename: string | null; version: number | null };
  result: { method_name?: string; statistics?: Record<string, unknown>; decision?: { text: string } | null; interpretation?: string } | null;
  result_hash: string; software_version: string; timestamp: string;
};

export default function SharedPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [d, setD] = useState<Shared | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`${apiUrl()}/public/shared/${token}`)
      .then(async (r) => { if (!r.ok) throw new Error("Link tidak valid / dicabut / kedaluwarsa"); return r.json(); })
      .then(setD)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Gagal"));
  }, [token]);
  if (err) return <Alert variant="destructive">{err}</Alert>;
  if (!d) return <p className="text-slate-500">Memuat...</p>;
  return (
    <>
      <h2 className="text-2xl font-bold">{d.result?.method_name || d.method}</h2>
      <p className="mt-1 text-xs text-slate-500">Tautan publik read-only · {d.analysis_uid} · dataset {d.dataset.filename} v{d.dataset.version}</p>
      <Card className="mt-4">
        <CardHeader><CardTitle>Hasil</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">Keputusan: <Badge variant={d.result?.decision?.text === "Tolak H0" ? "destructive" : "success"}>{d.result?.decision?.text || "-"}</Badge></p>
          <p className="mt-2 text-sm leading-6">{d.result?.interpretation}</p>
          <p className="mt-2 text-xs text-slate-500">hash: {d.result_hash?.slice(0, 16)}… · {d.software_version} · {d.timestamp}</p>
        </CardContent>
      </Card>
    </>
  );
}
