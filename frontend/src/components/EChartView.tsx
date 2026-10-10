"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import ReactECharts from "echarts-for-react";

export type Viz = { type: string; data: Record<string, unknown>; metadata?: Record<string, unknown> };

type Palette = { axis: string; grid: string; ink: string; primary: string };

const FALLBACK: Palette = { axis: "#c9c6c1", grid: "#e7e4df", ink: "#4a4a4a", primary: "#2a2a86" };

/** Ambil warna dari token CSS supaya grafik ikut mode terang/gelap. */
function readPalette(): Palette {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    axis: v("--border", FALLBACK.axis),
    grid: v("--border", FALLBACK.grid),
    ink: v("--muted-foreground", FALLBACK.ink),
    primary: v("--primary", FALLBACK.primary),
  };
}

/** Render ECharts dari viz JSON backend. Murni visual — tak menghitung statistik. */
export default function EChartView({ viz }: { viz: Viz }) {
  const { resolvedTheme } = useTheme();
  const [pal, setPal] = useState<Palette>(FALLBACK);

  useEffect(() => {
    setPal(readPalette());
  }, [resolvedTheme]);

  const base = { grid: { containLabel: true }, textStyle: { fontSize: 11, color: pal.ink } };
  const axis = {
    axisLabel: { color: pal.ink },
    axisLine: { lineStyle: { color: pal.axis } },
    splitLine: { lineStyle: { color: pal.grid } },
  };
  let option: Record<string, unknown> = {};
  const d = viz.data as Record<string, unknown>;
  switch (viz.type) {
    case "histogram": {
      const bins = d.bins as number[];
      const labels = bins.slice(0, -1).map((b, i) => `${b}–${bins[i + 1]}`);
      option = { ...base, xAxis: { type: "category", data: labels, ...axis }, yAxis: { type: "value", ...axis }, series: [{ type: "bar", data: d.counts, itemStyle: { color: pal.primary } }] };
      break;
    }
    case "boxplot": {
      const groups = d.groups as { name: string; stats: number[] }[];
      option = { ...base, xAxis: { type: "category", data: groups.map((g) => g.name), ...axis }, yAxis: { type: "value", ...axis }, series: [{ type: "boxplot", data: groups.map((g) => g.stats), itemStyle: { color: pal.primary, borderColor: pal.primary } }] };
      break;
    }
    case "scatter": {
      const series: Record<string, unknown>[] = [{ type: "scatter", symbolSize: 8, data: d.points, itemStyle: { color: pal.primary } }];
      const trend = d.trend as { line: number[][] } | undefined;
      if (trend) series.push({ type: "line", data: trend.line, showSymbol: false, lineStyle: { color: pal.ink } });
      option = { ...base, xAxis: { type: "value", ...axis }, yAxis: { type: "value", ...axis }, series };
      break;
    }
    case "bar": {
      const cats = d.categories as string[];
      const series = (d.series as { name: string; values: number[] }[]).map((s) => ({ type: "bar", name: s.name, data: s.values }));
      option = { ...base, xAxis: { type: "category", data: cats, ...axis }, yAxis: { type: "value", ...axis }, series, legend: { textStyle: { color: pal.ink } } };
      break;
    }
    case "confusion": {
      const m = d.matrix as number[][];
      const cls = d.classes as string[];
      const data: [number, number, number][] = [];
      m.forEach((row, i) => row.forEach((v, j) => data.push([j, i, v])));
      option = { ...base, xAxis: { type: "category", data: cls, ...axis }, yAxis: { type: "category", data: cls, ...axis }, visualMap: { min: 0, calculable: true, orient: "horizontal", left: "center", textStyle: { color: pal.ink } }, series: [{ type: "heatmap", data, label: { show: true } }] };
      break;
    }
    case "roc": {
      const series: Record<string, unknown>[] = [];
      if ((d as Record<string, unknown>).mode === "binary") {
        const fpr = d.fpr as number[];
        const tpr = d.tpr as number[];
        series.push({ type: "line", showSymbol: false, data: fpr.map((x, i) => [x, (tpr as number[])[i]]) });
      } else {
        const per = (d.per_class || {}) as Record<string, { fpr: number[]; tpr: number[] }>;
        for (const [k, c] of Object.entries(per)) series.push({ type: "line", name: k, showSymbol: false, data: c.fpr.map((x, i) => [x, c.tpr[i]]) });
        (option as Record<string, unknown>).legend = { textStyle: { color: pal.ink } };
      }
      series.push({ type: "line", showSymbol: false, data: [[0, 0], [1, 1]], lineStyle: { type: "dashed", color: pal.ink } });
      option = { ...base, xAxis: { type: "value", min: 0, max: 1, ...axis }, yAxis: { type: "value", min: 0, max: 1, ...axis }, series };
      break;
    }
    case "cluster": {
      const pts = (d.x as number[]).map((x, i) => [x, (d.y as number[])[i], (d.label as (string | number)[])[i]]);
      option = { ...base, xAxis: { type: "value", ...axis }, yAxis: { type: "value", ...axis }, series: [{ type: "scatter", symbolSize: 9, data: pts }] };
      break;
    }
    case "topics":
    case "topterms": {
      const items = viz.type === "topics"
        ? (d.topics as { topic: number; top_words: { word: string; weight: number }[] }[]).flatMap((t) => t.top_words.slice(0, 6).map((w) => ({ name: `T${t.topic}:${w.word}`, v: w.weight })))
        : (d.terms as { term: string; weight: number }[]).slice(0, 15).map((w) => ({ name: w.term, v: w.weight }));
      option = { ...base, xAxis: { type: "value", ...axis }, yAxis: { type: "category", data: items.map((i) => i.name), ...axis }, series: [{ type: "bar", data: items.map((i) => i.v), itemStyle: { color: pal.primary } }] };
      break;
    }
    case "rules": {
      const rules = (d.rules as { antecedent: string[]; consequent: string[]; lift: number }[]).slice(0, 15);
      option = { ...base, xAxis: { type: "value", ...axis }, yAxis: { type: "category", data: rules.map((r) => `{${r.antecedent}}→{${r.consequent}}`), ...axis }, series: [{ type: "bar", data: rules.map((r) => r.lift), itemStyle: { color: pal.primary } }] };
      break;
    }
    default:
      return <p className="text-xs text-muted-foreground">Tipe {viz.type} belum interaktif — gunakan PNG.</p>;
  }
  return <ReactECharts option={option} style={{ height: 360 }} />;
}
