"use client";
import { useEffect, useState } from "react";
import { apiUrl, fetchWithContext } from "@/lib/api";
import { Alert } from "@/components/ui/badge";

/** Callback OAuth Google: tukar ?code= menjadi sesi JWT internal. */
export default function GoogleCallbackPage() {
  const [err, setErr] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setErr("Tidak ada authorization code dari Google.");
      return;
    }
    fetchWithContext(`${apiUrl()}/api/v1/auth/google/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`);
        window.localStorage.setItem("token", j.access_token);
        window.location.href = "/dashboard";
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Callback gagal"));
  }, []);
  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-2xl font-bold">Login Google</h2>
      {err ? <Alert variant="destructive" className="mt-4">{err}</Alert> : <p className="mt-4 text-sm text-slate-500">Memverifikasi dengan Google...</p>}
    </div>
  );
}
