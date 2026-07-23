#!/usr/bin/env python3
"""
scripts/besoccer-backfill-ids.py — Backfill du mapping {team_name → resfu_id} via Camoufox.

Phase B1. beSOCCER (fr.besoccer.com) est protégé par un WAF Fastly (406 sur fetch natif +
Client Challenge JS). Camoufox (scrapling StealthyFetcher) résout le challenge → HTTP 200.
Le DOM rendu expose les logos sur le CDN public cdn.resfu.com :

    https://cdn.resfu.com/img_data/escudos/medium/{resfu_id}.jpg?size=120x&lossy=1   (shield)
    https://cdn.resfu.com/img_data/equipos/{resfu_id}.png?size=120x&lossy=1          (logo HD)

L'ID resfu n'est PAS dans l'URL beSOCCER (slug-only). On l'extrait du DOM :
- Sur la page d'une équipe, son propre ID est le plus fréquent (header + shields adversaires).
- On collecte en bonus les IDs des adversaires visibles (matchs récents) → mapping gratuit.

Une fois le mapping connu, les URLs logos se construisent en fetch Node simple (CDN public,
pas de Camoufox runtime). Camoufox n'est utile qu'une fois pour la découverte.

Usage :
  python scripts/besoccer-backfill-ids.py --team "Real Madrid"
  python scripts/besoccer-backfill-ids.py --from-file teams.txt --output data/resfu-ids.json
  python scripts/besoccer-backfill-ids.py --from-db        # lit team_logos, complète les manquants

Output JSON : { "<name_norm>": {"name":"Real Madrid","resfu_id":2107,"url":"..."}, ... }

Dépendances : scrapling[camoufox] + camoufox fetch (déjà installé sur ce poste).
"""

import argparse
import json
import os
import re
import sys
import time
from collections import Counter

# ─── Slug beSOCCER depuis un nom d'équipe ────────────────────────────────────
# beSOCCER utilise des slugs parfois tronqués : "Real Madrid" → "real-madrid",
# "FC Barcelona" → "barcelona" (préfixe FC stripé). On teste plusieurs variantes.
def slug_variants(name: str) -> list:
    n = name.strip().lower()
    # Strip préfixes/suffixes club communs
    stripped = re.sub(r'\b(fc|cf|ac|ssc|sc|afc|asd|cd|club|united|utd|city|real|de)\b', '', n).strip()
    stripped = re.sub(r'[^a-z0-9]+', '-', stripped).strip('-')
    full = re.sub(r'[^a-z0-9]+', '-', n).strip('-')
    variants = []
    for v in (full, stripped):
        if v and v not in variants:
            variants.append(v)
    # Premier mot seul (ex: "barcelona")
    first = re.sub(r'\s.*', '', n)
    first = re.sub(r'[^a-z0-9]+', '-', first).strip('-')
    if first and first not in variants:
        variants.append(first)
    return variants or ['real-madrid']


def normalize_name(name: str) -> str:
    """Normalisation IDENTIQUE à normalizeTeamName (lib/logo-cascade.js:87)."""
    n = name.lower()
    # strip accents
    n = re.sub(r'[\u0300-\u036f]', '', n.normalize('NFD') if hasattr(n, 'normalize') else n)
    n = re.sub(r'\b(fc|cf|ac|ssc|sc|if|ik|kf|ff|afc|asd|cd|club|united|utd|city|sk|ifk|bk|fk|il|tf|vfl|sv|gs|rb|tsg|vfb)\b', '', n)
    n = re.sub(r'[^a-z0-9]', '', n)
    return n.strip()


# ─── Extraction du mapping ID → nom depuis le DOM rendu ──────────────────────
# Patterns observés (spike B0) :
#   <img ... src="https://cdn.resfu.com/img_data/escudos/medium/2107.jpg..." alt="Real Madrid">
#   <img ... src="https://cdn.resfu.com/img_data/escudos/medium/429.jpg..." alt="FC Barcelona">
# On match src puis alt voisin.
RE_ESCUDO = re.compile(
    r'src=["\']https?://cdn\.resfu\.com/img_data/escudos/medium/(\d+)\.jpg[^"\']*["\']'
    r'[^>]*\balt=["\']([^"\']+)["\']',
    re.I,
)
# Variante alt AVANT src
RE_ESCUDO_REV = re.compile(
    r'\balt=["\']([^"\']+)["\'][^>]*\bsrc=["\']https?://cdn\.resfu\.com/img_data/escudos/medium/(\d+)\.jpg',
    re.I,
)


def extract_id_name_pairs(html: str) -> list:
    """Retourne [(resfu_id:int, name:str), ...] de toutes les équipes visibles dans le DOM."""
    pairs = []
    for m in RE_ESCUDO.finditer(html):
        pairs.append((int(m.group(1)), m.group(2).strip()))
    for m in RE_ESCUDO_REV.finditer(html):
        pairs.append((int(m.group(2)), m.group(1).strip()))
    return pairs


def fetch_team_page(team_name: str, timeout: int = 180) -> dict:
    """Fetch une page équipe via Camoufox, retourne {status, html, elapsed, error}."""
    from scrapling.fetchers import StealthyFetcher
    urls = ['https://www.besoccer.com/team/' + s for s in slug_variants(team_name)]
    for url in urls:
        t0 = time.time()
        try:
            page = StealthyFetcher.fetch(
                url, headless=True, humanize=True, os_randomize=True,
                solve_cloudflare=True, network_idle=True, wait_selector='body', timeout=timeout,
            )
            elapsed = round(time.time() - t0, 1)
            status = getattr(page, 'status', None)
            html = getattr(page, 'html_content', '') or ''
            if status == 200 and len(html) > 500:  # page réelle (pas un shell vide)
                return {'status': status, 'html': html, 'elapsed': elapsed, 'url': url, 'error': None}
        except Exception as e:
            elapsed = round(time.time() - t0, 1)
            # On continue sur la variante suivante
            last_err = f'{type(e).__name__}: {e}'
            continue
    return {'status': None, 'html': '', 'elapsed': elapsed if 'elapsed' in dir() else 0,
            'url': urls[0], 'error': last_err or 'toutes les variantes ont échoué'}


def resolve_team_resfu_id(team_name: str, timeout: int = 180) -> dict:
    """Résout l'ID resfu d'une équipe. Retourne {name, resfu_id, url, also_seen, error}."""
    r = fetch_team_page(team_name, timeout)
    if r['status'] != 200 or not r['html']:
        return {'name': team_name, 'resfu_id': None, 'url': None, 'error': r['error']}

    pairs = extract_id_name_pairs(r['html'])
    if not pairs:
        return {'name': team_name, 'resfu_id': None, 'url': None,
                'error': 'aucun shield trouvé dans le DOM rendu'}

    # L'ID le plus fréquent = l'équipe de la page (header + répétitions)
    id_counts = Counter(pid for pid, _ in pairs)
    best_id, best_count = id_counts.most_common(1)[0]
    url = f'https://cdn.resfu.com/img_data/escudos/medium/{best_id}.jpg?size=120x&lossy=1'

    # Bonus : collecte des autres équipes vues (adversaires) pour mapping gratuit
    also_seen = {}
    target_norm = normalize_name(team_name)
    for pid, pname in pairs:
        if pid == best_id:
            continue
        pnorm = normalize_name(pname)
        if pnorm and pnorm != target_norm and pnorm not in also_seen:
            also_seen[pnorm] = {
                'name': pname, 'resfu_id': pid,
                'url': f'https://cdn.resfu.com/img_data/escudos/medium/{pid}.jpg?size=120x&lossy=1',
            }
    return {'name': team_name, 'resfu_id': best_id, 'url': url,
            'source_url': r['url'], 'count': best_count,
            'also_seen': also_seen, 'error': None}


# ─── CLI ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description='Backfill mapping {team → resfu_id} via Camoufox')
    ap.add_argument('--team', help='Une équipe (test rapide)')
    ap.add_argument('--from-file', help='Fichier : une équipe par ligne')
    ap.add_argument('--from-db', action='store_true', help='Lit team_logos (SQLite) pour la liste')
    ap.add_argument('--db', default=os.path.join(os.path.dirname(__file__), '..', 'pariscore.db'))
    ap.add_argument('--output', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'resfu-ids.json'))
    ap.add_argument('--timeout', type=int, default=180, help='Timeout fetch Camoufox (défaut 180s)')
    ap.add_argument('--delay', type=float, default=5.0, help='Délai entre équipes (politesse, défaut 5s)')
    ap.add_argument('--limit', type=int, default=50, help='Max équipes à traiter')
    args = ap.parse_args()

    # Collecte de la liste d'équipes
    teams = []
    if args.team:
        teams = [args.team]
    elif args.from_file:
        with open(args.from_file, encoding='utf-8') as f:
            teams = [l.strip() for l in f if l.strip() and not l.startswith('#')]
    elif args.from_db:
        try:
            import sqlite3
            db = sqlite3.connect(args.db)
            rows = db.execute(
                "SELECT DISTINCT name FROM team_logos WHERE name != '' ORDER BY name LIMIT ?"
            ).fetchall([args.limit])
            db.close()
            teams = [r[0] for r in rows]
        except Exception as e:
            print(f'[FATAL] lecture DB échouée: {e}', file=sys.stderr)
            sys.exit(1)
    else:
        ap.print_help()
        print('\nExemple: python scripts/besoccer-backfill-ids.py --team "Real Madrid"')
        sys.exit(0)

    teams = teams[:args.limit]
    print(f'\n  Backfill IDs resfu — {len(teams)} équipe(s) à traiter')
    print(f'  Camoufox stealth (résout WAF Fastly), ~3min/équipe, délai {args.delay}s\n')

    # Charge mapping existant (reprise)
    mapping = {}
    if os.path.exists(args.output):
        try:
            with open(args.output, encoding='utf-8') as f:
                mapping = json.load(f)
            print(f'  Mapping existant chargé: {len(mapping)} entrées\n')
        except Exception:
            pass

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    stats = {'resolved': 0, 'failed': 0, 'also_seen': 0}

    for i, team in enumerate(teams, 1):
        norm = normalize_name(team)
        if norm in mapping and mapping[norm].get('resfu_id'):
            print(f'  [{i}/{len(teams)}] {team} → déjà résolu ({mapping[norm]["resfu_id"]}), skip')
            continue
        print(f'  [{i}/{len(teams)}] {team} ...', end=' ', flush=True)
        r = resolve_team_resfu_id(team, args.timeout)
        if r.get('resfu_id'):
            mapping[norm] = {'name': team, 'resfu_id': r['resfu_id'], 'url': r['url']}
            stats['resolved'] += 1
            print(f'✅ id={r["resfu_id"]} ({r["count"]}x) en {r.get("count",0)}occ | {r["url"][:60]}...')
            # Bonus : aussi_seen
            for anorm, ainfo in r.get('also_seen', {}).items():
                if anorm not in mapping:
                    mapping[anorm] = ainfo
                    stats['also_seen'] += 1
        else:
            stats['failed'] += 1
            print(f'❌ {r.get("error", "inconnu")}')

        # Sauvegarde incrémentale (reprise safe)
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(mapping, f, indent=2, ensure_ascii=False)

        if i < len(teams):
            time.sleep(args.delay)

    print(f'\n  === TERMINÉ ===')
    print(f'  Résolus: {stats["resolved"]} | Échecs: {stats["failed"]} | Bonus (adversaires): {stats["also_seen"]}')
    print(f'  Mapping total: {len(mapping)} entrées → {args.output}\n')


if __name__ == '__main__':
    main()
