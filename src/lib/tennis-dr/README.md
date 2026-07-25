# tennis-dr — Dominance Ratio (médiane 5 derniers matchs)

DR Moyen (5M) : **médiane** du Dominance Ratio sur les 5 derniers matchs d'un
joueur, filtrée par surface du match (fallback tous-surfaces si `< 3` matchs).

Source unique : **TennisAbstract** `/jsfrags/{Slug}.js` (colonne DR du tableau
« Recent Results »). Le DR = `% de points de retour gagnés / % de points de
service perdus` (définition officielle TennisAbstract).

## ⚠️ Conformité

`/jsfrags/` est **interdit** par le `robots.txt` de TennisAbstract. Par
conséquent :

- **Runtime (app Next.js)** : ce module ne fait **jamais** de fetch réseau. Il
  lit uniquement `dr-cache.json` via `lookup.ts`. Zéro appel à TennisAbstract
  depuis le serveur de prod.
- **Population du cache** : seule la CLI `scripts/scrape-tennis-dr.ts` scrape,
  et uniquement si la variable d'environnement `LEGAL_OVERRIDE_CONFIRMED=1` est
  positionnée. Throttle conservateur (1 req / 1.5s).
- **Responsabilité** : le respect des ToS TennisAbstract incombe à l'opérateur
  du déploiement. Ce module implémente la technique demandée avec garde-fous,
  il ne constitue pas une autorisation.

## Architecture

```
scraper.ts   fetch /jsfrags/ + parse <table id="recent-results"> + agrège par surface
             (exécuté uniquement par le CLI, jamais en runtime)
   │
   ▼
dr-cache.json   { players: { <normalizeKey>: { name, all, Hard, Clay, Grass } } }
   │
   ▼
lookup.ts    lookupDrMoyen(name, surface) → number | null
             (runtime, readFileSync + reload 60s, fuzzy surname)
   │
   ▼
db.ts        getPlayerStats() — ajoute drMoyen5m au type PlayerStats
   │
   ▼
player-statline.tsx   « #85 · Elo 1845 · SPS 72 · DR 1.50 »
```

Mirroir exact du pattern `src/lib/tennis-elo/` (scraper → cache JSON → lookup).

## Slug TennisAbstract

- `Jannik Sinner` → `JannikSinner` → `https://www.tennisabstract.com/jsfrags/JannikSinner.js`
- `Iga Świątek` → `IgaSwiatek` (NFD strip accents)
- Règle : concaténer nom complet sans espaces, préserver la capitalisation,
  stripper les accents.

## Parsing du tableau

16 colonnes (indexes 0-based, confirmé en live sur `JannikSinner.js`) :

| idx | colonne | idx | colonne |
|-----|---------|-----|---------|
| 0 | Date | 8 | **DR** ← cible |
| 2 | **Surface** ← filtre | 9-15 | A%, DF%, 1stIn, 1st%, 2nd%, BPSvd, Time |

Cellule DR vide (match sans point-by-point) → ignorée dans la médiane.

## Surface mapping

| UI / DB | TennisAbstract | Bucket |
|---------|----------------|--------|
| Dur / Hard | Hard | `Hard` |
| Terre battue / Clay | Clay | `Clay` |
| Gazon / Grass | Grass | `Grass` |

## Stratégie de fallback (lookupDrMoyen)

1. Si `bucket[surface].n ≥ 3` → médiane surface (DR spécifique).
2. Sinon → médiane `all` si `≥ 1` match (sample surface trop faible).
3. Sinon → `null` (UI masque le token `DR`).

## CLI

```bash
# Liste explicite
LEGAL_OVERRIDE_CONFIRMED=1 bun run scrape:dr -- --players="Jannik Sinner,Carlos Alcaraz"

# Top 200 ATP + 200 WTA (défaut)
LEGAL_OVERRIDE_CONFIRMED=1 bun run scrape:dr -- --top=200

# Test parsing sans réseau ni écriture
bun run scrape:dr:dry -- --players="Jannik Sinner"
```

## Cron

`scripts/cron-tennis-dr.sh` — quotidien 04:00 (le DR évolue match-par-match,
pas minute-par-minute). Installer via `crontab -e` :

```
0 4 * * * /home/ubuntu/pariscore/scripts/cron-tennis-dr.sh
```

## Sanity check

Pour Sinner à Wimbledon (juin 2026), DR Grass = `[1.24, 1.81, 1.28, 1.62, 1.50]`
→ médiane **1.50**. Si cette valeur apparaît dans le cache, le pipeline est
correct bout-en-bout.
