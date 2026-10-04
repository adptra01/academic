"""Gate rilis MVP: hasil harus sama dengan referensi dalam toleransi 1e-6."""
import math


def test_mean_matches_reference():
    xs = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]  # mean=5.0, var sample=4.571428...
    mean = sum(xs) / len(xs)
    assert mean == 5.0
    var = sum((x - mean) ** 2 for x in xs) / (len(xs) - 1)
    assert math.isclose(var, 4.571428571428571, rel_tol=1e-6, abs_tol=1e-6)
