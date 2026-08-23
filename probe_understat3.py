# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import requests, re

HEAD = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
html = requests.get("https://understat.com/league/EPL", headers=HEAD, timeout=30).text
# tous les <script> src et variables globales
print("=== scripts externes ===")
for m in re.finditer(r'<script[^>]*src="([^"]+)"', html):
    print("  ", m.group(1)[:100])
print("=== vars JS inline ===")
for m in re.finditer(r'var\s+(\w+)\s*=', html):
    print("  var", m.group(1))
print("=== fetch/xhr hints ===")
for m in re.finditer(r'(fetch|XMLHttpRequest|\.json|/api/|ajax)[^\n]{0,80}', html):
    print("  ", m.group(0)[:100])
