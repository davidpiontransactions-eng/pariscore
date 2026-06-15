# Rapport — Local WOM Provider (Issue bwnk)

Écrit le 2026-06-12. Aucun fichier modifié — lecture seule.

---

## 1. État actuel du WOM dans ParisScore

### Architecture (3 tiers)

```
wom.local.js (gitignored, local-only)
  → betwatchService.js (supprimé du repo dans eeec5bf)
    → lit data/betwatch_wom.json (cache vide, paywall)

betfairService.js (dans le repo, 339 lignes)
  → API Betfair officielle (Delayed App Key, gratuite)
  → Nécessite BETFAIR_USER/PASS/APP_KEY dans .env

_tennisLiveCache / _BF_AK (scraping betfair.com inline)
  → Clé hardcodée nzIFcwyWhrlwYMrh, géo-bloqué France
  → Fonction fetchOdds l.7446
```

### Ce qui est actif

| Sport | Frontend | Backend | Source |
|-------|----------|---------|--------|
| **Football** | ✅ Barre WOM dans comparateur + badge | ✅ Endpoint `/api/v1/comparateur/` | betwatch cache (vide) → betfairService |
| **Tennis** | ❌ Panneaux retirés (eeec5bf) — code _tvbWOM() existe encore | ✅ 3 endpoints : wom, wom-top, wom-analyze | womLocal → betfairService → liveCache |
| **Discord BSD** | — | ✅ Auto-publish cron detecte mouvements WOM | womLocal (football seulement) |

### Fichiers concernés

| Fichier | Statut | Rôle |
|---------|--------|------|
| `betfairService.js` | ✅ Dans le repo (339 lignes) | API officielle Betfair, prête |
| `server.js:36-38` | ✅ Hook `womLocal` | try/catch sur `./wom.local` |
| `server.js:3541-3640` | ✅ WOM auto-publish | Cron mouvements → Discord BSD |
| `server.js:35867-35996` | ✅ Tennis WOM endpoints | wom, wom-top, wom-analyze |
| `pariscore.js:25103-25140` | ✅ Foot WOM badge/panel | Rendu dans le comparateur |
| `pariscore.js:3253-3276` | ✅ `_tvbWOM()` | Barre argent Betfair |
| `pariscore.html:5178-5187` | ✅ CSS `.dt-wom-*` | Styles barre WOM foot |
| `wom.local.js` | ⚠️ Local-only, 314 octets | Bridge vers betwatchService |
| `betwatchService.js` | ❌ Supprimé (eeec5bf) | Ancien lecteur cache betwatch |
| `tools/scrape-betwatch-wom.js` | ❌ Supprimé (eeec5bf) | Scraper betwatch.fr |
| `data/betwatch_wom.json` | ⚠️ Vide (count:0) | Cache betwatch jamais populisé |
| `data/etude_betfair_scraping.md` | ✅ Dans le repo | Analyse des 3 chemins |

---

## 2. Pourquoi le tennis WOM a été retiré (commit eeec5bf)

Le commit `eeec5bf` a retiré **uniquement le frontend** tennis WOM :
- Panneaux HTML/CSS (`.tn-wom-section`, `.tn-wom-card`, etc.)
- Badges inline, filtres, tris
- Le bouton d'analyse IA Gemini

**Cause racine** : betwatch.fr tennis = paywall "Extra Sports". Le cache betwatch_wom.json est vide (`count:0`). Le tennis n'a jamais eu de WOM fonctionnel en production — l'UI affichait "Aucune donnée Betfair disponible".

Les 3 endpoints backend `/tennis/wom*` existent encore — le provider betfairService fonctionnerait avec les bonnes clés .env.

---

## 3. Ce qu'il faudrait pour un WOM provider local

### 3.1 Données à collecter

Pour chaque match (football + tennis), le provider doit exposer :

```
{
  wom:    { home: Number (%), draw: Number (%), away: Number (%) },
  money:  { home: Number (€), draw: Number (€), away: Number (€) },
  odds:   { home: Number, draw: Number, away: Number },
  movement: { home: "SHORTENING"|"DRIFTING"|null, ... },
  totalMatched: Number (€),
  totalEvent: Number (€),
  market: String ("Match Odds", etc.)
}
```

**Interface requise** (ce que server.js attend de `womLocal`) :
| Méthode | Return | Usage |
|---------|--------|-------|
| `enabled()` | boolean | Gate général |
| `fetchMatchWOM(match)` | Object (ci-dessus) \| null | Comparateur + panoramique WOM |
| `fetchMatchRows(match)` | Row[] | Enrichissement bookmakers |
| `mergeRows(existing, extra)` | Row[] | Merge dédup |
| `topByMatched(sport, opts)` | Match[] | `/tennis/wom-top` |
| `status()` | { enabled, count, ts, stale } | Debug |

### 3.2 Scheduling

Le provider doit être sollicité à 2 fréquences :

| Type | Fréquence | Usage |
|------|-----------|-------|
| **Comparateur utilisateur** | On-demand (requête HTTP → 3s max) | Foot + tennis |
| **Auto-publish cron** | Toutes les ~10 min | Détection mouvements → Discord BSD |

Contraintes :
- WOM auto-publish : `WOM_AP_INTERVAL_MIN=10`, cap quotidien 8 posts, cooldown 24h par match
- Délai maximum pour le comparateur : ~3s (UX)

### 3.3 Couverture (ligues/marchés)

| Sport | Priorité | Marchés |
|-------|----------|---------|
| Football (BSD) | P0 | Match Odds (1X2) — toutes ligues BSD 65+ |
| Tennis (BSD) | P1 | Match Odds (p1/p2) — ATP + WTA |
| Tennis (non-BSD) | P2 | Match Odds — ITF/Challenger (via liveCache) |

### 3.4 Sources disponibles (documentées dans l'étude)

| Source | Coût | Bloqueur | Statut |
|--------|------|----------|--------|
| **A — betfair.com inline scrape** (`_BF_AK`) | Gratuit | Géo-bloqué France, clé hardcodée fragile | ✅ Codé dans server.js |
| **B — API Betfair officielle** (`betfairService.js`) | Gratuit (Delayed Key) | BETFAIR_USER/PASS/APP_KEY dans .env | ✅ Codé, 339 lignes |
| **C — betwatch.fr** | Payant (Extra Sports) | TOS + paywall tennis | ❌ Supprimé du repo |

---

## 4. Recommandation : GO (conditionnel)

### État actuel
`wom.local.js` est un pont mort : il require `betwatchService.js` qui n'existe plus. Le provider local ne fournit **aucune donnée** en l'état.

### Ce qui est prêt
- `betfairService.js` est complet (339 lignes), dans le repo, fonctionnel avec les bonnes clés .env
- Toute l'infrastructure d'appel (cascade womLocal → betfairService → liveCache) est câblée
- L'auto-publish cron, le comparateur foot, et les endpoints tennis sont prêts à consommer

### Recommandation

**GO** — mais en remplaçant le provider betwatch mort par `betfairService.js` :

1. **Remplacer `wom.local.js`** :
   - Actuellement : `module.exports = require('./betwatchService')` → fichier supprimé, CRASH au require
   - Nouveau : bridge vers `betfairService.js` avec config locale
   - Le serveur ne doit PAS crasher si `wom.local.js` est absent ou invalide (déjà géré par le try/catch server.js:38, mais le require betwatchService dans wom.local.js actuel est un chemin mort)

2. **Mettre les clés Betfair dans .env** (hors repo, secrètes) :
   - `BETFAIR_USER`, `BETFAIR_PASS`, `BETFAIR_APP_KEY` (Delayed App Key = gratuit)
   - Nécessite un VPN (hors France) pour le login initial

3. **Optionnel** : restaurer le frontend tennis WOM (badges + panneaux) si la source Betfair fonctionne

### Risques
- Le login Betfair est géo-bloqué France (nécessite VPS ou proxy)
- L'API Betfair Delayed Key n'expose pas `totalMatched` — seulement le top-3 des meilleures offres
- Sans `totalMatched`, la barre de volume et le classement `/wom-top` sont limités

### Verdict : **GO** (avec condition BETFAIR_* .env)
