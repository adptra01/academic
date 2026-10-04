"""Architectural invariant (ADR-0001): AI/LLM dilarang menghitung angka ilmiah.
Test ini menggagalkan CI bila dependensi/inferensi LLM masuk ke backend.
"""
import pathlib

BACKEND = pathlib.Path(__file__).resolve().parents[1]
BANNED = [
    "openai", "anthropic", "groq", "google-generativeai", "cohere", "mistralai",
    "langchain", "langchain-core", "llama-index", "transformers", "diffusers",
    "sentence-transformers", "ollama", "vertexai", "bedrock",
]


def _norm(name: str) -> str:
    return name.strip().lower().replace("_", "-").split("==")[0].split(">=")[0].split("~=")[0]


def test_no_banned_packages_in_requirements():
    req = (BACKEND / "requirements.txt").read_text().splitlines()
    pkgs = {_norm(line) for line in req if line.strip() and not line.strip().startswith("#")}
    bad = pkgs.intersection(set(BANNED))
    assert not bad, f"LLM deps dilarang (ADR-0001): {bad}"


def test_no_banned_imports_in_app():
    hits = []
    for path in (BACKEND / "app").rglob("*.py"):
        text = path.read_text()
        for pkg in BANNED:
            mod = pkg.replace("-", "_")
            for line in text.splitlines():
                s = line.strip()
                if s.startswith(f"import {mod}") or s.startswith(f"from {mod}"):
                    hits.append(f"{path.name}: {s}")
    assert not hits, f"LLM imports dilarang (ADR-0001): {hits}"
