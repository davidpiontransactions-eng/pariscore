# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import requests, json

HEAD = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://understat.com/league/EPL"}

r = requests.get("https://understat.com/getLeagueData/EPL/2026", headers=HEAD, timeout=30)
print("HTTP:", r.status_code, "| content-type:", r.headers.get("content-type"))
try:
    d = r.json()
except Exception as e:
    print("pas JSON:", str(e)[:100], "| body:", r.text[:200])
    raise SystemExit

print("clés:", list(d.keys()))
teams = d.get("teams", {})
print("équipes:", len(teams))
k0 = next(iter(teams))
t0 = teams[k0]
print("équipe[0]:", t0.get("title"), "| clés:", list(t0.keys())[:12])
hist = t0.get("history", [])
print("historique:", len(hist), "matchs")
if hist:
    print("clés match:", list(hist[0].keys()))
    for hh in hist[:3]:
        print(f"   {hh.get('date','')[:10]} h_a={hh.get('h_a')} xG={hh.get('xG')} xGA={hh.get('xGA')} buts={hh.get('scored')}-{hh.get('missed')} result={hh.get('result')}")
