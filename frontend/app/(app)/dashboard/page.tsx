"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { api, apiUrl, authHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge, Alert } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ProcessRail from "@/components/app/process-rail";

type Project = {
  id: string;
  title: string;
  description: string | null;
  research_type: string;
  created_at: string;
  updated_at: string;
};

/** Nilai yang diizinkan backend: `^(Skripsi|Tesis|Disertasi|Paper|Lainnya)$`. */
const TYPES = ["Skripsi", "Tesis", "Disertasi", "Paper", "Lainnya"] as const;

/** Tanggal ISO → "12 Okt 2026". Sengaja tanpa library date. */
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [researchType, setResearchType] = useState<string>("Skripsi");
  const [creating, setCreating] = useState(false);
  const [titleError, setTitleError] = useState("");

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [delTarget, setDelTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      setProjects(await api<Project[]>("/api/v1/projects"));
      setErr("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal memuat daftar project");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setTitleError("Judul wajib diisi.");
      return;
    }
    setTitleError("");
    setCreating(true);
    setErr("");
    try {
      const created = await api<Project>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          title: t,
          description: description.trim() || null,
          research_type: researchType,
        }),
      });
      setTitle("");
      setDescription("");
      setMsg(`Project "${created.title}" dibuat.`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal membuat project");
    } finally {
      setCreating(false);
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setPwBusy(true);
    try {
      await api("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      setOldPw("");
      setNewPw("");
      setMsg("Password berhasil diganti.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Gagal ganti password");
    } finally {
      setPwBusy(false);
    }
  }

  async function remove() {
    if (!delTarget) return;
    setDeleting(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`${apiUrl()}/api/v1/projects/${delTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setMsg(`Project "${delTarget.title}" dihapus.`);
      setDelTarget(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hapus gagal");
      setDelTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHead />

      {err && (
        <Alert variant="destructive" className="mt-5">
          {err}
        </Alert>
      )}
      {msg && (
        <Alert variant="success" className="mt-5">
          {msg}
        </Alert>
      )}

      {/* ---- langkah 01: buat project ---- */}
      <section className="mt-7 grid gap-x-10 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <form onSubmit={create} className="rounded-lg border border-rule bg-paper p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">
                Buat project
              </h2>
              <span className="tnum text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                langkah 01
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-title">Judul penelitian</Label>
                <Input
                  id="p-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="mis. Pengaruh beban kerja terhadap produktivitas"
                  aria-invalid={!!titleError}
                  aria-describedby={titleError ? "p-title-err" : "p-title-help"}
                />
                {titleError ? (
                  <p id="p-title-err" className="text-[11.5px] text-danger">
                    {titleError}
                  </p>
                ) : (
                  <p id="p-title-help" className="text-[11.5px] text-ink-4">
                    Satu penelitian = satu project. Dataset dan analisis tidak
                    bercampur antar penelitian.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Jenis penelitian</Label>
                <Select value={researchType} onValueChange={setResearchType}>
                  <SelectTrigger aria-label="Jenis penelitian">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-desc">Catatan</Label>
                <Textarea
                  id="p-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="opsional — hipotesis, sumber data, atau catatan metodologi"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={creating}>
                  {creating ? "Membuat…" : "Buat project"}
                  <ArrowRight size={14} strokeWidth={1.5} />
                </Button>
                <span className="text-[11.5px] text-ink-4">
                  Setelah dibuat, project bisa langsung diunggah datanya.
                </span>
              </div>
            </div>
          </form>
        </div>

        {/* konteks: apa yang terjadi setelah project dibuat */}
        <div className="lg:col-span-5">
          <div className="rounded-lg border border-rule bg-paper p-5">
            <p className="tnum text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-4">
              Setelah project dibuat
            </p>
            <ol className="mt-4 space-y-3">
              {[
                ["02", "Unggah dataset", "CSV, XLSX, XLS, SAV, atau JSON — pratinjau dulu sebelum dianalisis."],
                ["03", "Tetapkan variabel", "Tipe data dan peran tiap kolom menentukan metode yang sah."],
                ["04", "Bersihkan", "15 operasi preprocessing; tiap operasi menulis versi baru."],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-3 border-t border-rule pt-3">
                  <span className="tnum shrink-0 text-[10.5px] text-accent">{n}</span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium text-ink">{t}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-3">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href="/alur"
              className="ring-accent mt-4 inline-block text-[12.5px] font-medium text-accent hover:text-accent-2"
            >
              Lihat alur lengkap →
            </Link>
          </div>
        </div>
      </section>

      {/* ---- daftar project ---- */}
      <section className="mt-9">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2.5">
          <h2 className="text-[13.5px] font-semibold tracking-tight text-ink">
            Project saya
          </h2>
          <span className="tnum text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
            {loading ? "memuat…" : `${projects.length} project`}
          </span>
        </div>

        {loading ? (
          <ul className="divide-y divide-rule" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 py-4">
                <div className="shimmer h-4 w-1/2 rounded-sm bg-paper-3" />
                <div className="shimmer ml-auto h-3 w-20 rounded-sm bg-paper-3" />
              </li>
            ))}
          </ul>
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-rule">
            {projects.map((p) => (
              <li key={p.id} className="group flex items-center gap-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${p.id}`}
                    className="ring-accent block truncate rounded-sm text-[14px] font-medium text-ink hover:text-accent"
                  >
                    {p.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="info">{p.research_type}</Badge>
                    <span className="tnum text-[11px] text-ink-4">
                      diubah {fmtDate(p.updated_at)}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/projects/${p.id}`}
                  className="pressable ring-accent inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rule-2 px-3 py-1.5 text-[12px] font-medium text-ink hover:border-accent hover:bg-accent-wash hover:text-accent-2"
                >
                  Buka
                  <ArrowRight size={12} strokeWidth={1.5} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => setDelTarget(p)}
                  aria-label={`Hapus project ${p.title}`}
                  className="pressable ring-accent shrink-0 rounded-md p-2 text-ink-4 hover:bg-danger/8 hover:text-danger"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- akun ---- */}
      <section className="mt-9 border-t border-rule pt-6">
        <details className="group">
          <summary className="ring-accent flex cursor-pointer list-none items-center gap-2 rounded-sm text-[12.5px] font-medium text-ink-2 hover:text-ink">
            <span className="text-ink-4 transition-transform duration-200 group-open:rotate-90">
              ›
            </span>
            Ganti password
          </summary>
          <form onSubmit={changePw} className="mt-4 max-w-lg space-y-3">
            <div className="space-y-2">
              <Label htmlFor="old">Password lama</Label>
              <Input
                id="old"
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Password baru</Label>
              <Input
                id="new"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                aria-describedby="new-help"
              />
              <p id="new-help" className="text-[11.5px] text-ink-4">
                Minimal 8 karakter.
              </p>
            </div>
            <Button type="submit" variant="outline" disabled={pwBusy}>
              {pwBusy ? "Menyimpan…" : "Ganti password"}
            </Button>
          </form>
        </details>
      </section>

      <Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus project?</DialogTitle>
            <DialogDescription>
              {delTarget?.title} beserta seluruh dataset, versi, dan analisis di
              dalamnya akan dihapus. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>
              {deleting ? "Menghapus…" : "Hapus project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PageHead() {
  return (
    <div>
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">
        Dashboard
      </h1>
      <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-2">
        Satu penelitian = satu project. Mulai dari judul, lalu unggah data.
      </p>
      <ProcessRail current={1} className="mt-5" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-rule-2 px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="mx-auto block h-7 w-7 border border-rule-2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, var(--color-paper-3) 0 1px, transparent 1px 6px)",
        }}
      />
      <p className="mt-4 text-[14px] font-medium text-ink">Belum ada project</p>
      <p className="mx-auto mt-1.5 max-w-[40ch] text-[12.5px] leading-relaxed text-ink-3">
        Buat project di atas untuk mulai. Setelah itu dataset bisa langsung
        diunggah dan dianalisis tanpa langkah konversi manual.
      </p>
    </div>
  );
}
