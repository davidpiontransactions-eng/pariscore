# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import requests, re, json

HEAD = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
html = requests.get("https://understat.com/league/EPL", headers=HEAD, timeout=30).text
print("len:", len(html))

# Les données sont dans var teamsData = JSON.parse('\x7B...')
m = re.search(r"var\s+teamsData\s*=\s*JSON\.parse\('([^']+)'\)", html)
print("teamsData trouvé:", bool(m))
if m:
    raw = m.group(1).encode().decode("unicode_escape")
    data = json.loads(raw)
    print("équipes:", len(data))
    first_key = next(iter(data))
    team = data[first_key]
    print("clés équipe:", list(team.keys()))
    hist = team.get("history", [])
    print(f"{team['title']}: {len(hist)} matchs d'historique")
    if hist:
        print("clés match:", list(hist[0].keys()))
        # exemples récents avec contexte h/a
        for hh in hist[:4]:
            print(f"   {hh.get('date','')[:10]} h_a={hh.get('h_a')} xG={hh.get('xG')} xGA={hh.get('xGA')} scored={hh.get('scored')} missed={hh.get('missed')}")
