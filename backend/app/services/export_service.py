"""Export Engine — CSV (result table), XLSX (Summary/Data/Calculation), PDF (tabel+grafik+appendix)."""
from __future__ import annotations
import io
import pandas as pd


def flatten_stats(stats: dict | None, prefix: str = "") -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    if not isinstance(stats, dict):
        return rows
    for k, v in stats.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            rows.extend(flatten_stats(v, prefix=key + "."))
        elif isinstance(v, list):
            rows.append((key, "; ".join(str(x) for x in v[:10])))
        else:
            rows.append((key, str(v)))
    return rows


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
        rows.append(("p_value", str(dec.get("p", "-"))))
    eff = result.get("effect_size") or {}
    for k, v in eff.items():
        rows.append((f"effect_{k}", str(v)))
    df = pd.DataFrame(rows, columns=["key", "value"])
    return df.to_csv(index=False).encode("utf-8")


def build_xlsx(result: dict) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        dec = result.get("decision") or {}
        pd.DataFrame([
            ("Method", result.get("method_name", "")),
            ("n", result.get("n")),
            ("Decision", dec.get("text", "-")),
            ("p-value", dec.get("p", "-")),
            ("Interpretation", result.get("interpretation", "")),
        ], columns=["key", "value"]).to_excel(w, sheet_name="Summary", index=False)
        pd.DataFrame(flatten_stats(result.get("statistics")), columns=["key", "value"]).to_excel(w, sheet_name="Statistics", index=False)
        pd.DataFrame([(i + 1, s) for i, s in enumerate(result.get("calculation", []))], columns=["step", "detail"]).to_excel(w, sheet_name="Calculation", index=False)
        pd.DataFrame(list((result.get("parameters") or {}).items()), columns=["param", "value"]).to_excel(w, sheet_name="Parameters", index=False)
    buf.seek(0)
    return buf.read()


def build_pdf(result: dict, context: dict, chart_png: bytes | None) -> bytes:
    """context: dataset info, variables, analysis_uid, timestamp, software_version."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.platypus import Image as RLImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    import tempfile, os

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    el = []
    el.append(Paragraph("Academic Research Analysis Report", styles["Title"]))
    el.append(Spacer(1, 0.4 * cm))
    dec = result.get("decision") or {}
    el.append(Paragraph(f"<b>{result.get('method_name', '')}</b> — n={result.get('n')} — {dec.get('text', '-')}", styles["Heading2"]))
    el.append(Paragraph(result.get("interpretation", ""), styles["BodyText"]))
    el.append(Spacer(1, 0.3 * cm))
    stat_rows = [["Key", "Value"]] + [[k, v[:80]] for k, v in flatten_stats(result.get("statistics"))][:30]
    t = Table(stat_rows, colWidths=[6 * cm, 10 * cm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e5e5")), ("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 9)]))
    el.append(t)
    el.append(Spacer(1, 0.3 * cm))
    el.append(Paragraph("<b>Formula</b>", styles["Heading3"]))
    el.append(Paragraph(f"<font face='Courier' size=9>{result.get('formula_latex', '')}</font>", styles["BodyText"]))
    el.append(Paragraph("<b>Calculation</b>", styles["Heading3"]))
    for i, step in enumerate(result.get("calculation", []), 1):
        el.append(Paragraph(f"{i}. {step}", styles["BodyText"]))
    if chart_png:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(chart_png)
            tmppath = f.name
        try:
            el.append(Spacer(1, 0.3 * cm))
            el.append(Paragraph("<b>Chart</b>", styles["Heading3"]))
            el.append(RLImage(tmppath, width=15 * cm, height=9 * cm))
        finally:
            pass  # dihapus setelah build
        doc.build(el)
        os.unlink(tmppath)
    else:
        doc.build(el)
    buf.seek(0)
    return buf.read()


APPENDIX_KEYS = ["dataset", "variables", "parameters", "formula_latex", "calculation", "result"]


def _latex_escape(s: str) -> str:
    return (s.replace("\\", "\\textbackslash{}").replace("&", "\\&").replace("%", "\\%")
             .replace("$", "\\$").replace("#", "\\#").replace("_", "\\_")
             .replace("{", "\\{").replace("}", "\\}").replace("~", "\\textasciitilde{}")
             .replace("^", "\\textasciicircum{}"))


def build_latex(result: dict, context: dict, chart_filename: str) -> bytes:
    """LaTeX (article + booktabs) untuk paper: tabel, formula, figure, appendix."""
    lines = [
        "\\documentclass[11pt,a4paper]{article}",
        "\\usepackage[utf8]{inputenc}\\usepackage{booktabs}\\usepackage{graphicx}\\usepackage{hyperref}",
        "\\title{Academic Research Analysis Report}", "\\author{Academic Research Analysis Platform}",
        "\\begin{document}", "\\maketitle",
        f"\\section*{{{_latex_escape(str(result.get('method_name', '')))}}}",
        f"n = {_latex_escape(str(result.get('n', '')))}",
        "",
        _latex_escape(str(result.get("interpretation", ""))),
        "",
        "\\subsection*{Statistics}",
        "\\begin{tabular}{ll}\\toprule\nKey & Value \\\\ \\midrule",
    ]
    for k, v in flatten_stats(result.get("statistics"))[:40]:
        lines.append(f"{_latex_escape(k)} & {_latex_escape(v[:100])} \\\\")
    lines += [
        "\\bottomrule\\end{tabular}",
        "",
        "\\subsection*{Formula}",
        "\\begin{verbatim}",
        str(result.get("formula_latex", "")),
        "\\end{verbatim}",
        "",
        "\\subsection*{Calculation}",
        "\\begin{enumerate}",
    ]
    for step in result.get("calculation", []):
        lines.append(f"\\item {_latex_escape(str(step))}")
    lines += [
        "\\end{enumerate}",
        "",
        "\\subsection*{Chart}",
        f"% Letakkan file grafik {chart_filename} di folder yang sama lalu uncomment:",
        f"% \\includegraphics[width=\\textwidth]{{{chart_filename}}}",
        "",
        "\\section*{Appendix --- reproducibility}",
    ]
    ds = context.get("dataset") or {}
    lines.append(f"Dataset: {_latex_escape(str(ds.get('filename', '')))} (version v{ds.get('version')}, {ds.get('rows')} rows).")
    lines.append("\\begin{itemize}")
    for v in (context.get("variables") or [])[:50]:
        lines.append(f"\\item {_latex_escape(str(v.get('name')))}: {_latex_escape(str(v.get('type')))} / {_latex_escape(str(v.get('role')))}")
    lines.append("\\end{itemize}")
    lines.append(f"Analysis {context.get('analysis_uid')} --- {context.get('timestamp')} --- {context.get('software_version')}")
    lines.append("\\end{document}")
    return "\n".join(lines).encode("utf-8")


def build_docx(result: dict, context: dict, chart_png: bytes | None) -> bytes:
    """DOCX untuk skripsi (Word): judul, keputusan, tabel, formula, grafik, appendix."""
    from docx import Document
    from docx.shared import Cm
    import tempfile, os

    doc = Document()
    doc.add_heading("Academic Research Analysis Report", level=1)
    dec = result.get("decision") or {}
    doc.add_heading(f"{result.get('method_name', '')} — n={result.get('n')} — {dec.get('text', '-')}", level=2)
    doc.add_paragraph(result.get("interpretation", ""))
    doc.add_heading("Statistics", level=3)
    rows = flatten_stats(result.get("statistics"))[:40]
    table = doc.add_table(rows=1 + len(rows), cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].text, table.rows[0].cells[1].text = "Key", "Value"
    for i, (k, v) in enumerate(rows, 1):
        table.rows[i].cells[0].text, table.rows[i].cells[1].text = k, v[:120]
    doc.add_heading("Formula", level=3)
    doc.add_paragraph(result.get("formula_latex", ""))
    doc.add_heading("Calculation", level=3)
    for i, step in enumerate(result.get("calculation", []), 1):
        doc.add_paragraph(f"{i}. {step}")
    if chart_png:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(chart_png)
            tmppath = f.name
        try:
            doc.add_heading("Chart", level=3)
            doc.add_picture(tmppath, width=Cm(14))
        finally:
            os.unlink(tmppath)
    doc.add_heading("Appendix — reproducibility", level=2)
    ds = (context.get("dataset") or {})
    doc.add_paragraph(f"Dataset: {ds.get('filename')} (version v{ds.get('version')}, {ds.get('rows')} rows × {ds.get('cols')} cols)")
    for v in (context.get("variables") or [])[:50]:
        doc.add_paragraph(f"{v.get('name')}: {v.get('type')} / {v.get('role')}", style="List Bullet")
    doc.add_paragraph(f"Analysis: {context.get('analysis_uid')} · {context.get('timestamp')} · {context.get('software_version')}")
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()
