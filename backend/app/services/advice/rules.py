"""Saran otomatis (advice) sebelum analisis dijalankan — 100% deterministik.

Modul ini menjawab satu pertanyaan: *"apakah pilihan kolom/metode ini masuk akal
untuk data yang sedang dianalisis?"* Semua angka di dalam pesan berasal langsung
dari `df` (jumlah baris duplikat, persentase kosong, pagar IQR, dst) — tidak ada
LLM, tidak ada model, tidak ada panggilan jaringan, tidak ada RNG, tidak ada
`datetime.now()`. Sesuai ADR-0001 (`docs/adr/0001-ai-must-not-compute.md`) AI
dilarang menjadi sumber angka; modul ini hanya menghitung angka deskriptif
terkecil yang sudah ada di data dan berubah-ubahnya, bukan statistik inferensial
(t/F/χ²/p-value TIDAK pernah dihitung atau dibaca ulang di sini).

Modul `stats/preflight.py` menangani kondisi yang membuat analisis mustahil
(blocking). Modul ini menangani hal yang lebih halus: kondisi yang TETAP bisa
dijalankan tetapi hasilnya perlu dibaca dengan hati-hati (warn).

Tentang level severity
----------------------
Seluruh aturan di sini menghasilkan `"warn"`, bukan `"blocking"`. Alasannya:
menghapus baris, mengubah tipe kolom, atau mengganti metode adalah keputusan
peneliti, bukan keputusan sistem. Sistem menyinggarkan konsekuensinya dengan
angka, lalu membiarkan peneliti memutuskan. Satu-satunya pengecualian yang
dipilih sebagai warn meskitar secara teknis membuat analisis gagal —
MA-03 (t-test dengan >2 kelompok, yang di `stats/ttest.py` memang melempar
ValueError) — karena saran otomatis (`switch_to`) selalu lebih berguna daripada
dengan sengaja memblokir tombol.

Identitas dataset & kelengkapan data
    `variables` boleh berisi kunci variabel dalam tiga bentuk:
      - string   : {"column": "diggCount"}
      - list     : {"columns": ["diggCount", "replyCommentTotal"]}  (multi)
      - dict     : {"id": {"column": "id_responden", "role": "ID"}}
    Bentuk dict dipakai kalau pemanggil sudah tahu peran kolom (ID/ordinal/…)
    sehingga tidak perlu menebak dari nama kolom.
    `profile` (opsional) berisi peta profil kolom: {"id_responden": {"role": "ID"}}
    atau [{"name": "id_responden", "role": "ID"}]. Dipakai sebagai sumber peran
    kolom bila `variables` tidak menyediakannya.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import pandas as pd

# --- ambang batas (semuanya konstanta; tidak bergantung waktu/random) -------
MISSING_WARN_PCT = 5.0        # MA-02: di atas ini → warn
MISSING_SERIOUS_PCT = 40.0    # MA-02: di atas ini → pesan lebih tegas (level tetap warn)
OUTLIER_WARN_PCT = 5.0        # MA-05: di atas ini → warn
LIKERT_MAX_UNIQUE = 7         # MA-06: toleransi jumlah nilai unik
LIKERT_LOW, LIKERT_HIGH = 1, 5  # MA-06: rentang skala 1..5
MIN_ROWS = 5                  # di bawah ini kuartil/deskripsi terlalu rapuh

# Metode yang membandingkan kelompok lewat kolom pengelompok.
GROUP_METHODS = ("ttest_ind", "anova_oneway")
GROUP_KEYS = ("group",)

# Pasangan metode → alternatif non-parametrik/robust yang lebih tahan outlier.
OUTLIER_SWITCH = {
    "ttest_ind": "mannwhitney",
    "ttest_paired": "wilcoxon",
    "pearson": "spearman",
    "linreg_simple": "spearman",
}


@dataclass
class Issue:
    """Satu saran. `asdict()`-nya sudah aman di-`json.dumps`."""

    id: str                 # mis. "MA-03"
    level: str              # "blocking" | "warn"
    field: str              # kunci spec/parameter relevan ("column", "group", "")
    message: str            # Bahasa Indonesia, konkret, menyebut angka nyata
    fix: str                # saran tindakan singkat
    switch_to: str | None   # id metode alternatif bila relevan, None bila tidak


# --- formatter angka gaya Indonesia ----------------------------------------

def _pct(value: float, decimals: int = 1) -> str:
    """11.8 → '11,8' (koma desimal, gaya Bahasa Indonesia)."""
    return f"{float(value):.{decimals}f}".replace(".", ",")


def _num(value: float, decimals: int = 2) -> str:
    """18445 → '18.445'; 0.75 → '0,75'; 100.0 → '100'."""
    s = f"{float(value):,.{decimals}f}"
    whole, _, frac = s.replace(",", "\u0000").replace(".", ",").replace("\u0000", ".").partition(",")
    frac = frac.rstrip("0")
    return f"{whole},{frac}" if frac else whole


# --- pembacaan input (aman terhadap bentuk data yang tak terduga) ----------

def _series(df: pd.DataFrame, col: str) -> pd.Series | None:
    """Ambil kolom sebagai Series, atau None bila tidak bisa (kolom hilang/duplikat)."""
    if col not in getattr(df, "columns", []):
        return None
    s = df[col]
    if not isinstance(s, pd.Series):  # nama kolom kembar → DataFrame, lewati
        return None
    return s


def _profile_map(profile: dict | list | None) -> dict:
    """Normalisasi `profile` menjadi {nama_kolom: {"role": ..., "type": ...}}."""
    if not profile:
        return {}
    items: list = []
    if isinstance(profile, dict):
        items = [{"name": k, **(v if isinstance(v, dict) else {"role": v})} for k, v in profile.items()]
    elif isinstance(profile, list):
        items = [p for p in profile if isinstance(p, dict)]
    out: dict = {}
    for p in items:
        name = p.get("name") or p.get("column") or p.get("col")
        if name:
            out[str(name)] = {k: v for k, v in p.items() if k != "name"}
    return out


def _iter_selected(variables: dict, profile: dict | list | None) -> list[tuple[str, str, str | None]]:
    """Kembalikan [(key_spec, kolom, role|None), ...] sesuai urutan pemanggil.

    Kolom yang tidak ada di `df` TIDAK dibuang di sini; masing-masing aturan
    yang memfilter (`_series` mengembalikan None).
    """
    pmap = _profile_map(profile)
    out: list[tuple[str, str, str | None]] = []
    if not isinstance(variables, dict):
        return out

    def _push(key: str, value, role: str | None = None) -> None:
        if isinstance(value, dict):
            col = value.get("column") or value.get("name") or value.get("col")
            role = value.get("role", role)
        else:
            col = value
        if not isinstance(col, str) or not col.strip():
            return
        col = col.strip()
        prof_role = pmap.get(col, {}).get("role")
        if role is None and prof_role is not None:
            role = prof_role
        out.append((key, col, role))

    for key, value in variables.items():
        if isinstance(value, (list, tuple, set)):
            for item in value:
                _push(str(key), item)
        else:
            _push(str(key), value)
    return out


def _is_id_role(role) -> bool:
    return str(role or "").strip().upper() in ("ID", "IDENTIFIER")


def _missing_mask(s: pd.Series) -> pd.Series:
    """NaN/None + string kosong/spasi (kolom teks sering "kosong" sebagai '')."""
    mask = s.isna()
    if not pd.api.types.is_numeric_dtype(s):
        try:
            mask = mask | s.astype("string").str.strip().eq("")
        except (TypeError, ValueError):  # dtype aneh → andalkan isna() saja
            pass
    return mask


# --- MA-01: ID duplikat ----------------------------------------------------

def _rule_ma01_duplicate_id(df: pd.DataFrame, selected) -> list[Issue]:
    issues: list[Issue] = []
    for key, col, role in selected:
        if not _is_id_role(role):
            continue
        s = _series(df, col)
        if s is None or len(s) == 0:
            continue
        n_dup = int(s.duplicated().sum())
        if n_dup == 0:
            continue
        n_total = int(len(s))
        n_unique = int(s.nunique(dropna=True))
        issues.append(Issue(
            id="MA-01", level="warn", field=key,
            message=(f"Kolom ID '{col}' punya {n_dup} baris duplikat dari {n_total} baris "
                     f"(nilai unik {n_unique}). Baris kembar dihitung dua kali dan bisa "
                     f"membesar-besarkan ukuran sampel."),
            fix="hapus atau gabungkan baris duplikat sebelum analisis (menu Pembersihan Data)",
            switch_to=None,
        ))
    return issues


# --- MA-02: missing tinggi -------------------------------------------------

def _rule_ma02_missing(df: pd.DataFrame, selected) -> list[Issue]:
    """Kolom terpilih dengan >5% kosong → warn; >40% → pesan lebih serius.

    Level tetap "warn" pada 40% pun: şiș hilangnya lebih dari separuh data adalah
    keputusan peneliti yang harus diambil sendiri, bukan pemblokiran sistem.
    """
    issues: list[Issue] = []
    for key, col, _role in selected:
        s = _series(df, col)
        if s is None or len(s) == 0:
            continue
        n_total = int(len(s))
        n_missing = int(_missing_mask(s).sum())
        if n_missing == 0:
            continue
        pct = 100.0 * n_missing / n_total
        if pct <= MISSING_WARN_PCT:
            continue
        n_left = n_total - n_missing
        pct_txt = _pct(pct)
        if pct > MISSING_SERIOUS_PCT:
            message = (f"Kolom '{col}' kosong {pct_txt}% ({n_missing} dari {n_total} baris) — "
                       f"hanya {n_left} baris tersisa untuk analisis, biasanya hasil jadi tidak stabil.")
            fix = "perbaiki sumber data lebih dulu, atau pilih kolom lain"
        else:
            message = (f"Kolom '{col}' kosong {pct_txt}% ({n_missing} dari {n_total} baris) — "
                       f"n efektif turun dari {n_total} menjadi {n_left} baris.")
            fix = "periksa baris kosong (atau pilih kolom lain) sebelum menyimpan analisis"
        issues.append(Issue(
            id="MA-02", level="warn", field=key, message=message, fix=fix, switch_to=None,
        ))
    return issues


# --- MA-03 / MA-04: jumlah level kolom pengelompok ------------------------

def _rule_ma03_group_too_many(method: str, df: pd.DataFrame, selected) -> list[Issue]:
    """ttest_ind dengan >2 kelompok → saran pindah ke One-Way ANOVA."""
    if method != "ttest_ind":
        return []
    issues: list[Issue] = []
    for key, col, _role in selected:
        if key not in GROUP_KEYS or method not in GROUP_METHODS:
            continue
        s = _series(df, col)
        if s is None or len(s) == 0:
            continue
        levels = sorted(str(v) for v in s.dropna().unique().tolist())
        if len(levels) <= 2:
            continue
        preview = ", ".join(levels[:4]) + ("…" if len(levels) > 4 else "")
        issues.append(Issue(
            id="MA-03", level="warn", field=key,
            message=(f"Kolom '{col}' punya {len(levels)} kelompok ({preview}) pada {len(s)} baris. "
                     f"Independent Samples t-Test hanya membandingkan tepat 2 kelompok, jadi "
                     f"analisis dengan pilihan ini akan gagal dijalankan."),
            fix="pindah ke One-Way ANOVA (bisa ≥3 kelompok) atau filter jadi 2 kelompok",
            switch_to="anova_oneway",
        ))
    return issues


def _rule_ma04_group_too_few(df: pd.DataFrame, selected) -> list[Issue]:
    """Kolom pengelompok dengan <2 level → tidak ada yang bisa dibandingkan."""
    issues: list[Issue] = []
    for key, col, _role in selected:
        if key not in GROUP_KEYS:
            continue
        s = _series(df, col)
        if s is None or len(s) == 0:
            continue
        n_levels = int(s.nunique(dropna=True))
        if n_levels >= 2:
            continue
        issues.append(Issue(
            id="MA-04", level="warn", field=key,
            message=(f"Kolom '{col}' hanya punya {n_levels} nilai unik pada {len(s)} baris — "
                     f"tidak ada yang bisa dibandingkan karena kelompoknya kurang dari 2."),
            fix="pilih kolom pengelompok yang punya minimal 2 kelompok berbeda",
            switch_to=None,
        ))
    return issues


# --- MA-05: outlier IQR ----------------------------------------------------

def _fences(v: pd.Series) -> tuple[float, float, str, float, float] | None:
    """Pagar bawah/atas + dasar pakainya.

    Dasar utama: pagar Tukey Q1−1,5·IQR s.d. Q3+1,5·IQR.

   Kalau IQR = 0 (lebih dari separuh nilai identik — sangat umum pada data
    hitung, mis. jumlah like/digg dengan median 0), pagar Tukey runtuh jadi
    titik dan setiap nilai bukan nol akan dianggap "outlier" atau, sebaliknya,
    tidak ada yang terdeteksi. Untuk kasus itu dipakai pagar pengganti berbasis
    kuantil (Q10 s.d. Q90) dan pesannya menjelaskan pergantian ini.

    Mengembalikan None bila kolom tidak punya sebaran sama sekali (konstan).
    """
    q1, q3 = float(v.quantile(0.25)), float(v.quantile(0.75))
    iqr = q3 - q1
    if iqr > 0:
        return q1 - 1.5 * iqr, q3 + 1.5 * iqr, "IQR", q1, q3
    q10, q90 = float(v.quantile(0.10)), float(v.quantile(0.90))
    if q90 <= q10:  # kolom konstan: pagar apa pun tidak informatif
        return None
    return q10, q90, "KUANTIL", q10, q90


def _rule_ma05_iqr_outliers(method: str, df: pd.DataFrame, selected) -> list[Issue]:
    """>5% nilai numerik di luar pagar → warn.

    Pagar utama adalah pagar Tukey (1,5×IQR); lihat `_fences` untuk kasus IQR = 0.
    Pada kolom hitung yang majority-nya nol ("jumlah like", "jumlah share") pagar
    pengganti memang sengaja peka: rata-rata kolom seperti itu tidak mewakili
    respons tipikal, jadi peringatannyalah yang berguna — bukan diam saja.
    Kolom pengelompok dan kolom ID dilewati: yang dinilai adalah variabel terukur.
    """
    issues: list[Issue] = []
    switch = OUTLIER_SWITCH.get(method)
    for key, col, _role in selected:
        if key in GROUP_KEYS or key in ("id",):
            continue
        s = _series(df, col)
        if s is None or not pd.api.types.is_numeric_dtype(s.dtype):
            continue
        v = s.dropna()
        if len(v) < MIN_ROWS:
            continue
        pagar = _fences(v)
        if pagar is None:
            continue
        low, high, basis, q_lo, q_hi = pagar
        n_out = int(((v < low) | (v > high)).sum())
        if n_out == 0:
            continue
        pct = 100.0 * n_out / len(v)
        if pct <= OUTLIER_WARN_PCT:
            continue
        median = float(v.median())
        if basis == "IQR":
            pagar_txt = f"pagar IQR {_num(low)} s.d. {_num(high)}"
        else:
            pagar_txt = (f"pagar kuantil {_num(low)} s.d. {_num(high)} (IQR kolom ini nol karena "
                         f"{int((v == median).sum())} dari {len(v)} baris bernilai {_num(median)}, "
                         f"jadi pagar IQR runtuh dan dipakai Q10–Q90)")
        issues.append(Issue(
            id="MA-05", level="warn", field=key,
            message=(f"Kolom '{col}': {_pct(pct)}% nilai di luar {pagar_txt} "
                     f"({n_out} dari {len(v)} baris; median {_num(median)}). Distribusi sangat "
                     f"miring sehingga rata-rata sangat sensitif terhadap nilai ekstrem."),
            fix="tinjau baris ekstrem, atau pakai metode yang tahan outlier"
                + (f" (mis. '{switch}')" if switch else ""),
            switch_to=switch,
        ))
    return issues


# --- MA-06: skala Likert salah autodeteksi ---------------------------------

def _rule_ma06_likert(df: pd.DataFrame, selected) -> list[Issue]:
    """Kolom numerik bulat 1..5 dengan sedikit nilai unik → kemungkinan skala Likert."""
    issues: list[Issue] = []
    for key, col, _role in selected:
        if key in GROUP_KEYS:
            continue
        s = _series(df, col)
        if s is None or not pd.api.types.is_numeric_dtype(s.dtype):
            continue
        v = s.dropna()
        if len(v) < MIN_ROWS:
            continue
        uniq = v.unique()
        if len(uniq) < 2 or len(uniq) > LIKERT_MAX_UNIQUE:
            continue
        if not bool((v == v.round()).all()):
            continue
        if not bool(v.between(LIKERT_LOW, LIKERT_HIGH).all()):
            continue
        isi = ", ".join(_num(float(u)) for u in sorted(uniq))
        issues.append(Issue(
            id="MA-06", level="warn", field=key,
            message=(f"Kolom '{col}' hanya berisi bilangan bulat {LIKERT_LOW}..{LIKERT_HIGH} "
                     f"dengan {len(uniq)} nilai unik ({isi}) pada {len(v)} baris — pola ini "
                     f"umumnya skala Likert/ordinal, bukan pengukuran numerik kontinu."),
            fix="set tipe kolom menjadi Ordinal di panel Variabel agar dianalisis sebagai peringkat",
            switch_to=None,
        ))
    return issues


# --- API publik ------------------------------------------------------------

def advise(method: str, df: pd.DataFrame, variables: dict,
           params: dict | None = None, profile: dict | None = None) -> list[dict]:
    """Kembalikan daftar saran deterministik untuk satu rencana analisis.

    Args:
        method:   id metode, mis. "ttest_ind" (lihat stats.METHOD_IDS).
        df:       DataFrame dataset yang akan dianalisis.
        variables: pemetaan kunci spec → kolom (string, list, atau dict
                   {"column": ..., "role": "ID"}).
        params:   parameter metode. Tidak dipakai MA-01..MA-06, tapi diterima agar
                 tanda tangan tidak berubah bila aturan baru membutuhkannya.
        profile:  peta profil kolom (peran/tipe), opsional.

    Returns:
        Selalu `list[dict]` (boleh kosong), tiap item:
        {"id", "level", "field", "message", "fix", "switch_to"} — semua nilai
        bertipe str/int/float/None sehingga aman di-`json.dumps`.

    Catatan: tidak ada aturan yang membaca `params` untuk menghitung ulang
    statistik apa pun (lihat MA-07 di catatan versi modul: sengaja tidak ada).
    """
    params = params or {}
    del params  # sengaja: kontrak dipertahankan, aturan ini tidak memakainya
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return []

    selected = _iter_selected(variables, profile)

    issues: list[Issue] = []
    issues += _rule_ma01_duplicate_id(df, selected)
    issues += _rule_ma02_missing(df, selected)
    issues += _rule_ma03_group_too_many(method, df, selected)
    issues += _rule_ma04_group_too_few(df, selected)
    issues += _rule_ma05_iqr_outliers(method, df, selected)
    issues += _rule_ma06_likert(df, selected)

    # Urutan aturan (MA-01..MA-06) lalu urutan kolom dari pemanggil → stabil.
    return [asdict(i) for i in issues]