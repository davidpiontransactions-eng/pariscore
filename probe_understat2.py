# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import requests, re

HEAD = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
r = requests.get("https://understat.com/league/EPL", headers=HEAD, timeout=30)
print("HTTP:", r.status_code, "len:", len(r.text))
t = r.text
# indices anti-bot
for pat in ["Just a moment", "cf-challenge", "cloudflare", "challenge-platform", "Enable JavaScript"]:
    if pat.lower() in t.lower():
        print("DETECTE:", pat)
title = re.search(r"<title>([^<]+)</title>", t)
print("title:", title.group(1) if title else "?")
