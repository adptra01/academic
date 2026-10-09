"use client";
import ReactECharts from "echarts-for-react";

export type Viz = { type: string; data: Record<string, unknown>; metadata?: Record<string, unknown> };

const gray = "#4a4a4a";

/** Render ECharts dari viz JSON backend. Murni visual — tak menghitung statistik. */
export default function EChartView({ viz }: { viz: Viz }) {
  const base = { grid: { containLabel: true }, textStyle: { fontSize: 11 } };
  let option: Record<string, unknown> = {};
  const d = viz.data as Record<string, unknown>;
  switch (viz.type) {
    case "histogram": {
      const bins = d.bins as number[];
      const labels = bins.slice(0, -1).map((b, i) => `${b}–${bins[i + 1]}`);
      option = { ...base, xAxis: { type: "category", data: labels }, yAxis: { type: "value" }, series: [{ type: "bar", data: d.counts, itemStyle: { color: gray } }] };
      break;
    }
    case "boxplot": {
      const groups = d.groups as { name: string; stats: number[] }[];
      option = { ...base, xAxis: { type: "category", data: groups.map((g) => g.name) }, yAxis: { type: "value" }, series: [{ type: "boxplot", data: groups.map((g) => g.stats) }] };
      break;
    }
    case "scatter": {
      const series: Record<string, unknown>[] = [{ type: "scatter", symbolSize: 8, data: d.points, itemStyle: { color: "#333" } }];
      const trend = d.trend as { line: number[][] } | undefined;
      if (trend) series.push({ type: "line", data: trend.line, showSymbol: false, lineStyle: { color: "#000" } });
      option = { ...base, xAxis: { type: "value" }, yAxis: { type: "value" }, series };
      break;
    }
    case "bar": {
      const cats = d.categories as string[];
      const series = (d.series as { name: string; values: number[] }[]).map((s) => ({ type: "bar", name: s.name, data: s.values }));
      option = { ...base, xAxis: { type: "category", data: cats }, yAxis: { type: "value" }, series, legend: {} };
      break;
    }
    case "confusion": {
      const m = d.matrix as number[][];
      const cls = d.classes as string[];
      const data: [number, number, number][] = [];
      m.forEach((row, i) => row.forEach((v, j) => data.push([j, i, v])));
      option = { ...base, xAxis: { type: "category", data: cls }, yAxis: { type: "category", data: cls }, visualMap: { min: 0, calculable: true, orient: "horizontal", left: "center" }, series: [{ type: "heatmap", data, label: { show: true } }] };
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
        (option as Record<string, unknown>).legend = {};
      }
      series.push({ type: "line", showSymbol: false, data: [[0, 0], [1, 1]], lineStyle: { type: "dashed" } });
      option = { ...base, xAxis: { type: "value", min: 0, max: 1 }, yAxis: { type: "value", min: 0, max: 1 }, series };
      break;
    }
    case "cluster": {
      const pts = (d.x as number[]).map((x, i) => [x, (d.y as number[])[i], (d.label as (string | number)[])[i]]);
      option = { ...base, xAxis: { type: "value" }, yAxis: { type: "value" }, series: [{ type: "scatter", symbolSize: 9, data: pts }] };
      break;
    }
    case "topics":
    case "topterms": {
      const items = viz.type === "topics"
        ? (d.topics as { topic: number; top_words: { word: string; weight: number }[] }[]).flatMap((t) => t.top_words.slice(0, 6).map((w) => ({ name: `T${t.topic}:${w.word}`, v: w.weight })))
        : (d.terms as { term: string; weight: number }[]).slice(0, 15).map((w) => ({ name: w.term, v: w.weight }));
      option = { ...base, xAxis: { type: "value" }, yAxis: { type: "category", data: items.map((i) => i.name) }, series: [{ type: "bar", data: items.map((i) => i.v), itemStyle: { color: gray } }] };
      break;
    }
    case "rules": {
      const rules = (d.rules as { antecedent: string[]; consequent: string[]; lift: number }[]).slice(0, 15);
      option = { ...base, xAxis: { type: "value" }, yAxis: { type: "category", data: rules.map((r) => `{${r.antecedent}}→{${r.consequent}}`) }, series: [{ type: "bar", data: rules.map((r) => r.lift), itemStyle: { color: gray } }] };
      break;
    }
    default:
      return <p className="text-xs text-slate-500">Tipe {viz.type} belum interaktif — gunakan PNG.</p>;
  }
  return <ReactECharts option={option} style={{ height: 360 }} />;
}
