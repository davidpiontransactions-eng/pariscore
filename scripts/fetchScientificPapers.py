#!/usr/bin/env python3
"""
PariScore — Scientific Watch
Fetches latest arXiv papers on sports betting ML/prediction models.
Run manually or via cron every Saturday 00:00 UTC (see scripts/setup_cron.sh).
Usage: python3 scripts/fetchScientificPapers.py
"""

import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import os
import sys
import re
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ARXIV_API = "http://export.arxiv.org/api/query"
MAX_RESULTS_PER_QUERY = 8
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "scientific_watch.md")

QUERIES = [
    'all:"sports betting" AND all:"machine learning"',
    'all:"football prediction" AND all:"machine learning"',
    'all:"poisson distribution" AND all:"soccer"',
    'all:"tennis prediction" AND all:"probabilistic"',
    'all:"match outcome prediction" AND all:"deep learning"',
    'all:"expected goals" AND all:"machine learning"',
    'all:"bookmaker odds" AND all:"prediction"',
    'all:"sports analytics" AND all:"betting"',
]

ARXIV_NS = "http://www.w3.org/2005/Atom"


# ---------------------------------------------------------------------------
# arXiv fetch
# ---------------------------------------------------------------------------

def fetch_arxiv(query: str, max_results: int = MAX_RESULTS_PER_QUERY) -> list[dict]:
    params = urllib.parse.urlencode({
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    })
    url = f"{ARXIV_API}?{params}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            raw = resp.read()
    except Exception as e:
        print(f"  [WARN] fetch failed for query '{query[:60]}...': {e}", file=sys.stderr)
        return []

    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        print(f"  [WARN] XML parse error: {e}", file=sys.stderr)
        return []

    papers = []
    for entry in root.findall(f"{{{ARXIV_NS}}}entry"):
        try:
            arxiv_id = entry.find(f"{{{ARXIV_NS}}}id").text.strip()
            title = entry.find(f"{{{ARXIV_NS}}}title").text.strip().replace("\n", " ")
            title = re.sub(r"\s+", " ", title)
            published = entry.find(f"{{{ARXIV_NS}}}published").text.strip()[:10]
            summary = entry.find(f"{{{ARXIV_NS}}}summary").text.strip().replace("\n", " ")
            summary = re.sub(r"\s+", " ", summary)

            authors = [
                a.find(f"{{{ARXIV_NS}}}name").text.strip()
                for a in entry.findall(f"{{{ARXIV_NS}}}author")
            ]

            # PDF link
            pdf_link = arxiv_id.replace("abs", "pdf")
            if not pdf_link.endswith(".pdf"):
                pdf_link += ".pdf"

            papers.append({
                "id": arxiv_id,
                "title": title,
                "authors": authors,
                "published": published,
                "summary": summary,
                "pdf": pdf_link,
            })
        except AttributeError:
            continue

    return papers


# ---------------------------------------------------------------------------
# Dedup + collect
# ---------------------------------------------------------------------------

def collect_all_papers() -> list[dict]:
    seen_ids: set[str] = set()
    all_papers: list[dict] = []

    for q in QUERIES:
        print(f"  Querying: {q[:70]}...")
        results = fetch_arxiv(q)
        for p in results:
            if p["id"] not in seen_ids:
                seen_ids.add(p["id"])
                all_papers.append(p)
        print(f"    -> {len(results)} results, {len(all_papers)} unique total")

    # Sort newest first
    all_papers.sort(key=lambda x: x["published"], reverse=True)
    return all_papers


# ---------------------------------------------------------------------------
# Markdown formatting
# ---------------------------------------------------------------------------

def format_paper(p: dict) -> str:
    authors_str = ", ".join(p["authors"][:5])
    if len(p["authors"]) > 5:
        authors_str += f" + {len(p['authors']) - 5} others"

    summary = p["summary"]
    if len(summary) > 600:
        summary = summary[:597] + "..."

    return (
        f"### {p['title']}\n"
        f"- **Auteurs :** {authors_str} | **Date :** {p['published']}\n"
        f"- **Lien PDF :** {p['pdf']}\n"
        f"- **Résumé :** {summary}\n"
        f"---\n"
    )


def build_section(papers: list[dict], run_date: str) -> str:
    lines = [
        f"## 📅 Veille du {run_date} ({len(papers)} articles)\n",
        "",
    ]
    for p in papers:
        lines.append(format_paper(p))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# File I/O — prepend new section
# ---------------------------------------------------------------------------

HEADER = """\
# 🔬 PariScore — Veille Scientifique (arXiv)

> Automatisé via `scripts/fetchScientificPapers.py` | Cron : dimanche 00h00 UTC
> Sources : arXiv (stat, cs.LG, cs.AI) | Mots-clés : sports betting, ML, Poisson, expected goals

---

"""


def write_output(new_section: str) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    existing = ""
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        # Strip header for prepend logic; re-add fresh
        if content.startswith("# 🔬"):
            # Remove first header block (up to first "## 📅")
            idx = content.find("\n## 📅")
            if idx != -1:
                existing = content[idx + 1:]
            else:
                existing = content
        else:
            existing = content

    full_content = HEADER + new_section + "\n" + existing

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(full_content)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"PariScore Scientific Watch — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Querying arXiv ({len(QUERIES)} queries)...")

    papers = collect_all_papers()

    if not papers:
        print("No papers found. Check network or arXiv API status.")
        sys.exit(1)

    run_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    section = build_section(papers, run_date)
    write_output(section)

    print(f"\nDone. {len(papers)} unique papers -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
