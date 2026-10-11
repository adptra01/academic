"""Export Engine — CSV (tabel hasil), XLSX (Ringkasan/Statistik/Perhitungan/Parameter), PDF/DOCX/TeX (tabel+grafik+lampiran)."""
from __future__ import annotations
import io
from typing import TYPE_CHECKING
import pandas as pd
from app.services.stats import fmt_p

if TYPE_CHECKING:  # reportlab diimpor malas — hemat waktu start API
    from reportlab.platypus import Table

DOC_TITLE = "Laporan Analisis Penelitian"
PARAM_LABELS = {"requested": "diminta", "resolved": "hasil"}


def _is_p_key(key: str) -> bool:
    """True bila nama field berisi nilai p: `p`, `p_value`, `p_raw`, `f_p`, `levene_p`, dst."""
    name = key.rsplit(".", 1)[-1].lower()
    return name == "p" or name.startswith("p_") or name.endswith("_p")


def _fmt_value(key: str, value) -> str:
    """Nilai p → fmt_p() (`p < .001`, bukan 1.2e-45); sisanya str() seperti sebelumnya."""
    if isinstance(value, (int, float)) and not isinstance(value, bool) and _is_p_key(key):
        return fmt_p(float(value))
    return str(value)


def _fmt_item(key: str, item) -> str:
    """Elemen list: dict dirender `k=v` supaya p-value di dalamnya ikut diformat."""
    if isinstance(item, dict):
        return ", ".join(f"{k}={_fmt_value(str(k), v)}" for k, v in item.items())
    return _fmt_value(key, item)


def flatten_stats(stats: dict | None, prefix: str = "") -> list[tuple[str, str]]:
    """Flatten dict statistik menjadi [(key, nilai)]; nilai p diformat dengan fmt_p()."""
    rows: list[tuple[str, str]] = []
    if not isinstance(stats, dict):
        return rows
    for k, v in stats.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            rows.extend(flatten_stats(v, prefix=key + "."))
        elif isinstance(v, list):
            rows.append((key, "; ".join(_fmt_item(key, x) for x in v[:10])))
        else:
            rows.append((key, _fmt_value(key, v)))
    return rows


def _appendix_facts(result: dict, context: dict) -> list[tuple[str, str]]:
    """Fakta lampiran (label, nilai) — sumber tunggal untuk PDF, DOCX, dan TeX."""
    ds = context.get("dataset") or {}
    method_name = context.get("method_name") or result.get("method_name") or "-"
    method_id = context.get("method") or result.get("method") or "-"
    variables = context.get("variables") or []
    facts: list[tuple[str, str]] = [
        ("ID Analisis", context.get("analysis_uid") or "-"),
        ("Metode", f"{method_name} ({method_id})" if method_id != "-" and method_id != method_name else method_name),
        ("Dataset", str(ds.get("filename") or "-")),
        ("Versi dataset", f"v{ds.get('version')}" if ds.get("version") is not None else "-"),
        ("Ukuran data", f"{ds.get('rows')} baris × {ds.get('cols')} kolom"),
        ("Jumlah variabel", str(len(variables))),
    ]
    for k, v in flatten_stats(context.get("parameters")):
        group, _, name = k.partition(".")
        label = f"Parameter {PARAM_LABELS.get(group, group)}{'.' + name if name else ''}"
        facts.append((label, v))
    facts += [
        ("Waktu", context.get("timestamp") or "-"),
        ("Versi software", context.get("software_version") or "-"),
        ("Result hash", context.get("result_hash") or "-"),
    ]
    return facts


def _appendix_variables(context: dict) -> list[str]:
    """Baris variabel untuk lampiran: `nama — tipe / peran`. Nama tetap apa adanya (milik pengguna)."""
    return [f"{v.get('name')} — {v.get('type') or '-'} / {v.get('role') or '-'}" for v in (context.get("variables") or [])[:50]]


def _esc(value) -> str:
    """Escape XML untuk reportlab Paragraph — data pengguna bisa memuat `&` atau `<`."""
    from xml.sax.saxutils import escape

    return escape(str(value))


def _kv_table(rows: list[list[str]]) -> Table:
    """Tabel 2 kolom (Kunci/Nilai) dengan gaya seragam untuk PDF."""
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import Table, TableStyle

    t = Table(rows, colWidths=[6 * cm, 10 * cm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e5e5")), ("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    return t


def build_csv(result: dict) -> bytes:
    rows = [("method", result.get("method_name", "")), ("n", str(result.get("n")))]
    rows += flatten_stats(result.get("statistics"))
    dec = result.get("decision") or {}
    if dec.get("text"):
        rows.append(("decision", dec.get("text", "-")))
    # `statistics` pada sebagian metode sudah memuat `p_value`, dan `decision.p`
    # berisi nilai yang sama. Sebelumnya keduanya ditulis -> kunci `p_value`
    # muncul dua kali dalam satu CSV. Sekarang hanya ditulis bila belum ada.
    if "p_value" not in {k for k, _ in rows}:
        p = dec.get("p", "-")
        rows.append(("p_value", fmt_p(p) if "p" in dec else str(p)))
    eff = result.get("effect_size") or {}
    for k, v in eff.items():
        rows.append((f"effect_{k}", _fmt_value(f"effect_{k}", v)))
    df = pd.DataFrame(rows, columns=["Kunci", "Nilai"])
    return df.to_csv(index=False).encode("utf-8")


def build_xlsx(result: dict) -> bytes:
    """Empat sheet: Ringkasan, Statistik, Perhitungan, Parameter."""
    buf = io.BytesIO()
    dec = result.get("decision") or {}
    p = dec.get("p", "-")
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        pd.DataFrame([
            ("Metode", result.get("method_name", "")),
            ("n", result.get("n")),
            ("Keputusan", dec.get("text", "-")),
            ("p-value", fmt_p(p) if "p" in dec else str(p)),
            ("Interpretasi", result.get("interpretation", "")),
        ], columns=["Kunci", "Nilai"]).to_excel(w, sheet_name="Ringkasan", index=False)
        pd.DataFrame(flatten_stats(result.get("statistics")), columns=["Kunci", "Nilai"]).to_excel(w, sheet_name="Statistik", index=False)
        pd.DataFrame([(i + 1, s) for i, s in enumerate(result.get("calculation", []))], columns=["Langkah", "Detail"]).to_excel(w, sheet_name="Perhitungan", index=False)
        pd.DataFrame(flatten_stats(result.get("parameters")), columns=["Parameter", "Nilai"]).to_excel(w, sheet_name="Parameter", index=False)
    buf.seek(0)
    return buf.read()


def build_pdf(result: dict, context: dict, chart_png: bytes | None) -> bytes:
    """PDF: judul, tabel statistik, rumus, perhitungan, grafik, dan lampiran.

    context: dataset info, variables, parameters, analysis_uid, timestamp,
    software_version, result_hash.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.platypus import Image as RLImage, Paragraph, SimpleDocTemplate, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    import tempfile, os

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    el = []
    el.append(Paragraph(DOC_TITLE, styles["Title"]))
    el.append(Spacer(1, 0.4 * cm))
    dec = result.get("decision") or {}
    el.append(Paragraph(f"<b>{_esc(result.get('method_name', ''))}</b> &mdash; n={_esc(result.get('n'))} &mdash; {_esc(dec.get('text', '-'))}", styles["Heading2"]))
    el.append(Paragraph(_esc(result.get("interpretation", "")), styles["BodyText"]))
    el.append(Spacer(1, 0.3 * cm))
    stat_rows = [["Kunci", "Nilai"]] + [[k, v[:80]] for k, v in flatten_stats(result.get("statistics"))][:30]
    el.append(_kv_table(stat_rows))
    el.append(Spacer(1, 0.3 * cm))
    el.append(Paragraph("Rumus", styles["Heading3"]))
    el.append(Paragraph(f"<font face='Courier' size=9>{_esc(result.get('formula_latex', ''))}</font>", styles["BodyText"]))
    el.append(Paragraph("Perhitungan", styles["Heading3"]))
    for i, step in enumerate(result.get("calculation", []), 1):
        el.append(Paragraph(_esc(f"{i}. {step}"), styles["BodyText"]))
    tmppath = None
    if chart_png:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(chart_png)
            tmppath = f.name
        el.append(Spacer(1, 0.3 * cm))
        el.append(Paragraph("Grafik", styles["Heading3"]))
        el.append(RLImage(tmppath, width=15 * cm, height=9 * cm))
    el.append(Paragraph("Lampiran &mdash; Reproduksibilitas", styles["Heading2"]))
    el.append(_kv_table([["Keterangan", "Nilai"]] + [list(f) for f in _appendix_facts(result, context)]))
    variables = _appendix_variables(context)
    if variables:
        el.append(Paragraph("Variabel", styles["Heading3"]))
        for line in variables:
            el.append(Paragraph(_esc(line), styles["BodyText"]))
    try:
        doc.build(el)
    finally:
        if tmppath:  # dihapus setelah build (image sudah dibaca reportlab)
            os.unlink(tmppath)
    buf.seek(0)
    return buf.read()


APPENDIX_KEYS = ["dataset", "variables", "parameters", "formula_latex", "calculation", "result"]


def _latex_escape(s: str) -> str:
    return (s.replace("\\", "\\textbackslash{}").replace("&", "\\&").replace("%", "\\%")
             .replace("$", "\\$").replace("#", "\\#").replace("_", "\\_")
             .replace("{", "\\{").replace("}", "\\}").replace("~", "\\textasciitilde{}")
             .replace("^", "\\textasciicircum{}"))


def build_latex(result: dict, context: dict, chart_filename: str) -> bytes:
    """LaTeX (article + booktabs) untuk paper: tabel, formula, figure, lampiran."""
    lines = [
        "\\documentclass[11pt,a4paper]{article}",
        "\\usepackage[utf8]{inputenc}\\usepackage{booktabs}\\usepackage{graphicx}\\usepackage{hyperref}",
        f"\\title{{{DOC_TITLE}}}", "\\author{Platform Analisis Penelitian Akademik}",
        "\\begin{document}", "\\maketitle",
        f"\\section*{{{_latex_escape(str(result.get('method_name', '')))}}}",
        f"n = {_latex_escape(str(result.get('n', '')))}",
        "",
        _latex_escape(str(result.get("interpretation", ""))),
        "",
        "\\subsection*{Statistik}",
        "\\begin{tabular}{ll}\\toprule\nKunci & Nilai \\\\ \\midrule",
    ]
    for k, v in flatten_stats(result.get("statistics"))[:40]:
        lines.append(f"{_latex_escape(k)} & {_latex_escape(v[:100])} \\\\")
    lines += [
        "\\bottomrule\\end{tabular}",
        "",
        "\\subsection*{Rumus}",
        "\\begin{verbatim}",
        str(result.get("formula_latex", "")),
        "\\end{verbatim}",
        "",
        "\\subsection*{Perhitungan}",
        "\\begin{enumerate}",
    ]
    for step in result.get("calculation", []):
        lines.append(f"\\item {_latex_escape(str(step))}")
    lines += [
        "\\end{enumerate}",
        "",
        "\\subsection*{Grafik}",
        f"% Letakkan file grafik {chart_filename} di folder yang sama lalu uncomment:",
        f"% \\includegraphics[width=\\textwidth]{{{chart_filename}}}",
        "",
        "\\section*{Lampiran --- Reproduksibilitas}",
    ]
    for label, value in _appendix_facts(result, context):
        # `×` ditulis sebagai `\times` supaya aman di pdflatex (setelah escape, agar `$` tak ter-escape)
        v = _latex_escape(value).replace("×", "$\\times$")
        lines.append(f"{_latex_escape(label)}: {v} \\\\")
    variables = _appendix_variables(context)
    if variables:
        lines.append("\\begin{itemize}")
        lines += [f"\\item {_latex_escape(v)}" for v in variables]
        lines.append("\\end{itemize}")
    lines.append("\\end{document}")
    return "\n".join(lines).encode("utf-8")


def build_docx(result: dict, context: dict, chart_png: bytes | None) -> bytes:
    """DOCX untuk skripsi (Word): judul, keputusan, tabel, rumus, grafik, lampiran."""
    from docx import Document
    from docx.shared import Cm
    import tempfile, os

    doc = Document()
    doc.add_heading(DOC_TITLE, level=1)
    dec = result.get("decision") or {}
    doc.add_heading(f"{result.get('method_name', '')} — n={result.get('n')} — {dec.get('text', '-')}", level=2)
    doc.add_paragraph(result.get("interpretation", ""))
    doc.add_heading("Statistik", level=3)
    rows = flatten_stats(result.get("statistics"))[:40]
    table = doc.add_table(rows=1 + len(rows), cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].text, table.rows[0].cells[1].text = "Kunci", "Nilai"
    for i, (k, v) in enumerate(rows, 1):
        table.rows[i].cells[0].text, table.rows[i].cells[1].text = k, v[:120]
    doc.add_heading("Rumus", level=3)
    doc.add_paragraph(result.get("formula_latex", ""))
    doc.add_heading("Perhitungan", level=3)
    for i, step in enumerate(result.get("calculation", []), 1):
        doc.add_paragraph(f"{i}. {step}")
    if chart_png:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(chart_png)
            tmppath = f.name
        try:
            doc.add_heading("Grafik", level=3)
            doc.add_picture(tmppath, width=Cm(14))
        finally:
            os.unlink(tmppath)
    doc.add_heading("Lampiran — Reproduksibilitas", level=2)
    facts = _appendix_facts(result, context)
    fact_table = doc.add_table(rows=1 + len(facts), cols=2)
    fact_table.style = "Table Grid"
    fact_table.rows[0].cells[0].text, fact_table.rows[0].cells[1].text = "Keterangan", "Nilai"
    for i, (label, value) in enumerate(facts, 1):
        fact_table.rows[i].cells[0].text, fact_table.rows[i].cells[1].text = label, value
    for line in _appendix_variables(context):
        doc.add_paragraph(line, style="List Bullet")
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()