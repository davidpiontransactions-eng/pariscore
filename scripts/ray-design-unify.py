#!/usr/bin/env python3
"""Ray-based CSS/HTML design system unification — automate Phase 1.2+.

Usage:
    python scripts/ray-design-unify.py scan          # scan all hex by sport section
    python scripts/ray-design-unify.py analyze       # analyze hex→var candidates
    python scripts/ray-design-unify.py replace       # dry-run replacements
    python scripts/ray-design-unify.py replace --apply  # apply replacements
    python scripts/ray-design-unify.py validate      # count remaining hex per section

Orchestrates parallel Ray workers per sport section (tennis, cs2, nba, wnba, f1, mma, cycling).
"""

from __future__ import annotations

import os
import re
import sys
import json
import argparse
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

import ray

# ── Config ──────────────────────────────────────────────────
PROJECT = Path(__file__).resolve().parent.parent
HTML = PROJECT / "pariscore.html"

# Sport sections: (name, id_attr_or_marker, sport_accent)
SECTIONS: list[dict] = [
    {
        "name": "tennis",
        "marker": "#page-tennis",
        "accent": "#ccff00",
        "replace": ["#ff6d2e"],
    },
    {"name": "f1", "marker": "#page-f1", "accent": "#ff0043", "replace": ["#ff0043"]},
    {"name": "cs2", "marker": "#page-cs2", "accent": "#00d4ff", "replace": ["#00d4ff"]},
    {"name": "nba", "marker": "#page-nba", "accent": "#ff6b00", "replace": ["#ff6b00"]},
    {"name": "wnba", "marker": "#page-wnba", "accent": "#ff6b00", "replace": []},
    {"name": "mma", "marker": "#page-mma", "accent": "#E3001B", "replace": ["#E3001B"]},
    {
        "name": "cycling",
        "marker": "#page-cycling",
        "accent": "#f4d03f",
        "replace": ["#f4d03f"],
    },
]

CSS_VAR_MAP: dict[str, str] = {
    "background": "var(--bg)",
    "background2": "var(--bg2)",
    "background3": "var(--bg3)",
    "background4": "var(--bg4)",
    "text": "var(--text)",
    "text2": "var(--text2)",
    "accent": "var(--accent)",
    "blue": "var(--blue)",
    "red": "var(--red)",
    "green": "var(--green)",
    "orange": "var(--orange)",
    "border": "var(--border)",
    "radius": "var(--radius)",
    "radius-sm": "var(--radius-sm)",
    "radius-pill": "var(--radius-pill)",
    "font-head": "var(--font-head)",
    "font-body": "var(--font-body)",
    "font-mono": "var(--font-mono)",
    "sport-accent": "var(--sport-accent)",
    "sport-bg": "var(--sport-bg)",
    "sport-card": "var(--sport-card)",
    "sport-secondary": "var(--sport-secondary)",
}


# ── Data ────────────────────────────────────────────────────
@dataclass
class HexFinding:
    value: str
    line: int
    context: str
    section: str
    is_var_candidate: bool = False
    suggested_var: Optional[str] = None


@dataclass
class SectionReport:
    name: str
    line_start: int
    line_end: int
    total_hex: int = 0
    replaceable: int = 0
    findings: list[HexFinding] = field(default_factory=list)


# ── Ray Workers ────────────────────────────────────────────
@ray.remote
class HexScanner:
    def __init__(self, html_path: str):
        self.html_path = html_path
        self.lines = Path(html_path).read_text(encoding="utf-8").splitlines()

    def scan_section(self, section: dict) -> SectionReport:
        name = section["name"]
        marker = section["marker"]
        replace_hexes = section.get("replace", [])

        # Find section boundaries
        line_start = 1
        line_end = len(self.lines)
        for i, line in enumerate(self.lines, 1):
            if marker in line:
                line_start = i
                break

        # Find next section boundary
        for other in SECTIONS:
            if other["name"] == name:
                continue
            o_marker = other["marker"]
            if o_marker == marker:
                continue
            for i, line in enumerate(self.lines, 1):
                if i > line_start and o_marker in line:
                    if i < line_end:
                        line_end = i
                    break

        report = SectionReport(name=name, line_start=line_start, line_end=line_end)

        hex_pattern = re.compile(r"#[0-9a-fA-F]{3,8}\b")
        for i in range(line_start - 1, min(line_end, len(self.lines))):
            line = self.lines[i]
            for m in hex_pattern.finditer(line):
                val = m.group().lower()
                col = m.start()
                snippet = line[max(0, col - 20) : col + 25].strip()
                findings = HexFinding(
                    value=val,
                    line=i + 1,
                    context=snippet,
                    section=name,
                )
                if val in [h.lower() for h in replace_hexes]:
                    findings.is_var_candidate = True
                    findings.suggested_var = "var(--sport-accent)"
                report.findings.append(findings)

        report.total_hex = len(report.findings)
        report.replaceable = sum(1 for f in report.findings if f.is_var_candidate)
        return report


@ray.remote
class HexReplacer:
    def __init__(self, html_path: str):
        self.html_path = html_path

    def preview(self, section: str, hex_from: str, var_to: str) -> list[dict]:
        lines = Path(self.html_path).read_text(encoding="utf-8").splitlines()
        changes = []
        for i, line in enumerate(lines, 1):
            if hex_from.lower() in line.lower():
                # Check if inside section
                if f"#page-{section}" in line or f"#{section}" in line:
                    changes.append(
                        {"line": i, "old": line, "new": line.replace(hex_from, var_to)}
                    )
        return changes

    def apply(self, section: str, hex_from: str, var_to: str) -> int:
        path = Path(self.html_path)
        content = path.read_text(encoding="utf-8")
        count = content.count(hex_from)
        content = content.replace(hex_from, var_to)
        path.write_text(content, encoding="utf-8")
        return count


# ── Orchestrator ───────────────────────────────────────────
class DesignUnifyOrchestrator:
    def __init__(self, html_path: str):
        self.html_path = html_path
        ray.init(
            ignore_reinit_error=True,
            log_to_driver=False,
            num_cpus=max(1, len(SECTIONS)),
        )

    def scan_all(self) -> dict:
        scanner = HexScanner.remote(self.html_path)
        futures = [scanner.scan_section.remote(s) for s in SECTIONS]
        results = ray.get(futures)
        report = {}
        total = 0
        replaceable = 0
        for r in results:
            report[r.name] = asdict(r)
            total += r.total_hex
            replaceable += r.replaceable
        report["_summary"] = {"total_hex": total, "replaceable": replaceable}
        return report

    def replace(
        self, section: str, hex_from: str, var_to: str, dry_run: bool = True
    ) -> list | int:
        replacer = HexReplacer.remote(self.html_path)
        if dry_run:
            return ray.get(replacer.preview.remote(section, hex_from, var_to))
        return ray.get(replacer.apply.remote(section, hex_from, var_to))

    def replace_all(self, dry_run: bool = True) -> dict:
        results = {}
        for s in SECTIONS:
            for hex_from in s.get("replace", []):
                var_to = "var(--sport-accent)"
                r = self.replace(s["name"], hex_from, var_to, dry_run=dry_run)
                results[f"{s['name']}: {hex_from} → {var_to}"] = r
        return results

    def validate(self) -> dict:
        report = self.scan_all()
        # Recalculate with remaining hex
        return report


# ── CLI ─────────────────────────────────────────────────────
def cmd_scan(args):
    o = DesignUnifyOrchestrator(str(HTML))
    report = o.scan_all()
    print(json.dumps(report, indent=2, default=str))


def cmd_analyze(args):
    o = DesignUnifyOrchestrator(str(HTML))
    report = o.scan_all()
    summ = report.pop("_summary")
    print(f"\n{'═' * 60}")
    print(f"  DESIGN SYSTEM UNIFY — HEX SCAN REPORT")
    print(f"{'═' * 60}")
    print(f"  Total hex colors: {summ['total_hex']}")
    print(f"  Replaceable:      {summ['replaceable']} (mapped to --sport-accent)")
    print(f"{'═' * 60}\n")
    for name, sec in sorted(report.items()):
        findings = sec.get("findings", [])
        replaceable = [f for f in findings if f["is_var_candidate"]]
        if not findings:
            continue
        print(
            f"  [{name}] L{sec['line_start']}-{sec['line_end']}: "
            f"{sec['total_hex']} hex, {sec['replaceable']} replaceable"
        )
        for f in replaceable:
            print(
                f"    L{f['line']:>5}  {f['value']:>8}  → {f['suggested_var']}  | {f['context'][:60]}"
            )
        print()


def cmd_replace(args):
    o = DesignUnifyOrchestrator(str(HTML))
    if args.section:
        for s in SECTIONS:
            if s["name"] == args.section:
                for h in s.get("replace", []):
                    r = o.replace(
                        s["name"], h, "var(--sport-accent)", dry_run=not args.apply
                    )
                    if args.apply:
                        print(f"  {s['name']}: replaced {r} occurrences of {h}")
                    else:
                        print(
                            f"  {s['name']}: {h} → var(--sport-accent) — {len(r)} occurrences"
                        )
                        for change in r[:5]:
                            print(f"    L{change['line']}: {change['new'][:80]}")
                        if len(r) > 5:
                            print(f"    ... and {len(r) - 5} more")
                return
        print(f"Section '{args.section}' not found.")
    else:
        results = o.replace_all(dry_run=not args.apply)
        for k, v in results.items():
            if isinstance(v, int):
                print(f"  ✓ {k}: {v} replacements applied")
            elif isinstance(v, list):
                print(f"  {k}: {len(v)} occurrences (dry-run)")
                for change in v[:3]:
                    print(f"    L{change['line']}: {change['new'][:80]}")
                if len(v) > 3:
                    print(f"    ... and {len(v) - 3} more")
        if not args.apply:
            print(f"\n  ⚡ Dry-run complete. Run with --apply to apply changes.")


def cmd_validate(args):
    o = DesignUnifyOrchestrator(str(HTML))
    report = o.validate()
    print("\n  VALIDATION — remaining hex per section:")
    for name, sec in sorted(report.items()):
        if name.startswith("_"):
            continue
        findings = sec.get("findings", [])
        print(f"  [{name}] {sec['total_hex']} hex ({sec['replaceable']} replaceable)")
    summ = report.get("_summary", {})
    print(f"\n  Total: {summ.get('total_hex', 0)} hex colors")
    print(f"  Replaceable (not yet done): {summ.get('replaceable', 0)}")


def main():
    parser = argparse.ArgumentParser(description="Ray-based design system unification")
    sub = parser.add_subparsers(dest="command", required=True)

    p_scan = sub.add_parser("scan", help="Scan all hex colors per section")
    p_scan.set_defaults(func=cmd_scan)

    p_analyze = sub.add_parser("analyze", help="Analyze hex→var candidates")
    p_analyze.set_defaults(func=cmd_analyze)

    p_replace = sub.add_parser("replace", help="Replace hex with var(--sport-accent)")
    p_replace.add_argument("--section", "-s", help="Sport section (default: all)")
    p_replace.add_argument(
        "--apply", action="store_true", help="Apply changes (default: dry-run)"
    )
    p_replace.set_defaults(func=cmd_replace)

    p_valid = sub.add_parser("validate", help="Count remaining hex per section")
    p_valid.set_defaults(func=cmd_validate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
