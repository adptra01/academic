"use client";
import { useState } from "react";
import { apiUrl } from "../../lib/api";

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none";
const btn = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetch(`${apiUrl()}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`);
      window.localStorage.setItem("token", j.access_token);
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Registrasi gagal");
    }
  }
  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-2xl font-bold">Register</h2>
      <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <input className={input} placeholder="Nama" aria-label="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} placeholder="Password (min 8)" aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-sm text-red-700">{err}</p>}
        <button type="submit" className={btn}>Register</button>
      </form>
    </div>
  );
}
