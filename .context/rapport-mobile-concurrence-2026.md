# Rapport d'analyse concurrentielle — Expérience mobile / parieur nomade

> PariScore — 2026-05-16
> Problème adressé : le site est desktop-first (tableau 1400px, nav scroll horizontale). Inutilisable pour un parieur en déplacement qui veut décider vite sur téléphone.

---

## 1. Diagnostic état actuel PariScore (mobile)

| Élément | État | Verdict mobile |
|---|---|---|
| Viewport meta | présent | OK |
| Nav | `.nav-links` barre **scroll horizontale**, 15 pages | ❌ items cachés, non découvrables |
| Liste matchs | `<table>` `min-width: 600px → 1400px` | ❌ scroll horizontal forcé |
| Media queries | 16, surtout hacks `min-width` de table | ❌ pas de vrai layout mobile |
| Modals | `width:92-96vw` déjà | ⚠️ acceptable, denses |
| Bottom nav / hamburger | aucun | ❌ |
| PWA / installable / offline | aucun | ❌ |
| Home | hero desktop, pas de CTA décision rapide | ❌ |

**Conclusion** : PariScore reproduit exactement l'anti-pattern n°1 du marché (tableau dense réutilisé tel quel + listes longues scrollables).

---

## 2. Analyse concurrents

### OddAlerts (référence)
- A **reconstruit une App Beta séparée** du web legacy jugé inadapté mobile (signal fort).
- Liste value bets en **cartes** (jamais tableau). Bouton **TRACK** = pari pré-rempli en 1 tap, widget se ferme seul.
- Compare proba modèle vs Pinnacle/Bet365/1xBet, surface EV+, "All Bookmakers" en 1 clic.
- A remplacé un "long scroll" de réglages par un **layout à onglets** (anti-pattern scroll reconnu).
- Live : alertes <1s via Telegram/Discord/email.

### BetMines (5M+ DL, 4,5★)
- Nav **hamburger** sectionnée. Listes en **cartes empilées catégorisées** (Top tips, puis par marché), catégories collapsibles.
- Générateur de combiné "Machine" : ligues + marché + range cotes + nb matchs → combiné.
- Filtres : ligues par continent, format cote, temporel. Anti-pattern : **pubs intrusives**, paywall VIP lourd.

### Datafoot
- "Simple, ergonomique", données triables/filtrables, **bankroll manager intégré**, filtres par séries/streaks.
- **Aucune mention mobile/PWA** → probablement desktop-first dense (même mal que PariScore).

### Forebet (bonus)
- **Code couleur sémantique** : jaune = à venir, vert = pronostic réussi, rouge = raté → track-record lisible d'un coup d'œil.
- Anti-pattern confirmé : "**scroll extrêmement problématique** dans Trends".

### FootyStats (bonus)
- App native. **Filtres marché** plébiscités (trouver tous les O2.5/BTTS vite sans scroller). Bascule forme dom↔ext en 1 geste.
- Updates centrés perf : moins de crashes, écrans plus rapides → **perf perçue = rétention**.

### Overlyzer (bonus — live momentum)
- Graphe momentum temps réel **2 couleurs** (bleu domicile / rouge extérieur, ligne 0), seuil chiffré actionnable (**≥30% = but imminent**).
- Liste live triable par pression/tirs/corners, **presets rapides** débutants, favoris.

---

## 3. Patterns gagnants transférables à PariScore

1. **Cartes empilées sur mobile, jamais le tableau.** Max 5 infos/carte : équipes+ligue, heure, cote+book, edge%, proba Poisson clé.
2. **Pari en 1 tap depuis la carte** : bouton "+ Suivre" pré-remplissant le modal Mes Paris (équipe/cote/marché auto).
3. **Code couleur sémantique** jaune/vert/rouge étendu au statut pari + badge edge.
4. **Filtres en chips/presets tapables** (Over 2.5, BTTS, Edge >5%), pas de sliders fins. Barre chips scroll horizontale.
5. **Tri unique exposé** en haut de liste : "Trier par : Edge ▾", défaut edge décroissant.
6. **Momentum live 2 couleurs + seuil chiffré** : réutiliser le Pressure Index 0-100 existant, code couleur aligné, seuil alerte explicite.
7. **Bottom tab bar** (Matchs / Live / Mes Paris / Alertes / Plus) au lieu de la nav scroll horizontale.
8. **Perf perçue** : skeleton loaders, lazy render cartes, zéro calcul client.

## 4. Anti-patterns à éviter

- Scroll infini de listes denses (défaut actuel PariScore).
- Réutiliser le tableau desktop en scroll horizontal.
- Pubs intrusives ; tout derrière paywall.
- Mettre une prédiction non fiable au cœur produit → garder transparence (badges SIM/LIVE, IC).
- Live en polling visible lent → SSE/push (PariScore a déjà SSE).

---

## 5. Sources

OddAlerts (/app/value-bets, /updates, /filters), BetMines (site + Play/App Store), Datafoot (/access/en), Forebet (Play Store + /mobile-app), FootyStats (App Store + /reviews), Overlyzer (App Store + /en/live + PR), comparatifs OddsNotifier 2026 & TikiTaka 2026.
