"""Transparansi data: n sumber vs n analisis, dan deteksi duplikat pengenal.

Dua hal yang paling sering jadi bahan revisi pembimbing:

1. Paper menulis "n = 1250" sementara tabel hasil n = 1187, karena metode
   membuang baris (missing / pasangan tak lengkap) tanpa discloses.
2. Kolom ID berisi baris duplikat; analisis berpasangan tetap "lolos" semua
   asumsi statistiknya, padahal satu subjek terdua dan hitungannya berubah.

Modul diuji: `app.services.stats.run_analysis` (dispatcher) dan
`app.services.dataset_service.profile_dataframe`.
"""
import numpy as np
import pandas as pd
import pytest

from app.services.dataset_service import profile_dataframe, suggest_type
from app.services.stats import run_analysis


# --------------------------------------------------------------------------
# n_source vs n analisis
# --------------------------------------------------------------------------

def _paired_df(n_complete: int = 40, n_incomplete: int = 10) -> pd.DataFrame:
    """40 baris berpasangan lengkap + 10 baris salah satu kolom kosong."""
    rng = np.random.default_rng(42)
    pre = rng.normal(10, 2, n_complete + n_incomplete)
    post = rng.normal(12, 2, n_complete + n_incomplete)
    # baris terakhir hanya satu sisi -> tidak bisa dipasangkan
    post[-n_incomplete:] = np.nan
    return pd.DataFrame({"pre": pre, "post": post})


def test_paired_n_source_lebih_besar_dari_n_analisis():
    r = run_analysis(_paired_df(), "ttest_paired", {"col1": "pre", "col2": "post"}, {"alpha": 0.05})
    assert r["n_source"] == 50
    assert r["n"] == 40
    assert r["n_rows_dropped"] == 10


def test_baris_buang_muncul_sebagai_warning():
    """Perubahan n harus terlihat PENUH di atas hasil, bukan diam di backend."""
    r = run_analysis(_paired_df(), "ttest_paired", {"col1": "pre", "col2": "post"}, {"alpha": 0.05})
    joined = " ".join(r["warnings"])
    assert "40" in joined and "50" in joined, joined
    assert "10 baris" in joined, joined


def test_tanpa_pembuangan_tidak_ada_warning_n():
    """Data lengkap -> n_source == n dan TIDAK boleh ada warning (false positive)."""
    df = pd.DataFrame({"pre": [1, 2, 3, 4, 5], "post": [2, 3, 4, 5, 6]})
    r = run_analysis(df, "ttest_paired", {"col1": "pre", "col2": "post"}, {"alpha": 0.05})
    assert r["n_source"] == 5
    assert r["n_rows_dropped"] == 0
    assert not any("baris sumber" in w for w in r.get("warnings", []))


def test_n_source_selalu_ada_untuk_semua_metode_yang_dijalankan():
    """Kontrak: dispatcher menyuntik n_source ke semua metode, bukan hanya sebagian."""
    df = pd.DataFrame({
        "x": [1, 2, 3, 4, 5, 6, 7, 8, 9],
        "y": [2, 1, 4, 3, 6, 5, 8, 7, 9],
        "g": ["a", "a", "a", "b", "b", "b", "c", "c", "c"],
        "g2": ["p", "q", "p", "q", "p", "q", "p", "q", "p"],
    })
    for method, variables, params in [
        ("descriptive", {"columns": ["x"]}, {}),
        ("normality", {"column": "x"}, {"method": "auto"}),
        ("pearson", {"x": "x", "y": "y"}, {}),
        ("ttest_1samp", {"column": "x"}, {"mu": 4.5}),
        ("chi2_independence", {"col1": "g", "col2": "g2"}, {}),
    ]:
        r = run_analysis(df, method, variables, {"alpha": 0.05, **params})
        assert "n_source" in r, method
        assert "n_rows_dropped" in r, method
        assert r["n_source"] == len(df), method
        assert r["n_rows_dropped"] >= 0, method

    # ttest_ind butuh tepat 2 grup, anova_oneway butuh >=3: satu fixture tak
    # bisa melayani keduanya, jadi grupnya dibuat terpisah.
    df2 = pd.DataFrame({
        "x": [1, 2, 3, 4, 5, 6, 7, 8],
        "g": ["a", "a", "a", "a", "b", "b", "b", "b"],
    })
    r_ind = run_analysis(df2, "ttest_ind", {"column": "x", "group": "g"}, {"alpha": 0.05})
    assert r_ind["n_source"] == 8
    assert r_ind["n_rows_dropped"] >= 0

    df3 = df.copy()
    df3["g"] = ["a", "a", "a", "b", "b", "b", "c", "c", "c"]
    r_ano = run_analysis(df3, "anova_oneway", {"column": "x", "group": "g"}, {"alpha": 0.05})
    assert r_ano["n_source"] == 9
    assert r_ano["n_rows_dropped"] >= 0


# --------------------------------------------------------------------------
# Deteksi duplikat pengenal
# --------------------------------------------------------------------------

def test_kolom_id_duplikat_terdeteksi():
    df = pd.DataFrame({
        "id_responden": ["A", "A", "B", "C"],
        "nilai": [1, 2, 3, 4],
    })
    prof = profile_dataframe(df)
    id_col = next(c for c in prof["columns"] if c["name"] == "id_responden")
    assert id_col["detected_type"] == "ID", "kolom ID berduplikat tidak boleh diklasifikasikan Nominal"
    assert id_col["duplicate_ids"] == 1


def test_kolom_id_unik_tidak_ada_duplikat():
    df = pd.DataFrame({"id_responden": ["A", "B", "C"], "nilai": [1, 2, 3]})
    id_col = next(c for c in profile_dataframe(df)["columns"] if c["name"] == "id_responden")
    assert id_col["detected_type"] == "ID"
    assert id_col["duplicate_ids"] == 0


def test_kolom_bernama_id_tapi_kardinalitas_rendah_bukan_ID():
    """'id_pelaku' berkode 1/2/3 bukan pengenal — jangan salah tandai."""
    df = pd.DataFrame({"id_pelaku": [1, 2, 3, 1, 2, 3] * 10})
    col = next(c for c in profile_dataframe(df)["columns"] if c["name"] == "id_pelaku")
    assert col["detected_type"] != "ID"


def test_duplicate_values_pada_kolom_biasa():
    """Kolom non-ID tetap melaporkan pengulangan nilai (berguna untuk data entry)."""
    df = pd.DataFrame({"nilai": [1, 1, 2, 3, 3, 3]})
    col = next(c for c in profile_dataframe(df)["columns"] if c["name"] == "nilai")
    assert col["duplicate_values"] == 3  # satu '1' excess + dua '3' excess


def test_missing_tidak_ikut_dihitung_sebagai_duplikat():
    """NaN bukan nilai duplikat; kolom dengan missing tapi unik tetap 0 duplikat."""
    df = pd.DataFrame({"nilai": [1.0, np.nan, 2.0, 3.0, np.nan]})
    col = next(c for c in profile_dataframe(df)["columns"] if c["name"] == "nilai")
    assert col["duplicate_values"] == 0
    assert col["missing_count"] == 2


@pytest.mark.parametrize("size", [0, 1, 2])
def test_dataset_kecil_tidak_meledak(size):
    """Guard: dataset 0/1/2 baris tidak boleh membuat pembagian dengan nol."""
    df = pd.DataFrame({"id_x": list(range(size)), "nilai": list(range(size))})
    prof = profile_dataframe(df)
    assert prof["rows"] == size
    for col in prof["columns"]:
        assert col["duplicate_values"] >= 0