#!/usr/bin/env python3
"""validate.py — validate statusline components against the spec.

Usage:
    validate.py <components_dir> [--schema <component.schema.json>]

Validates every <components_dir>/<id>/ against the component spec and the security
contract. Used two ways:
  - built-ins CI: validate.py plugin/components
  - submission CI: clone each registry source, validate.py <clone>/<path>

Exits non-zero (and prints FAIL lines) on any violation. Pure stdlib except
`jsonschema` (installed in CI). Without jsonschema it still runs the structural +
security checks and just skips strict JSON-Schema validation (prints a notice).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_SCHEMA = HERE / "component.schema.json"

# render must never touch the network — only fetch may. These symbols in a render
# entry are a hard fail.
NET_IN_RENDER = re.compile(
    r"\b(urllib|requests|httpx|socket|curl|wget|http\.client|fetch\()", re.I
)
# obvious hardcoded secrets — provider key prefixes + assignments to secret-ish names.
SECRET_PATTERNS = [
    re.compile(r"\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b"),
    re.compile(r"(?i)\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}['\"]"),
]
# url host extractor, to cross-check declared network allow-list
URL_HOST = re.compile(r"https?://([A-Za-z0-9.\-]+)")

problems: list[str] = []
notices: list[str] = []


def fail(cid: str, msg: str) -> None:
    problems.append(f"FAIL [{cid}] {msg}")


def load_schema_validator(schema_path: Path):
    try:
        import jsonschema  # type: ignore
    except ImportError:
        notices.append("notice: jsonschema not installed — skipping strict schema check")
        return None
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        notices.append(f"notice: cannot read schema ({e}) — skipping strict schema check")
        return None
    return jsonschema.Draft202012Validator(schema)


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except OSError:
        return ""


def validate_component(cdir: Path, validator) -> None:
    cid = cdir.name
    mf = cdir / "component.json"
    if not mf.exists():
        fail(cid, "no component.json")
        return
    try:
        m = json.loads(mf.read_text(encoding="utf-8"))
    except ValueError as e:
        fail(cid, f"component.json invalid JSON: {e}")
        return

    # strict schema
    if validator is not None:
        for err in sorted(validator.iter_errors(m), key=str):
            fail(cid, f"schema: {err.message} (at {'/'.join(map(str, err.path)) or '<root>'})")

    # id == dirname
    if m.get("id") != cid:
        fail(cid, f"id '{m.get('id')}' != dir name '{cid}'")

    # render entry exists
    render = (m.get("render") or {}).get("entry")
    if not render:
        fail(cid, "render.entry missing")
    elif not (cdir / render).exists():
        fail(cid, f"render entry '{render}' not found")

    # README + preview required for marketplace listing
    if not (cdir / "README.md").exists():
        fail(cid, "README.md missing (required for the marketplace)")
    prev = cdir / "preview.txt"
    if not prev.exists() or not read_text(prev).strip():
        fail(cid, "preview.txt missing/empty (required so the web can show it)")

    # security: render must not touch the network — but a single-file widget whose
    # render entry IS its fetch entry (dual-mode via a --fetch arg) legitimately
    # imports networking for the fetch path, so only enforce this for components
    # whose render is a SEPARATE file from fetch.
    fetch_entry = (m.get("fetch") or {}).get("entry") if isinstance(m.get("fetch"), dict) else None
    if render and (cdir / render).exists() and render != fetch_entry:
        rsrc = read_text(cdir / render)
        if NET_IN_RENDER.search(rsrc):
            fail(cid, f"render entry '{render}' looks like it touches the network — render must only read cache/stdin")

    # security: no hardcoded secrets anywhere in the component
    for f in cdir.rglob("*"):
        if f.is_file() and f.suffix in {".sh", ".py", ".js", ".json", ".txt", ".md"}:
            txt = read_text(f)
            for pat in SECRET_PATTERNS:
                if pat.search(txt):
                    fail(cid, f"possible hardcoded secret in {f.name}")
                    break

    # security: declared network allow-list must cover hosts the fetch script contacts
    fetch = m.get("fetch") or {}
    fentry = fetch.get("entry") if isinstance(fetch, dict) else None
    if fentry and (cdir / fentry).exists():
        declared = set(
            (m.get("requires", {}).get("network") or [])
            + (m.get("capabilities", {}).get("network") or [])
        )
        found = set(URL_HOST.findall(read_text(cdir / fentry)))
        undeclared = {h for h in found if h not in declared}
        if undeclared:
            fail(cid, f"fetch contacts undeclared host(s) {sorted(undeclared)} — add them to requires.network")


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print("usage: validate.py <components_dir> [--schema <file>]", file=sys.stderr)
        return 2
    comp_dir = Path(args[0])
    schema_path = DEFAULT_SCHEMA
    if "--schema" in args:
        schema_path = Path(args[args.index("--schema") + 1])
    if not comp_dir.is_dir():
        print(f"FAIL: components dir not found: {comp_dir}", file=sys.stderr)
        return 2

    validator = load_schema_validator(schema_path)
    dirs = sorted(d for d in comp_dir.iterdir() if d.is_dir())
    if not dirs:
        print(f"FAIL: no component dirs under {comp_dir}", file=sys.stderr)
        return 2

    for d in dirs:
        validate_component(d, validator)

    for n in notices:
        print(n)
    if problems:
        print(f"\n{len(problems)} problem(s) in {comp_dir}:")
        for p in problems:
            print("  " + p)
        return 1
    print(f"OK — {len(dirs)} component(s) in {comp_dir} valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
