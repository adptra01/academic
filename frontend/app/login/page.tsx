"use client";
import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none";
const btn = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiUrlVal, setApiUrlVal] = useState("");
  const [err, setErr] = useState("");
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
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login gagal");
    }
  }
  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-2xl font-bold">Login</h2>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <input className={input} placeholder="API URL" aria-label="API URL" value={apiUrlVal} onChange={(e) => setApiUrlVal(e.target.value)} />
        <input className={input} placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} placeholder="Password" aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-sm text-red-700">{err}</p>}
        <button type="submit" className={btn}>Login</button>
      </form>
    </div>
  );
}
