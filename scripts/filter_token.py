import re, sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
old = content
content = re.sub(r"ghp_[A-Za-z0-9]+", "[REVOKED]", content)
if content != old:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed: {path}")
