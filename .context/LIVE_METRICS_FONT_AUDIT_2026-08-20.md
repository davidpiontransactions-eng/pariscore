# Audit comparatif — Visibilité des metrics live (card Football)

**Date** : 2026-08-20 · **Objet** : lisibilité des lignes de stats live (Poss./Tirs/Cadrés/Corners, xG, breakdown) — police, taille, couleur, contraste.

## 1. Problème constaté (PariScore)

Dans `football-live-card.tsx` (`StatRow`) et `live-stats-breakdown.tsx` (`StatRow`) :

| Élément | Actuel | Contraste (WCAG) | Verdict |
|---|---|---|---|
| Valeurs card | `text-xs` (12px) semibold, héritent foreground | 12.46:1 | taille trop petite |
| Label card | `text-xs` `text-muted-foreground` | **3.93:1** | **ÉCHEC AA (4.5)** |
| Valeurs breakdown | `text-[11px]` semibold `text-emerald-400`/`sky-400` | 6.3–7.1:1 | 11px = illisible |
| Label breakdown | `text-[11px]` `text-muted-foreground` | 3.93:1 | **ÉCHEC AA** |
| Ligne xG inline | `text-xs` + `text-sky-400` | 6.34:1 | 12px colorée |

Symptôme utilisateur : « je n'arrive pas à lire le metric par ligne » → cause = tout en 11–12px, label gris sous-norme, pas de hiérarchie visuelle.

## 2. Benchmark concurrence (mesures live réelles, 2026-08-20)

Captures DOM réelles sur matchs en cours (Playwright) :

### FotMob (match live Rayo–Alavés) — light mode
- **Police** : Walsheim (propriétaire) + `ui-monospace` pour les chiffres de stats ; Open Sans en fallback large
- **Taille** : 14px dominant (4772 occurrences), 16px données principales, 10px meta
- **Couleur** : valeurs **noir `#000`** sur blanc `#fff` (**21:1**), labels gris `#383838` (**11.7:1**)
- **Poids** : 400 labels, **700 valeurs** (1230 occurrences)

### Flashscore (Flamengo 2-1 Cruzeiro) — light mode
- **Police** : LivesportFinderLatin + **FS_Numbers (police chiffres dédiée aux stats)**
- **Taille** : **13px** dominant (951), 16px valeurs fortes, 12px secondaire
- **Couleur** : texte navy `#00141E` (**18.8:1**), labels gris `#555E61` (**6.7:1**), rouge `#FF0046` réservé au live
- **Poids** : 400 labels, **700 valeurs**

### Sofascore (live) — light mode
- Police propriétaire Sofascore Sans, **condensée pour les chiffres**
- Texte `#1D1F24` sur `#F7F7F8` = **15.4:1**

### WhoScored — bloqué Cloudflare (données de la 1re analyse : light, texte sombre 15:1)

### Synthèse des 4 leaders
1. **Tous en light mode** → contraste texte ≥ 15:1 (impossible en dark pur : le max blanc sur notre card = 12.46:1, blanc sur navy = ~13-14:1)
2. **Police chiffres dédiée** : FS_Numbers (Flashscore), ui-monospace (FotMob), condensed (Sofascore) → **chiffres tabulaires alignés**, jamais de chiffres proportionnels
3. **Hiérarchie stricte** : valeurs **bold 13-16px** en contraste maximal ; labels **regular 12-13px** en gris secondaire (≥ 6:1)
4. **Couleur = signal, pas décoration** : les teintes (rouge live, vert) ne sont utilisées que sur un seul élément, jamais sur les chiffres de stats

## 3. Recommandation implémentée (transposée en dark navy)

| Rôle | Avant | Après | Ratio |
|---|---|---|---|
| Valeurs | 11-12px semibold, couleur accent | **14px (text-sm), font-display Archivo, font-bold, blanc pur `text-foreground`, tabular-nums** | **12.46:1 (AAA)** |
| Labels | 11-12px `muted-foreground` | **12-13px, `text-slate-400`, uppercase + tracking-wider** | **5.35:1 (AA)** |
| Barres | h-1 (4px) | **h-1.5 (6px)** — meilleur guidage de lecture ligne par ligne | — |
| Police chiffres | Geist proportionnel | **Archivo + tabular-nums** (équivalent FS_Numbers/ui-monospace) | — |

**Justification** : Archivo bold 14px = le « display data » de la charte PariScore (déjà utilisé pour les scores tennis) ; blanc pur = contraste maximal atteignable sur card navy (12.46:1, AAA) ; slate-400 = AA conforme, 36 % plus clair que muted-foreground (5.35 vs 3.93:1) ; les couleurs emerald/sky restent sur les barres (information de tendance), plus jamais sur les chiffres.

## 4. Fichiers modifiés
- `src/components/football/football-live-card.tsx` — StatRow + ligne xG inline
- `src/components/football/live-stats-breakdown.tsx` — StatRow (11px → 14px, blanc, slate-400)
- `src/components/football/football-match-card.tsx` — StandingStatRow (cohérence standings)

## 5. Vérification
- `bun run typecheck` + `bun run lint`
- Capture pixel prod (audit visuel) : vérification zoom des 4 lignes de stats