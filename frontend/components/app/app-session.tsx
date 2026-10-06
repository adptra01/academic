"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { apiUrl } from "@/lib/api";

type StoredUser = { name?: string; email?: string } | null;

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/metode", label: "Metode" },
  { href: "/reproduksi", label: "Reproduksi" },
];

/**
 * Kontrol sesi konsol. Membaca profil yang disimpan saat login supaya header
 * menyapa nama, bukan sekadar tombol "Logout".
 */
export default function AppSession() {
  const [user, setUser] = useState<StoredUser>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("user");
      setUser(raw ? (JSON.parse(raw) as StoredUser) : null);
    } catch {
      setUser(null);
    }
    setReady(true);
  }, []);

  async function logout() {
    setBusy(true);
    try {
      const token = window.localStorage.getItem("token");
      await fetch(`${apiUrl()}/api/v1/auth/logout`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      /* abaikan — token lokal tetap dibersihkan */
    }
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("user");
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-1.5">
      <nav aria-label="Navigasi konsol" className="hidden md:block">
        <ul className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`ring-accent rounded-sm px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-200 ${
                    active ? "bg-paper text-ink" : "text-ink-3 hover:bg-paper-2 hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {ready && user && (
        <span className="hidden items-center gap-1.5 border-l border-rule pl-3 text-[12px] text-ink-3 lg:flex">
          <UserIcon size={12} strokeWidth={1.5} aria-hidden="true" />
          <span className="max-w-[10rem] truncate text-ink-2">{user.name || user.email}</span>
        </span>
      )}

      <button
        type="button"
        onClick={() => void logout()}
        disabled={busy}
        className="pressable ring-accent inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink-3 hover:bg-paper-2 hover:text-ink disabled:opacity-50"
      >
        <LogOut size={12} strokeWidth={1.5} aria-hidden="true" />
        <span className="hidden sm:inline">{busy ? "Keluar…" : "Keluar"}</span>
        <span className="sm:hidden">Keluar</span>
      </button>

      {/* Navigasi konsol pindah ke menu sheet di bawah md — rail tahap butuh
          lebar penuh, jadi tidak boleh berebut ruang dengan nav. */}
      <details className="group relative md:hidden">
        <summary
          aria-label="Buka menu"
          className="ring-accent flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-rule-2 text-ink"
        >
          <span className="relative block h-3 w-4">
            <span className="absolute left-0 top-0 block h-px w-full bg-current transition-transform duration-300 group-open:top-[6px] group-open:rotate-45" />
            <span className="absolute left-0 top-[6px] block h-px w-full bg-current opacity-0 transition-opacity duration-200 group-open:opacity-0" />
            <span className="absolute left-0 top-[12px] block h-px w-full bg-current transition-transform duration-300 group-open:top-[6px] group-open:-rotate-45" />
          </span>
        </summary>
        <nav
          aria-label="Navigasi konsol seluler"
          className="absolute right-0 z-40 mt-2 w-52 rounded-lg border border-rule-2 bg-paper p-1.5 shadow-[0_24px_48px_-24px_rgba(26,24,21,0.3)]"
        >
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`ring-accent block rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  active ? "bg-accent-wash text-accent-2" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </details>
    </div>
  );
}
