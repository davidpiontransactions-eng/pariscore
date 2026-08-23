# -*- coding: utf-8 -*-
"""Génère public/data/betmines/catalog.json depuis le catalogue sitemap."""
import sys, io, json, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

rows = []
with open("data/betmines-leagues-all.txt", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or "\t" not in line:
            continue
        lid, slug = line.split("\t", 1)
        # slug format : pronostics-{pays}-{ligue}
        parts = slug.replace("pronostics-", "", 1).split("-")
        country = parts[0] if parts else ""
        rows.append({"id": int(lid), "slug": slug, "country": country})

out = {"meta": {"source": "betmines.com sitemap", "count": len(rows)}, "leagues": rows}
os.makedirs("public/data/betmines", exist_ok=True)
with open("public/data/betmines/catalog.json", "w", encoding="utf-8") as f:
    json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
print(f"catalog.json écrit: {len(rows)} ligues")

# vérifie nos slugs internes principaux
checks = ["france-ligue-1", "angleterre-premier-league", "espagne-la-liga", "allemagne-bundesliga", "italie-serie-a"]
for c in checks:
    hit = [r for r in rows if f"-{c}" in r["slug"]][:1]
    print(c, "->", hit[0] if hit else "?")
