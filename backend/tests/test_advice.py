"""Test modul saran (`app.services.advice`).

Data uji sengaja dibuat kecil & buatan di dalam file ini — tidak bergantung pada
file `sample/` milik pengguna dan tidak memakai random, sehingga hasilnya stabil
di setiap mesin.

Setiap aturan punya minimal satu kasus yang HARUS menyala dan satu yang HARUS
diam (negative case).
"""
from __future__ import annotations

import json

import pandas as pd
import pytest

from app.services.advice import Issue, advise
from app.services.advice import rules as R

N = 30
CONTRACT_KEYS = {"id", "level", "field", "message", "fix", "switch_to"}
KNOWN_RULES = {"MA-01", "MA-02", "MA-03", "MA-04", "MA-05", "MA-06"}


# --- fixtures DataFrame buatan ---------------------------------------------

def _df(**over) -> pd.DataFrame:
    """Dataset dasar 30 baris: ID unik, numerik bersih, skala Likert, kelompok.

    Panjang DataFrame mengikuti kolom terpendek pada `over`, supaya fixture
    bisa dibuat lebih pendek tanpa harus menyusun ulang kolom lain.
    """
    data = {
        "id_responden": [f"R{i:03d}" for i in range(1, N + 1)],
        "nilai": list(range(10, 40)),        # 30 nilai, tanpa outlier
        "skor": [1, 2, 3, 4, 5] * 6,         # skala Likert 1..5
        "grup": ["a", "b", "c"] * 10,        # 3 kelompok
        "grup2": ["a", "b"] * 15,            # tepat 2 kelompok
        "grup1": ["a"] * N,                  # hanya 1 kelompok
    }
    data.update(over)
    n = min(len(v) for v in data.values())
    data = {k: list(v)[:n] for k, v in data.items()}
    return pd.DataFrame(data)


def _with_missing(n_missing: int, n: int = N) -> list:
    """Kolom numerik dengan `n_missing` nilai kosong di ujung."""
    return [float(i) for i in range(n - n_missing)] + [float("nan")] * n_missing


def _ids(out: list[dict], rule: str | None = None) -> list[dict]:
    """Saring isu berdasarkan id aturan (semua isu bila rule=None)."""
    return [i for i in out if rule is None or i["id"] == rule]


def _one(out: list[dict], rule: str) -> dict:
    """Ambil tepat satu isu `rule`; gagal dengan pesan yang jelas kalau jumlah ≠ 1."""
    got = _ids(out, rule)
    assert len(got) == 1, (
        f"harus tepat 1 isu {rule}, dapat {len(got)}. "
        f"Semua pesan: {[i['id'] + ': ' + i['message'] for i in out]}"
    )
    return got[0]


# --- MA-01: ID duplikat ----------------------------------------------------

def test_ma01_id_duplikat_menyala():
    ids = [f"R{i:03d}" for i in range(1, N + 1)]
    ids[7] = ids[6]  # 1 baris kembar
    out = advise("ttest_ind", _df(id_responden=ids),
                 {"id": {"column": "id_responden", "role": "ID"}})
    isu = _one(out, "MA-01")
    assert isu["level"] == "warn"
    assert isu["field"] == "id"
    assert isu["switch_to"] is None
    assert "1 baris duplikat" in isu["message"]
    assert "30 baris" in isu["message"]
    assert "nilai unik 29" in isu["message"]


def test_ma01_id_unik_diam():
    assert _ids(advise("ttest_ind", _df(), {"id": {"column": "id_responden", "role": "ID"}}), "MA-01") == []


def test_ma01_peran_id_dari_profile():
    """Peran kolom boleh datang dari `profile`, bukan dari `variables`."""
    ids = [f"R{i:03d}" for i in range(1, N + 1)]
    ids[0] = ids[1]  # 1 baris kembar
    out = advise("ttest_ind", _df(id_responden=ids), {"id": "id_responden"},
                 profile={"id_responden": {"role": "ID"}})
    assert _ids(out, "MA-01")


def test_ma01_tanpa_peran_id_tidak_menyala():
    """Duplikat pada kolom biasa bukan isu ID — jangan asal menuduh."""
    kembar = list(range(1, 16)) * 2  # 15 nilai unik, masing-masing 2 kali
    assert _ids(advise("ttest_ind", _df(kode=kembar), {"column": "kode"}), "MA-01") == []


# --- MA-02: missing tinggi -------------------------------------------------

def test_ma02_missing_20_persen_menyala():
    df = _df(penggian=_with_missing(6))  # 6 dari 30 = 20%
    isu = _one(advise("ttest_ind", df, {"column": "penggian", "group": "grup2"}), "MA-02")
    assert isu["level"] == "warn"
    assert "20,0%" in isu["message"]
    assert "6 dari 30 baris" in isu["message"]
    assert "24 baris" in isu["message"]


def test_ma02_missing_di_atas_40_persen_pesan_lebih_kuat():
    """Di atas 40% level tetap 'warn' (bukan blocking) supaya peneliti tetap
    memegang kendali; hanya kalimatnya yang lebih tegas."""
    df = _df(penggian=_with_missing(15))  # 15 dari 30 = 50%
    isu = _one(advise("ttest_ind", df, {"column": "penggian", "group": "grup2"}), "MA-02")
    assert isu["level"] == "warn"
    assert "50,0%" in isu["message"]
    assert "hanya 15 baris tersisa" in isu["message"]


def test_ma02_missing_rendah_diam():
    df = _df(penggian=_with_missing(1))  # 1 dari 30 = 3,3% → di bawah ambang 5%
    assert _ids(advise("ttest_ind", df, {"column": "penggian", "group": "grup2"}), "MA-02") == []


def test_ma02_kolom_teks_kosong_string_terhitung():
    """Kolom teks yang 'kosong' bisa berupa '' atau spasi, bukan hanya NaN."""
    df = _df(catatan=["isi"] * 27 + ["", "  ", ""])
    isu = _one(advise("text_tfidf", df, {"column": "catatan"}), "MA-02")
    assert "3 dari 30 baris" in isu["message"]


def test_ma02_variabel_multi_field_benar():
    df = _df(a=_with_missing(6), b=list(range(10, 40)))
    assert _one(advise("descriptive", df, {"columns": ["a", "b"]}), "MA-02")["field"] == "columns"


# --- MA-03 / MA-04: jumlah level kelompok ----------------------------------

def test_ma03_ttest_tiga_kelompok_menyala():
    isu = _one(advise("ttest_ind", _df(), {"column": "nilai", "group": "grup"}), "MA-03")
    assert isu["level"] == "warn"
    assert isu["field"] == "group"
    assert isu["switch_to"] == "anova_oneway"
    assert "3 kelompok" in isu["message"]
    assert "30 baris" in isu["message"]


def test_ma03_tepat_dua_kelompok_diam():
    assert _ids(advise("ttest_ind", _df(), {"column": "nilai", "group": "grup2"}), "MA-03") == []


def test_ma03_hanya_berlaku_untuk_ttest_ind():
    """anova_oneway memang untuk ≥3 kelompok → MA-03 tidak boleh menyala."""
    assert _ids(advise("anova_oneway", _df(), {"column": "nilai", "group": "grup"}), "MA-03") == []


def test_ma04_satu_kelompok_menyala():
    out = advise("ttest_ind", _df(), {"column": "nilai", "group": "grup1"})
    isu = _one(out, "MA-04")
    assert isu["field"] == "group"
    assert isu["switch_to"] is None
    assert "1 nilai unik" in isu["message"]
    assert _ids(out, "MA-03") == []


def test_ma04_dua_kelompok_diam():
    assert _ids(advise("ttest_ind", _df(), {"column": "nilai", "group": "grup2"}), "MA-04") == []


# --- MA-05: outlier IQR ----------------------------------------------------

def test_ma05_outlier_menyala():
    # 27 nilai normal (10..36) + 3 nilai ekstrem = 10,0% di luar pagar IQR.
    kolom = list(range(10, 37)) + [500, 900, 1200]
    isu = _one(advise("ttest_ind", _df(nilai=kolom), {"column": "nilai", "group": "grup2"}), "MA-05")
    assert isu["level"] == "warn"
    assert "10,0%" in isu["message"]
    assert "3 dari 30 baris" in isu["message"]
    assert "pagar" in isu["message"]
    assert isu["switch_to"] == "mannwhitney"  # ttest_ind punya alternatif non-parametrik


def test_ma05_tanpa_outlier_diam():
    assert _ids(advise("ttest_ind", _df(), {"column": "nilai", "group": "grup2"}), "MA-05") == []


def test_ma05_outlier_sedikit_diam():
    """1 dari 28 = 3,6% masih di bawah ambang 5%."""
    kolom = list(range(10, 37)) + [1200]
    assert _ids(advise("ttest_ind", _df(nilai=kolom), {"column": "nilai", "group": "grup2"}), "MA-05") == []


def test_ma05_tanpa_metode_pengganti_switch_to_null():
    kolom = list(range(10, 37)) + [500, 900, 1200]
    isu = _one(advise("descriptive", _df(nilai=kolom), {"columns": ["nilai"]}), "MA-05")
    assert isu["switch_to"] is None


def test_ma05_kolom_konstan_tidak_menyala():
    """IQR = 0 → pagar tidak informatif; jangan dianggap semua nilai outlier."""
    assert _ids(advise("descriptive", _df(konstan=[7] * N), {"columns": ["konstan"]}), "MA-05") == []


# --- MA-06: skala Likert ---------------------------------------------------

def test_ma06_skala_likert_menyala():
    isu = _one(advise("descriptive", _df(), {"columns": ["skor"]}), "MA-06")
    assert isu["level"] == "warn"
    assert "1..5" in isu["message"]
    assert "5 nilai unik" in isu["message"]
    assert "30 baris" in isu["message"]
    assert isu["switch_to"] is None


def test_ma06_numerik_biasa_diam():
    """'nilai' = 10..39: bilangan bulat, tapi di luar 1..5 dan >7 nilai unik."""
    assert _ids(advise("descriptive", _df(), {"columns": ["nilai"]}), "MA-06") == []


def test_ma06_skala_1_sampai_7_diam():
    """Rentang 1..7 bukan skala Likert 1..5 yang kita sarankan."""
    skala7 = [1, 2, 3, 4, 5, 6, 7] * 4 + [1, 2]
    assert _ids(advise("descriptive", _df(sk7=skala7), {"columns": ["sk7"]}), "MA-06") == []


def test_ma06_kolom_teks_diam():
    df = _df(teks=["ya", "tidak", "mungkin"] * 10)
    assert _ids(advise("text_tfidf", df, {"column": "teks"}), "MA-06") == []


# --- kontrak & ketahanan ----------------------------------------------------

@pytest.mark.parametrize("skenario", [
    pytest.param({"column": "nilai", "group": "grup"}, id="ttest-3-grup"),
    pytest.param({"column": "nilai", "group": "grup1"}, id="ttest-1-grup"),
    pytest.param({"columns": ["skor"]}, id="skala-likert"),
    pytest.param({"column": "tidak_ada_di_dataset"}, id="kolom-hilang"),
    pytest.param({}, id="tanpa-variabel"),
])
def test_output_selalu_list_json_serialisable(skenario):
    ids = [f"R{i:03d}" for i in range(1, N)] + ["R001", "R001"]  # ada duplikat
    out = advise("ttest_ind", _df(id_responden=ids), skenario, params={"alpha": 0.05})
    assert isinstance(out, list)
    teks = json.dumps(out, ensure_ascii=False)  # tidak boleh melempar
    assert json.loads(teks) == out
    for item in out:
        assert isinstance(item, dict)
        assert set(item) == CONTRACT_KEYS
        assert item["level"] in ("blocking", "warn")
        assert isinstance(item["field"], str)
        assert item["switch_to"] is None or isinstance(item["switch_to"], str)


def test_hanya_ada_aturan_yang_terdaftar():
    """Tidak boleh ada aturan liar — terutama MA-07 yang mengulang hitungan statistik."""
    ids = [f"R{i:03d}" for i in range(1, N)]
    ids[3] = ids[2]  # 1 baris kembar
    df = _df(id_responden=ids, nilai=list(range(10, 37)) + [500, 900, 1200],
             penggian=_with_missing(6))
    out = advise("ttest_ind", df, {"column": "nilai", "group": "grup",
                                   "id": {"column": "id_responden", "role": "ID"}},
                 profile={"skor": {"role": "Ignore"}})
    assert {i["id"] for i in out} <= KNOWN_RULES
    assert {"MA-01", "MA-03", "MA-05"} <= {i["id"] for i in out}


def test_deterministik_panggilan_berulang():
    df = _df(nilai=list(range(10, 37)) + [500, 900, 1200], penggian=_with_missing(6))
    vars_ = {"column": "nilai", "group": "grup"}
    assert advise("ttest_ind", df, vars_) == advise("ttest_ind", df, vars_)


def test_params_tidak_mengubah_hasil():
    """`params` diterima (kontrak) tetapi MA-01..MA-06 tidak memakainya."""
    df = _df(penggian=_with_missing(6))
    vars_ = {"column": "penggian", "group": "grup2"}
    assert advise("ttest_ind", df, vars_) == advise("ttest_ind", df, vars_, params={"alpha": 0.01})


def test_dataset_kosong_tidak_melempar():
    assert advise("ttest_ind", pd.DataFrame(), {"column": "nilai"}) == []


def test_variabel_kosong_tidak_melempar():
    assert advise("ttest_ind", _df(), {}) == []
    assert advise("ttest_ind", _df(), {"column": "", "group": None}) == []


def test_issue_adalah_dataclass_lengkap():
    isu = Issue(id="MA-00", level="warn", field="column", message="m", fix="f", switch_to="anova_oneway")
    assert isu.id == "MA-00" and isu.switch_to == "anova_oneway"
    assert R.MISSING_WARN_PCT == 5.0 and R.MISSING_SERIOUS_PCT == 40.0 and R.OUTLIER_WARN_PCT == 5.0