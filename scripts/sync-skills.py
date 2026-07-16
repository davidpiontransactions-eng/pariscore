#!/usr/bin/env python3
"""
sync-skills.py — ⚠️ DÉPRÉCIÉ : utilisez sync-skills.js (portage Node.js).

Raison : Python n'est pas disponible sur tous les postes du projet, et le
runtime officiel est Bun/Node. La logique a été portée vers sync-skills.js
qui pointe en outre vers le nouveau layout .agents/tools/ (anciennement
.agents/skills/, renommé le 2026-07-17).

Ce shim preserve l'API CLI documentée dans AGENTS.md :
  python scripts/sync-skills.py            → node scripts/sync-skills.js
  python scripts/sync-skills.py --check    → node scripts/sync-skills.js --check
  python scripts/sync-skills.py --verify-junction → idem

Si Node n'est pas trouvé, affiche un message d'aide clair (exit 2).
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JS = os.path.join(HERE, "sync-skills.js")


def main() -> int:
    if not os.path.exists(JS):
        print(f"❌ {JS} introuvable (le portage Node est requis).")
        return 2

    node = shutil.which("node") or shutil.which("bun")
    if not node:
        print("❌ Node.js (ou Bun) introuvable dans le PATH.")
        print("   Installe Node, ou exécute directement : node scripts/sync-skills.js")
        return 2

    # Transmet les mêmes flags (--check, --verify-junction).
    result = subprocess.run([node, JS, *sys.argv[1:]])
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
