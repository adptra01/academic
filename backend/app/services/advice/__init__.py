"""Layanan saran analisis (`advice`) — deterministik, tanpa LLM.

Aturan if/elif atas profil data + pilihan metode. Angka di dalam pesan
(`jumlah duplikat`, `% kosong`, `pagar IQR`) dihitung langsung dari DataFrame
yang dianalisis; tidak ada statistik inferensial, tidak ada jaringan, tidak
ada randomness. Lihat `docs/adr/0001-ai-must-not-compute.md`.

Penggunaan:
    from app.services.advice import advise
    saran = advise("ttest_ind", df, {"column": "diggCount", "group": "grup"}, profile=profil)
"""
from app.services.advice.rules import Issue, advise

__all__ = ["Issue", "advise"]