"use client";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
      const res = await fetch(`${apiUrlVal.replace(/\/$/, "")}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`);
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
      <h2 className="text-2xl font-bold">Login</h2>
      <Card className="mt-4">
        <CardContent className="space-y-3 pt-5">
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="api-url">API URL</Label>
              <Input id="api-url" value={apiUrlVal} onChange={(e) => setApiUrlVal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <Alert variant="destructive">{err}</Alert>}
            <Button type="submit">Login</Button>
          </form>
          <div className="mt-3 border-t border-slate-200 pt-3 text-center">
            <Button variant="outline" onClick={() => void googleLogin()}>Login dengan Google</Button>
            <p className="mt-1 text-[11px] text-slate-400">Butuh konfigurasi admin (Google Cloud client).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
