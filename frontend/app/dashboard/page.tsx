"use client";
import { useEffect, useState } from "react";
import { api, apiUrl, authHeaders } from "../../lib/api";

type Project = { id: string; title: string; research_type: string; updated_at: string };

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  async function load() {
    try {
      setProjects(await api<Project[]>("/api/v1/projects"));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal memuat");
    }
  }
  useEffect(() => { void load(); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/v1/projects", { method: "POST", body: JSON.stringify({ title }) });
      setTitle("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal membuat");
    }
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api("/api/v1/auth/change-password", { method: "POST", body: JSON.stringify({ old_password: oldPw, new_password: newPw }) });
      setOldPw(""); setNewPw("");
      setMsg("Password berhasil diganti");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal ganti password");
    }
  }
  async function remove(id: string, title: string) {
    if (!window.confirm(`Hapus project "${title}" beserta dataset di dalamnya? Analysis yang sudah ada ikut terhapus via cascade project.`)) return;
    setErr(""); setMsg("");
    try {
      const res = await fetch(`${apiUrl()}/api/v1/projects/${id}`, { method: "DELETE", headers: { ...authHeaders() } });
      if (res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setMsg(`Project "${title}" dihapus`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hapus gagal");
    }
  }
  return (
    <>
      <h2 className="text-2xl font-bold">Dashboard — Projects</h2>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="mt-2 text-sm font-medium text-green-700">{msg}</p>}
      <form onSubmit={create} className="mt-4 flex gap-2">
        <input aria-label="Judul penelitian baru" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" placeholder="Judul penelitian baru" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">New Project</button>
      </form>
      <div className="mt-4 grid gap-3">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <a href={`/projects/${p.id}`} className="font-semibold text-blue-700 hover:underline">{p.title}</a>
            <p className="mt-1 text-xs text-slate-500">{p.research_type} · {p.updated_at} · <button className="text-red-700 hover:underline" onClick={() => void remove(p.id, p.title)}>Hapus</button></p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold">Ganti password</h3>
        <form onSubmit={changePw} className="mt-2 flex gap-2">
          <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" placeholder="Password lama" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
          <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none" placeholder="Baru (min 8)" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button type="submit" className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Ganti</button>
        </form>
      </div>
    </>
  );
}
