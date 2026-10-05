"use client";
import { useEffect, useState } from "react";
import { api, apiUrl, authHeaders } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Alert } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";

type Project = { id: string; title: string; research_type: string; updated_at: string };

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [delTarget, setDelTarget] = useState<Project | null>(null);
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
  async function remove() {
    if (!delTarget) return;
    setErr(""); setMsg("");
    try {
      const res = await fetch(`${apiUrl()}/api/v1/projects/${delTarget.id}`, { method: "DELETE", headers: { ...authHeaders() } });
      if (res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setMsg(`Project "${delTarget.title}" dihapus`);
      setDelTarget(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hapus gagal");
      setDelTarget(null);
    }
  }
  return (
    <>
      <h2 className="text-2xl font-bold">Dashboard — Projects</h2>
      {err && <Alert variant="destructive" className="mt-2">{err}</Alert>}
      {msg && <Alert variant="success" className="mt-2">{msg}</Alert>}
      <form onSubmit={create} className="mt-4 flex gap-2">
        <Input aria-label="Judul penelitian baru" className="flex-1" placeholder="Judul penelitian baru" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit">New Project</Button>
      </form>
      <div className="mt-4 grid gap-3">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between pt-5">
              <div>
                <a href={`/projects/${p.id}`} className="font-semibold text-blue-700 hover:underline">{p.title}</a>
                <p className="mt-1 text-xs text-slate-500"><Badge variant="info">{p.research_type}</Badge> · {p.updated_at}</p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => setDelTarget(p)}>Hapus</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!delTarget} onOpenChange={(o) => { if (!o) setDelTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus project?</DialogTitle>
            <DialogDescription>{delTarget?.title} beserta dataset di dalamnya akan dihapus. Analysis ikut terhapus via cascade.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => void remove()}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="mt-8">
        <CardHeader><CardTitle>Ganti password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={changePw} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="old">Password lama</Label>
              <Input id="old" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="new">Baru (min 8)</Label>
              <Input id="new" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary" className="self-end">Ganti</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
