#!/usr/bin/env python3
"""Add `location /api/ai/ { proxy_pass http://localhost:3005; }` to the nginx
pariscore site, inserted before the catch-all `location /api/` block.
Idempotent + creates a timestamped backup. Run with sudo."""
import datetime
import shutil
import sys

PATH = "/etc/nginx/sites-enabled/pariscore"

BLOCK = (
    "    location /api/ai/ {\n"
    "        proxy_pass http://localhost:3005;\n"
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

    if "location /api/ai/" in content:
        print("SKIP: location /api/ai/ already present")
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
    print("INSERTED: location /api/ai/ before catch-all")
    return 0


if __name__ == "__main__":
    sys.exit(main())
