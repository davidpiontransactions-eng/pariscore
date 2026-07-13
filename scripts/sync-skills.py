#!/usr/bin/env python3
"""
sync-skills.py — Synchronise l'allowlist OpenCode depuis la source unique .agents/skills/.

Architecture multi-plateforme :
  - .agents/skills/ = source unique (lue par ZCode ET OpenCode via junction)
  - .opencode/skills/ = junction Windows vers .agents/skills/ (créée une fois)
  - opencode.json clé "skill" = allowlist explicite des 145 skills

Ce script régénère l'allowlist opencode.json à partir du contenu réel de
.agents/skills/. À lancer après chaque ajout/suppression de skill pour garder
OpenCode synchronisé.

Usage :
  python scripts/sync-skills.py          # met à jour opencode.json
  python scripts/sync-skills.py --check  # vérifie seulement (exit 1 si désynchronisé)
  python scripts/sync-skills.py --verify-junction  # vérifie que la junction est active
"""
import argparse
import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
AGENTS_SKILLS = PROJECT_ROOT / ".agents" / "skills"
OPENCODE_SKILLS = PROJECT_ROOT / ".opencode" / "skills"
OPENCODE_JSON = PROJECT_ROOT / "opencode.json"


def list_skills(skills_dir: Path) -> list[str]:
    """Liste les noms de skills (dossiers contenant un SKILL.md)."""
    if not skills_dir.exists():
        return []
    return sorted([
        d.name for d in skills_dir.iterdir()
        if d.is_dir() and (d / "SKILL.md").exists()
    ])


def verify_junction() -> bool:
    """Vérifie que .opencode/skills pointe vers .agents/skills."""
    if not OPENCODE_SKILLS.exists():
        print("❌ .opencode/skills/ n'existe pas (junction manquante)")
        print("   Crée-la avec :")
        print('   cmd //c "mklink /J C:\\...\\pariscore\\.opencode\\skills C:\\...\\pariscore\\.agents\\skills"')
        return False

    # Vérifie que les contenus correspondent (compte + quelques skills)
    source_skills = list_skills(AGENTS_SKILLS)
    oc_skills = list_skills(OPENCODE_SKILLS)

    if source_skills != oc_skills:
        print(f"⚠️  Désynchronisation détectée :")
        print(f"   Source .agents/skills/ : {len(source_skills)} skills")
        print(f"   Junction .opencode/skills/ : {len(oc_skills)} skills")
        if len(source_skills) > len(oc_skills):
            missing = set(source_skills) - set(oc_skills)
            print(f"   Manquants côté junction : {missing}")
        return False

    print(f"✓ Junction active — {len(source_skills)} skills visibles des deux côtés")
    return True


def update_allowlist(dry_run: bool = False) -> int:
    """Met à jour la clé 'skill' dans opencode.json."""
    source_skills = list_skills(AGENTS_SKILLS)
    if not source_skills:
        print("❌ Aucun skill trouvé dans .agents/skills/")
        return 1

    if not OPENCODE_JSON.exists():
        print(f"❌ {OPENCODE_JSON} introuvable")
        return 1

    with open(OPENCODE_JSON, "r", encoding="utf-8") as f:
        config = json.load(f)

    old_skills = config.get("skill", [])
    old_count = len(old_skills)

    # Diff
    new_set = set(source_skills)
    old_set = set(old_skills)
    added = sorted(new_set - old_set)
    removed = sorted(old_set - new_set)

    if dry_run:
        print(f"Vérification (dry-run) :")
        print(f"  Source : {len(source_skills)} skills")
        print(f"  Allowlist actuelle : {old_count} skills")
        if added:
            print(f"  À ajouter ({len(added)}) : {added[:10]}{'...' if len(added) > 10 else ''}")
        if removed:
            print(f"  À retirer ({len(removed)}) : {removed[:10]}{'...' if len(removed) > 10 else ''}")
        if not added and not removed:
            print("  ✓ Allowlist déjà synchronisée")
            return 0
        return 1

    if not added and not removed:
        print(f"✓ Allowlist déjà synchronisée ({old_count} skills)")
        return 0

    config["skill"] = source_skills

    with open(OPENCODE_JSON, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"✓ opencode.json mis à jour : {old_count} → {len(source_skills)} skills")
    if added:
        print(f"  + {len(added)} ajouté(s)")
    if removed:
        print(f"  - {len(removed)} retiré(s)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="Vérifie seulement sans modifier (exit 1 si désynchronisé)")
    ap.add_argument("--verify-junction", action="store_true",
                    help="Vérifie que la junction .opencode/skills → .agents/skills est active")
    args = ap.parse_args()

    if args.verify_junction:
        return 0 if verify_junction() else 1

    return update_allowlist(dry_run=args.check)


if __name__ == "__main__":
    sys.exit(main())
