"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import type { NavItem } from "./public-nav";

/** Status sesi untuk header publik — logika token mirroring lib/api. */
export function SessionLinks() {
  const [logged, setLogged] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLogged(!!window.localStorage.getItem("token"));
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
    window.location.href = "/login";
  }

  if (logged) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/dashboard"
          className="pressable ring-accent hidden rounded-md border border-rule-2 px-3.5 py-2 text-[13px] font-medium text-ink hover:border-ink-3 hover:bg-paper-2 sm:inline-block"
        >
          Dashboard
        </a>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={busy}
          className="pressable ring-accent rounded-md border border-rule-2 px-3.5 py-2 text-[13px] font-medium text-ink-3 hover:border-ink-3 hover:text-ink disabled:opacity-50"
        >
          {busy ? "Keluar…" : "Keluar"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href="/login"
        className="pressable ring-accent hidden rounded-md px-3.5 py-2 text-[13px] font-medium text-ink-2 hover:text-ink sm:inline-block"
      >
        Masuk
      </a>
      <a
        href="/register"
        className="pressable ring-accent rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-paper hover:bg-accent-2"
      >
        Buat akun
      </a>
    </div>
  );
}

/** Menu mobile: satu state, Escape menutup, klik link menutup. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        className="pressable ring-accent flex h-10 w-10 items-center justify-center rounded-md border border-rule-2 text-ink"
      >
        <span className="relative block h-3 w-4">
          <span
            className="absolute left-0 block h-px w-full bg-current transition-transform duration-300"
            style={{ top: open ? "6px" : "0px", transform: open ? "rotate(45deg)" : "none" }}
          />
          <span
            className="absolute left-0 block h-px w-full bg-current transition-opacity duration-200"
            style={{ top: "6px", opacity: open ? 0 : 1 }}
          />
          <span
            className="absolute left-0 block h-px w-full bg-current transition-transform duration-300"
            style={{ top: open ? "6px" : "12px", transform: open ? "rotate(-45deg)" : "none" }}
          />
        </span>
      </button>

      <div
        id="mobile-nav-panel"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-rule bg-paper/97 backdrop-blur-md"
      >
        <nav className="flex flex-col px-5 pb-6 pt-2">
          {items.map((s, i) => (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${i * 45}ms` }}
              className="rise border-b border-rule/70 py-3.5 text-[15px] font-medium text-ink last:border-0"
            >
              {s.label}
            </Link>
          ))}
          <div className="mt-5 flex gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="pressable ring-accent flex-1 rounded-md border border-rule-2 py-2.5 text-center text-[13px] font-medium text-ink"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="pressable ring-accent flex-1 rounded-md bg-accent py-2.5 text-center text-[13px] font-medium text-paper"
            >
              Buat akun
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
