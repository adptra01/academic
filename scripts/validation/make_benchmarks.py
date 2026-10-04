#!/usr/bin/env python3
"""Generate deterministic benchmark CSVs (no randomness libs, no numpy).
PRNG: LCG + Box-Muller — identical bytes on any machine/Python version.
Output: docs/validation-evidence/bench_*.csv
"""
import csv
import math
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "docs", "validation-evidence")
OUT = os.path.normpath(OUT)

_state = 42


def _lcg():
    global _state
    _state = (1103515245 * _state + 12345) % 2147483648
    return _state / 2147483648


def _normal(mu=0.0, sigma=1.0):
    u1 = max(_lcg(), 1e-12)
    u2 = _lcg()
    z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
    return mu + sigma * z


def _expo(mean=1.0):
    return -mean * math.log(max(_lcg(), 1e-12))


def _write(name, header, rows):
    path = os.path.join(OUT, name)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def main():
    os.makedirs(OUT, exist_ok=True)
    global _state

    _state = 42
    _write("bench_descriptive.csv", ["v"], [[round(_normal(100, 15), 1)] for _ in range(60)])

    _state = 42
    v = [round(_normal(100, 15), 1) for _ in range(50)]
    w = [round(_expo(20), 1) for _ in range(50)]
    _write("bench_normality.csv", ["v_normal", "w_skewed"], list(zip(v, w)))

    _state = 42
    xs = [_normal(50, 10) for _ in range(40)]
    ys = [0.6 * x + _normal(0, 5) for x in xs]
    _write("bench_corr.csv", ["x", "y"], [[round(x, 2), round(y, 2)] for x, y in zip(xs, ys)])

    _state = 42
    a = [round(_normal(50, 8), 1) for _ in range(30)]
    b = [round(_normal(55, 8), 1) for _ in range(30)]
    _write("bench_ttest_ind.csv", ["v", "g"], [[x, "A"] for x in a] + [[x, "B"] for x in b])

    _state = 43  # Welch case: unequal variances
    a = [round(_normal(50, 4), 1) for _ in range(30)]
    b = [round(_normal(55, 12), 1) for _ in range(30)]
    _write("bench_ttest_welch.csv", ["v", "g"], [[x, "A"] for x in a] + [[x, "B"] for x in b])

    _state = 42
    pre = [round(_normal(70, 8), 1) for _ in range(25)]
    post = [round(p + 5 + _normal(0, 2), 1) for p in pre]
    _write("bench_ttest_paired.csv", ["pre", "post"], list(zip(pre, post)))

    _state = 42
    _write("bench_ttest_onesamp.csv", ["v"], [[round(_normal(102, 10), 1)] for _ in range(40)])

    _state = 42
    g1 = [round(_normal(10, 2), 1) for _ in range(20)]
    g2 = [round(_normal(13, 2), 1) for _ in range(20)]
    g3 = [round(_normal(16, 2), 1) for _ in range(20)]
    _write("bench_anova.csv", ["v", "g"], [[x, "a"] for x in g1] + [[x, "b"] for x in g2] + [[x, "c"] for x in g3])

    rows = ([["ya", "l"]] * 30 + [["ya", "p"]] * 20 + [["tidak", "l"]] * 10 + [["tidak", "p"]] * 40)
    _write("bench_chi2.csv", ["c1", "c2"], rows)

    _write("bench_gof.csv", ["k"], [["A"]] * 50 + [["B"]] * 30 + [["C"]] * 20)

    _state = 42
    a = [round(_expo(10), 1) for _ in range(25)]
    b = [round(_expo(14), 1) for _ in range(25)]
    _write("bench_mannwhitney.csv", ["v", "g"], [[x, "A"] for x in a] + [[x, "B"] for x in b])

    _state = 42
    pre = [round(_expo(12), 1) for _ in range(20)]
    post = [round(p + 3 + _expo(1.5), 1) for p in pre]
    _write("bench_wilcoxon.csv", ["pre", "post"], list(zip(pre, post)))

    _state = 42
    g1 = [round(_expo(8), 1) for _ in range(20)]
    g2 = [round(_expo(11), 1) for _ in range(20)]
    g3 = [round(_expo(15), 1) for _ in range(20)]
    _write("bench_kruskal.csv", ["v", "g"], [[x, "a"] for x in g1] + [[x, "b"] for x in g2] + [[x, "c"] for x in g3])

    _state = 42
    x1 = [_normal(10, 2) for _ in range(50)]
    x2 = [_normal(5, 1) for _ in range(50)]
    y = [2 + 1.5 * a + -0.8 * b + _normal(0, 1) for a, b in zip(x1, x2)]
    _write("bench_regression.csv", ["x1", "x2", "y"], [[round(a, 2), round(b, 2), round(c, 2)] for a, b, c in zip(x1, x2, y)])

    print("done:", OUT)


if __name__ == "__main__":
    main()
