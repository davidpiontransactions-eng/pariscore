#!/usr/bin/env python3
"""Add `location /api/basketball/ { proxy_pass http://localhost:3000; }` to the
nginx pariscore site, inserted before the catch-all `location /api/` block
(that catch-all routes unknown prefixes to the legacy FastAPI :8000, whose
404 {"detail":"Not Found"} masquerades as a missing Next route).

Root cause (2026-09-30): the 5 Next routes /api/basketball/{backtest,standings,
history,calendar,odds} were unreachable via the public domain while healthy on
localhost:3000 (pariscore-next current port). Client fetchs were migrated to
the nginx-proxied /api/v1/basketball/* aliases as a stopgap (entry 108
RAPPORT-TACHES); this script restores the canonical prefix. Both can coexist.

Idempotent + timestamped backup. Usage on the VPS:
    sudo python3 scripts/add-basketball-nginx-proxy.py && sudo nginx -t && sudo systemctl reload nginx
"""
import datetime
import shutil
import sys

PATH = "/etc/nginx/sites-enabled/pariscore"

BLOCK = (
    "    location /api/basketball/ {\n"
    "        proxy_pass http://localhost:3000;\n"
    "        proxy_http_version 1.1;\n"
    "        proxy_set_header Upgrade $http_upgrade;\n"
    "        proxy_set_header Connection upgrade;\n"
    "        proxy_set_header Host $host;\n"
    "        proxy_set_header X-Real-IP $remote_addr;\n"
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
    "        proxy_set_header X-Forwarded-Proto $scheme;\n"
    "        proxy_cache_bypass $http_upgrade;\n"
    "        proxy_read_timeout 60s;\n"
    "    }\n"
    "\n"
)

CATCH_ALL = "    location /api/ {"


def main() -> int:
    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if "location /api/basketball/" in content:
        print("SKIP: location /api/basketball/ already present")
        return 0

    idx = content.find(CATCH_ALL)
    if idx < 0:
        print("ERROR: catch-all 'location /api/ {' not found — aborting, no change")
        return 1

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{PATH}.bak-{stamp}"
    shutil.copy2(PATH, backup)
    print(f"BACKUP: {backup}")

    new_content = content[:idx] + BLOCK + content[idx:]
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("INSERTED: location /api/basketball/ -> localhost:3000 (before catch-all)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
