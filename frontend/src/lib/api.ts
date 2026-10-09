/**
 * Basis URL API.
 *
 * Urutan: localStorage (di-set halaman login) → NEXT_PUBLIC_API_URL → default.
 * Default WAJIB `localhost:8100`, bukan 8000: DDEV memetakan container backend
 * :8000 ke host :8100, jadi 8000 hanya hidup di dalam jaringan container. Fallback
 * ke 8000 membuat fetch ditolak browser dan muncul sebagai "Failed to fetch" tanpa
 * penjelasan — pesan yang sama untuk CORS, DNS, dan server mati.
 */
export function apiUrl(): string {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("api_url");
    if (saved) return saved.replace(/\/$/, "");
  }
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100").replace(/\/$/, "");
}

/**
 * `fetch` yang mengubah kegagalan jaringan menjadi pesan yang bisa ditindaklanjuti.
 * Tanpa ini, CORS salah, DNS salah, dan backend mati semuanya tampil sebagai
 * "Failed to fetch" yang tidak menyuruh apa pun.
 */
export async function fetchWithContext(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    const base = input.startsWith("http") ? new URL(input).origin : apiUrl();
    throw new Error(
      `Tidak bisa menghubungi API di ${base}. ` +
        `Pastikan backend jalan (ddev start) dan NEXT_PUBLIC_API_URL benar — ` +
        ` untuk DDEV host-side biasanya http://localhost:8100. ` +
        `Detail: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithContext(`${apiUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
  });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = (j as { detail?: string }).detail || msg;
    } catch { /* abaikan */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Unduh file export (CSV/XLSX/PDF) dengan token. */
export async function downloadExport(uid: string, format: string) {
  const res = await fetchWithContext(`${apiUrl()}/api/v1/analyses/${uid}/export?format=${format}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Export gagal: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${uid}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bangun string gaya APA dari result untuk tombol Copy. */
export function apaStyle(result: Record<string, unknown>): string {
  const s = (result.statistics || {}) as Record<string, unknown>;
  const m = result.method as string;
  const p = (result.decision as { p?: number } | null)?.p;
  const ptxt = p == null ? "p = ?" : p < 0.001 ? "p < .001" : `p = ${Number(p).toFixed(3)}`;
  const n = result.n;
  const num = (v: unknown, d = 3) => (typeof v === "number" ? v.toFixed(d) : "?");
  switch (m) {
    case "ttest_ind": return `Independent t-test: t(${s.df}) = ${num(s.t)}, ${ptxt}, d = ${num((result.effect_size as Record<string, number> | null)?.cohens_d, 2)} (n = ${n})`;
    case "ttest_1samp": return `One-sample t-test: t(${s.df}) = ${num(s.t)}, ${ptxt} (n = ${n})`;
    case "ttest_paired": return `Paired t-test: t(${s.df}) = ${num(s.t)}, ${ptxt} (n = ${n})`;
    case "pearson": return `Pearson r(${Number(n) - 2}) = ${num(s.r)}, ${ptxt}`;
    case "spearman": return `Spearman ρ = ${num(s.rho)}, ${ptxt} (n = ${n})`;
    case "anova_oneway": return `One-way ANOVA: F(${s.dfb}, ${s.dfw}) = ${num(s.f)}, ${ptxt}, η² = ${num(s.eta_squared ?? (result.effect_size as Record<string, number> | undefined)?.eta_squared, 3)}`;
    case "chi2_independence": return `Chi-square: χ²(${s.df}) = ${num(s.chi2)}, ${ptxt}`;
    case "mannwhitney": return `Mann-Whitney U = ${num(s.u, 1)}, ${ptxt} (n = ${n})`;
    case "wilcoxon": return `Wilcoxon W = ${num(s.w, 1)}, ${ptxt} (n = ${n})`;
    case "kruskal": return `Kruskal-Wallis H(${s.df}) = ${num(s.h)}, ${ptxt}`;
    case "linreg_simple":
    case "linreg_multiple": return `Regression: R² = ${num(s.r_squared)}, F = ${num(s.f_stat)}, ${ptxt} (n = ${n})`;
    default: return `${result.method_name} (n = ${n}), ${ptxt}`;
  }
}
