"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { apiUrl, fetchWithContext } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiUrlVal, setApiUrlVal] = useState("");
  const [err, setErr] = useState("");
  async function googleLogin() {
    setErr("");
    try {
      const { api } = await import("@/lib/api");
      const j = await api<{ url: string }>(`/api/v1/auth/google/url`);
      window.location.href = j.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login Google gagal dimulai");
    }
  }
  useEffect(() => {
    setApiUrlVal(window.localStorage.getItem("api_url") || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100");
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      window.localStorage.setItem("api_url", apiUrlVal.replace(/\/$/, ""));
      const res = await fetchWithContext(`${apiUrlVal.replace(/\/$/, "")}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let j: { detail?: string; access_token?: string; user?: { name?: string; email?: string } };
      try {
        j = await res.json();
      } catch {
        throw new Error(
          `Server membalas ${res.status} tanpa JSON. Cek ${apiUrlVal}/health — ` +
            `untuk DDEV host-side biasanya http://localhost:8100.`
        );
      }
      if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`);
      if (!j.access_token) throw new Error("Server tidak mengembalikan access_token");
      window.localStorage.setItem("token", j.access_token);
      // Simpan profil supaya shell konsol bisa menyapa nama, bukan hanya "Logout".
      if (j.user) window.localStorage.setItem("user", JSON.stringify(j.user));
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login gagal");
    }
  }
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">Masuk</h1>
      <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-ink-2">
        Satu akun untuk menyimpan dataset, variabel, dan riwayat analisis
        penelitian Anda.
      </p>

      <form onSubmit={submit} className="mt-6 max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@kampus.ac.id"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {err && <Alert variant="destructive">{err}</Alert>}

        <Button type="submit" size="lg" className="w-full">
          Masuk
        </Button>
      </form>

      <p className="mt-4 text-[12.5px] text-ink-3">
        Belum punya akun?{" "}
        <Link href="/register" className="ring-accent rounded-sm font-medium text-accent hover:text-accent-2">
          Daftar
        </Link>
      </p>

      <div className="mt-8 max-w-sm border-t border-rule pt-5">
        <Button variant="outline" className="w-full" onClick={() => void googleLogin()}>
          Masuk dengan Google
        </Button>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-4">
          Membutuhkan konfigurasi Google Cloud client di sisi server. Tanpa itu,
          backend membalas 501.
        </p>
      </div>

      {/* Diagnostik: saat "Failed to fetch" muncul,_resolution-nya hampir selalu
          ada di URL ini, jadi jangan disembunyikan. */}
      <details className="mt-6 max-w-sm">
        <summary className="ring-accent cursor-pointer list-none text-[11.5px] font-medium text-ink-3 hover:text-ink">
          API tidak bisa dihubungi?
        </summary>
        <div className="mt-3 space-y-3 rounded-md border border-rule bg-paper p-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">URL API</Label>
            <Input
              id="api-url"
              value={apiUrlVal}
              onChange={(e) => setApiUrlVal(e.target.value)}
              aria-describedby="api-url-help"
            />
            <p id="api-url-help" className="text-[11.5px] leading-relaxed text-ink-4">
              DDEV memetakan backend container ke host{" "}
              <span className="tnum text-ink-3">localhost:8100</span> — bukan 8000.
              Cek <span className="tnum">{apiUrlVal}/health</span> di tab baru.
            </p>
          </div>
          <a
            href={`${apiUrlVal}/health`}
            target="_blank"
            rel="noreferrer"
            className="ring-accent inline-flex items-center gap-1.5 rounded-sm text-[11.5px] font-medium text-accent hover:text-accent-2"
          >
            Buka /health
            <ArrowUpRight size={12} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>
      </details>
    </div>
  );
}
