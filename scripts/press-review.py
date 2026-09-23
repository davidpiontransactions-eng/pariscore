#!/usr/bin/env python3
"""Revue de presse académique & scientifique Pariscore — tous les14 jours.

Cron VPS (installé par scripts/update_vps.sh) :
    0 6 * * * cd /opt/pariscorebis && python3 scripts/press-review.py >> logs/press-review.log 2>&1
Cadence réelle : garde d'intervalle >= 14 jours dans data/.press-review-state.json
(première exécution ancre la série).

Sortie : docs/press-review/YYYY-MM-DD.md
Sections : 1) modèles prédictifs multi-sports  2) LLM open-source
           3) paris sportifs & research connexe  4) autres pistes Pariscore

Sources (APIs gratuites, sans clé) : arXiv, OpenAlex, GitHub releases.
Rédaction : Gemini (GEMINI_API_KEY lu dans .env) — si LLM indisponible,
fallback = auto-digest brut des titres (toujours un fichier produit).
Best-effort : git add/commit/push du fichier (non bloquant).
"""
import io
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "press-review")
STATE = os.path.join(ROOT, "data", ".press-review-state.json")
INTERVAL_DAYS = 14
UA = {"User-Agent": "pariscore-press-review/1.0 (research digest)"}

ARXIV_NS = {"atom": "http://www.w3.org/2005/Atom"}
ARXIV_QUERIES = [
    ('all:"sports betting"', 12),
    ('(all:"match outcome" OR all:"match result") AND (all:predict* OR all:forecast*)', 12),
    ('(all:"win probability" OR all:"elo rating" OR all:"poisson model") AND cat:stat.*', 10),
    ('(all:"betting market" OR all:"wagering") AND (cat:q-fin.* OR cat:econ.*)', 10),
    ('cat:cs.CL AND (abs:"open-source" OR abs:"open source") AND abs:"large language model"', 12),
    ('(abs:"language model" OR abs:"LLM") AND (abs:"evaluation" OR abs:"alignment")', 10),
]
OPENALEX_QUERIES = [
    "sports betting prediction model",
    "football soccer forecasting machine learning",
    "open source large language model",
]
GITHUB_LLM_REPOS = [
    "ggml-org/llama.cpp",
    "ollama/ollama",
    "vllm-project/vllm",
    "QwenLM/Qwen3",
    "google/gemma",
    "huggingface/transformers",
]


def http_json(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def http_text(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def since_days_ago(days=INTERVAL_DAYS):
    return (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()


def within_window(iso_date):
    if not iso_date:
        return True  # sans date : conservé (l'LLM filtre au besoin)
    return iso_date[:10] >= since_days_ago()


def fetch_arxiv():
    items = []
    for q, n in ARXIV_QUERIES:
        url = (
            "https://export.arxiv.org/api/query?search_query="
            + urllib.parse.quote(q)
            + f"&sortBy=submittedDate&sortOrder=descending&max_results={n}"
        )
        try:
            root = ET.fromstring(http_text(url, timeout=30))
        except Exception as e:
            print(f"[press-review] arxiv fail {q!r}: {e}")
            continue
        for entry in root.findall("atom:entry", ARXIV_NS):
            title = re.sub(r"\s+", " ", (entry.findtext("atom:title", "", ARXIV_NS) or "")).strip()
            link = entry.findtext("atom:id", "", ARXIV_NS) or ""
            published = (entry.findtext("atom:published", "", ARXIV_NS) or "")[:10]
            summary = re.sub(r"\s+", " ", (entry.findtext("atom:summary", "", ARXIV_NS) or ""))[:400]
            if title and within_window(published):
                items.append({"title": title, "url": link, "source": "arXiv", "date": published, "summary": summary})
    return items


def fetch_openalex():
    items = []
    start = since_days_ago()
    for q in OPENALEX_QUERIES:
        url = (
            "https://api.openalex.org/works?search="
            + urllib.parse.quote(q)
            + f"&filter=from_publication_date:{start}&sort=publication_date:desc"
            + "&per-page=8&mailto=research@pariscore.fr"
        )
        try:
            data = http_json(url)
        except Exception as e:
            print(f"[press-review] openalex fail {q!r}: {e}")
            continue
        for w in data.get("results", []):
            loc = ((w.get("primary_location") or {}).get("source") or {}).get("display_name")
            items.append({
                "title": re.sub(r"\s+", " ", w.get("title") or "").strip(),
                "url": w.get("doi") or w.get("id") or "",
                "source": loc or "OpenAlex",
                "date": (w.get("publication_date") or "")[:10],
                "summary": (w.get("abstract") or w.get("title") or "")[:300],
            })
    return [i for i in items if i["title"]]


def fetch_github_releases():
    items = []
    for repo in GITHUB_LLM_REPOS:
        try:
            rels = http_json(f"https://api.github.com/repos/{repo}/releases?per_page=3")
        except Exception as e:
            print(f"[press-review] github fail {repo}: {e}")
            continue
        for r in rels:
            if r.get("draft") or r.get("prerelease"):
                continue
            pub = (r.get("published_at") or "")[:10]
            if not within_window(pub):
                continue
            body = re.sub(r"[#*`>\[\]]", " ", (r.get("body") or ""))
            body = re.sub(r"\s+", " ", body).strip()[:350]
            items.append({
                "title": f"{repo} — {r.get('name') or r.get('tag_name')}",
                "url": r.get("html_url") or "",
                "source": "GitHub release",
                "date": pub,
                "summary": body,
            })
    return items


def read_gemini_key():
    for env in (os.environ.get("GEMINI_API_KEY"),):
        if env:
            return env
    for p in (os.path.join(ROOT, ".env"), os.path.join(os.path.expanduser("~"), "pariscore", ".env")):
        try:
            for line in io.open(p, encoding="utf-8", errors="replace"):
                if line.strip().startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            pass
    return None


# Candidats en ordre (API Google retire les vieux modèles — voir diag404 :
# "use models/gemini-3.6-flash"). GEMINI_MODEL env = override.
GEMINI_MODELS = ("gemini-3.6-flash", "gemini-3.1-pro-preview", "gemini-2.5-flash")


def gemini_write(digest_lines):
    key = read_gemini_key()
    if not key:
        return None
    env_model = os.environ.get("GEMINI_MODEL")
    models = [env_model] if env_model else list(GEMINI_MODELS)
    models += [m for m in GEMINI_MODELS if m not in models]
    prompt = (
        "Tu rédiges la REVUE DE PRESSE académique & scientifique bimestrielle du projet "
        "PariScore (site FR de prédictions & paris sportifs multi-sports : foot, tennis, "
        "snooker, hockey KHL/NHL/Ligue Magnus, handball, rugby, baseball, CS2, MMA...). "
        "Écris EN FRANÇAIS un document Markdown structuré, PRÉCIS, sans invention — "
        "uniquement à partir des éléments fournis :\n\n"
        "1) ## Modèles prédictifs sportifs — articles/workshops récents (élo, poisson/skellam, "
        "xG, deep learning, calibration, market efficiency)\n"
        "2) ## LLM open-source — releases & avancements (llama.cpp, ollama, vllm, Qwen, gemma...)\n"
        "3) ## Paris sportifs & research connexe — académique (odds, line movement, responsible "
        "gambling, forecasting)\n"
        "4) ## Autres pistes pour Pariscore — tout item utile (data eng, viz, stats)\n\n"
        "Format PAR ITEM : - **[Titre cliqué](url)** — source, date (JJ/MM) : 2-4 phrases de résumé, "
        "puis1 phrase '→ PariScore :' d'application concrète quand pertinent. "
        "Commence par une ligne `_Période : du AAAA-MM-JJ au AAAA-MM-DD — N items sourcés._` "
        "et termine par '## Méthode' (2 lignes : sources APIs + génération). "
        "Si un item n'a pas de date fiable, ne mets pas de date. Ne cite QUE les items fournis.\n\n"
        "ITEMS JSON :\n" + json.dumps(digest_lines, ensure_ascii=False)
    )
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.loads(r.read().decode("utf-8", "replace"))
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts).strip()
            if text:
                print(f"[press-review] gemini ok via {model}")
                return text
        except Exception as e:
            print(f"[press-review] gemini {model} fail: {e}")
    return None


def fallback_digest(items, start, end):
    lines = [f"_Période : du {start} au {end} — {len(items)} items sourcés (auto-digest, LLM indisponible)._\n"]
    for sec, pat in [
        ("## Modèles prédictifs sportifs", ("betting", "predict", "forecast", "odds", "sport", "match", "poisson", "elo", "goal")),
        ("## LLM open-source", ("llm", "language model", "qwen", "gemma", "llama", "vllm", "ollama", "transformers", "claude", "gpt")),
        ("## Paris sportifs & research connexe", ("wager", "gambling", "market", "bookmaker")),
    ]:
        lines.append(f"\n{sec}")
        hit = [i for i in items if any(p in (i["title"] + " " + i["summary"]).lower() for p in pat)]
        for i in hit:
            lines.append(f"- **[{i['title']}]({i['url']})** — {i['source']}, {i['date']}")
        if not hit:
            lines.append("- _(aucun item sur la période)_")
    lines.append("\n## Méthode\nSources : arXiv, OpenAlex, GitHub releases. Auto-digest (gemini non disponible au moment de la génération).")
    return "\n".join(lines) + "\n"


def git_publish(path, date):
    rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
    msg = f"docs(press-review): revue {date} [skip ci]"
    cmds = [
        ["git", "add", rel],
        ["git", "commit", "-m", msg],
        ["git", "push", "origin", "HEAD:main"],
    ]
    for c in cmds:
        try:
            r = subprocess.run(c, cwd=ROOT, capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                print(f"[press-review] git {' '.join(c[1:2])} warn: {(r.stderr or '').strip()[:200]}")
                return False
        except Exception as e:
            print(f"[press-review] git fail: {e}")
            return False
    return True


def main():
    # Garde cadence : au moins INTERVAL_DAYS depuis la dernière revue
    last = None
    try:
        last = json.load(io.open(STATE, encoding="utf-8")).get("last_run")
    except Exception:
        pass
    today = datetime.now(timezone.utc).date()
    if last:
        try:
            last_d = datetime.fromisoformat(last[:10]).date()
            if (today - last_d).days < INTERVAL_DAYS:
                print(f"[press-review] skip (last={last_d}, next>={last_d + timedelta(days=INTERVAL_DAYS)})")
                return
        except ValueError:
            pass

    start = since_days_ago()
    end = today.isoformat()
    items = []
    items += fetch_arxiv()
    items += fetch_openalex()
    items += fetch_github_releases()
    # dédup par titre/url
    seen, uniq = set(), []
    for i in items:
        k = (i.get("url") or i["title"]).strip()
        if k and k not in seen:
            seen.add(k)
            uniq.append(i)
    items = uniq
    print(f"[press-review] {len(items)} items ({start} → {end})")

    md = gemini_write(items) if items else None
    if not md:
        md = fallback_digest(items, start, end)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{end}.md")
    io.open(out, "w", encoding="utf-8").write(md.rstrip() + "\n")
    print(f"[press-review] written {out}")

    io.open(STATE, "w", encoding="utf-8").write(json.dumps({"last_run": end}))
    git_publish(out, end)


if __name__ == "__main__":
    main()
