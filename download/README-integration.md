# SetPoint · Tennis Prematch — Intégration

Composant Next.js 16 / TypeScript / Tailwind 4 / shadcn/ui implémentant la
**fusion A+C** validée par panel synthétique de 1000 parieurs.

> Refonte de l'encart « 84 % » — carte duelle + chips statistiques + A/B testing

---

## 1. Stack

| Brique | Version | Rôle |
|---|---|---|
| Next.js | 16.1.3 (App Router) | Framework |
| TypeScript | 5 | Typage strict |
| Tailwind CSS | 4 | Styling |
| shadcn/ui (New York) | latest | Composants primitifs |
| next-themes | 0.4 | Dark/light mode |
| swr | 2.4 | Cache client + polling |
| posthog-js | 1.396 | A/B testing + analytics |
| lucide-react | 0.525 | Icônes |

---

## 2. Structure des fichiers

```
src/
├── app/
│   ├── api/tennis/prematch/route.ts   # API route (cache 60s + Odds API + fallback mock)
│   ├── layout.tsx                     # ThemeProvider + PHProvider
│   ├── page.tsx                       # Page Tennis Prematch
│   └── globals.css
├── components/
│   ├── analytics-provider.tsx         # PostHog init + hook useAnalytics
│   ├── theme-toggle.tsx
│   └── tennis/
│       ├── match-card.tsx             # Carte duelle A + chips C + CTA Parier
│       ├── probability-ring.tsx       # Anneau SVG animé (RAF)
│       └── stat-chip.tsx
├── hooks/
│   └── use-prematch-matches.ts        # SWR hook (refresh 60s)
└── lib/
    └── tennis-data.ts                 # Types + mock enrichi (3 matchs)
```

---

## 3. Variables d'environnement

Copiez `.env.example` vers `.env` et renseignez :

```bash
# The Odds API — free tier 500 req/mois
# https://the-odds-api.com/#get-access
ODDS_API_KEY=your_key_here

# PostHog — free tier 1M events/mois
# https://posthog.com/signup
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com  # ou votre instance self-hosted
```

**Sans ces variables**, le code tourne en mode dégradé :
- `ODDS_API_KEY` absente → API route retourne les données mock enrichies (badge « Démo » amber)
- `NEXT_PUBLIC_POSTHOG_KEY` absente → tous les appels `track()` sont no-op (variant `chips_visible` par défaut)

---

## 4. Portage sur votre site existant

### 4.1 Si votre site est en Next.js 14+/16

1. Copiez ces fichiers dans votre codebase :
   - `src/components/tennis/` (dossier complet)
   - `src/components/analytics-provider.tsx`
   - `src/components/theme-toggle.tsx` (optionnel)
   - `src/hooks/use-prematch-matches.ts`
   - `src/lib/tennis-data.ts` (à adapter à votre backend)
   - `src/app/api/tennis/prematch/route.ts`
2. Ajoutez `PHProvider` à votre `layout.tsx` racine (au-dessus de votre contenu)
3. Installez les dépendances : `bun add swr posthog-js next-themes`
4. Remplacez l'ancien composant « encart 84 % » par `<MatchCard match={...} />`
5. Adaptez `usePrematchMatches` pour pointer vers votre endpoint réel

### 4.2 Si votre site est en React/Vue/Angular

Le composant `MatchCard` est isolé et portable. Vous devez :
1. Réécrire `ProbabilityRing` et `StatChip` dans votre framework
2. Réécrire `usePrematchMatches` avec votre lib de fetching (TanStack Query, RTK Query, etc.)
3. Remplacer les classes Tailwind par votre système de styling
4. Pour PostHog : installer le SDK correspondant à votre framework

### 4.3 Si vous n'avez pas de backend de prédiction

Vous pouvez brancher directement **The Odds API** (cf. `/api/tennis/prematch/route.ts`) :
- Créez un compte sur https://the-odds-api.com
- Récupérez votre clé API (500 requêtes gratuites/mois)
- Mettez `ODDS_API_KEY` dans votre `.env`
- Le code dérive automatiquement les probabilités implied des cotes (avec vig removal)

**Attention** : The Odds API ne fournit que les **cotes**, pas les **Elo ratings**,
**H2H**, **IC** ou **confidence**. Pour ces champs, il faut soit :
- Les calculer côté backend (modèle Elo + forme + surface → IC bootstrap)
- Les récupérer depuis une source tierce (Matchstat, Stevegtennis, etc.)
- Les laisser mockés temporairement (le code gère le fallback)

---

## 5. A/B Testing

### 5.1 Expérience active

**Nom** : `tennis-prematch-chips-layout`
**Variants** :
- `chips_visible` (control) — les 6 chips sont visibles par défaut (fusion A+C telle que livrée)
- `chips_collapsed` (treatment) — chips cachés derrière un toggle « Voir les stats détaillées »

**Hypothèse** : les chips augmentent la crédibilité (pros) mais peuvent surcharger les casuels. Le treatment isole l'effet des chips sur la conversion.

**Métrique primaire** : `bet_cta_click` (clic sur le bouton « Parier »)
**Métriques secondaires** : `detail_open`, `match_card_view`, `filter_click`

### 5.2 Configuration PostHog

1. Créez l'experiment dans PostHog UI : Experiments → New → Feature flag
2. Feature flag key : `tennis-prematch-chips-layout`
3. Variants : `chips_visible` (50%) / `chips_collapsed` (50%)
4. Cible : tous les utilisateurs (ou un segment spécifique)
5. Lancez et surveillez le tableau de bord

### 5.3 Événements trackés

| Événement | Déclencheur | Propriétés |
|---|---|---|
| `page_view` | Mount de la page | `route`, `tab` |
| `experiment_assigned` | Résolution du feature flag | `experiment`, `variant` |
| `match_card_view` | Mount d'une carte | `match_id`, `tournament`, `player_a`, `player_b`, `prob_a`, `prob_b` |
| `filter_click` | Clic sur un filtre | `filter` |
| `detail_open` | Ouverture de l'accordéon détail | `match_id`, `player_a`, `player_b` |
| `bet_cta_click` | Clic sur « Parier » | `match_id`, `prob_a`, `bookmaker`, `decimal_a`, `decimal_b` |
| `manual_refresh` | Clic sur « Actualiser » | — |

### 5.4 Sans PostHog

Tous les appels `track()` sont no-op si `NEXT_PUBLIC_POSTHOG_KEY` est absent. La variante par défaut est `chips_visible` (la fusion A+C telle que livrée). Vous pouvez brancher n'importe quelle autre solution d'analytics (Segment, Amplitude, Vercel Analytics) en éditant `analytics-provider.tsx`.

---

## 6. API route — contrat

### `GET /api/tennis/prematch`

**Response 200** :
```json
{
  "matches": [
    {
      "id": "m1",
      "tournament": "Wimbledon",
      "round": "8èmes de finale",
      "scheduledAt": "2026-07-08T14:00:00Z",
      "playerA": {
        "id": "sabalenka",
        "name": "Aryna Sabalenka",
        "shortName": "SABALENKA",
        "rank": 1,
        "elo": 2052,
        "photoUrl": "https://...",
        "color": "#1B4332",
        "form": ["W","W","W","W","W","L"],
        "country": "BLR"
      },
      "playerB": { /* idem */ },
      "probA": 84,
      "probB": 16,
      "stats": {
        "form": "5V-1D",
        "eloGap": 293,
        "surface": "Gazon",
        "h2h": "5-2",
        "ic": [78, 89],
        "confidence": 0.81
      },
      "model": "Elo+Forme+Surface",
      "modelUpdatedAt": "2026-07-05T10:45:00Z",
      "odds": {
        "bookmaker": "Bet365",
        "decimalA": 1.18,
        "decimalB": 4.75
      }
    }
  ],
  "source": "cache" | "odds-api" | "mock",
  "updatedAt": "2026-07-05T11:00:00Z"
}
```

**Cache** : 60 s en mémoire (évite de surcharger The Odds API).
**Fallback** : si `ODDS_API_KEY` absente ou requête en échec, retourne le mock enrichi avec `source: "mock"`.

---

## 7. Tests et vérifications

- ✅ `bun run lint` — 0 erreur, 0 warning
- ✅ Server-side render : GET / 200
- ✅ Hydration : aucune erreur runtime
- ✅ Desktop 1280×900 — toutes les cartes s'affichent
- ✅ Mobile 390×844 — empilement vertical propre, pas de débordement
- ✅ API route `/api/tennis/prematch` retourne 3 matchs (source mock sans clé)
- ✅ Toggle thème dark/light opérationnel
- ✅ Filtres (Tous / Favoris clairs / Matchs serrés) opérationnels
- ✅ Accordéon « Détail » opérationnel
- ✅ Bouton « Parier » clickable (tracking `bet_cta_click`)

Captures d'écran dans `/home/z/my-project/download/` :
- `v2-desktop.png`, `v2-fullpage.png`, `v2-mobile.png`, `v2-detail-opened.png`

---

## 8. Limites connues

1. **Photos joueurs** : actuellement servies via OSS ZAI (photos trouvées sur le web). Pour la production, remplacez par votre CDN photos sous licence ATP/WTA.
2. **Données enrichies** (Elo, H2H, IC, forme) : mockées. À brancher sur votre backend de prédiction.
3. **A/B variant** : si PostHog n'est pas configuré, seul `chips_visible` est servi (pas de test réel possible).
4. **Bookmaker CTA** : le bouton « Parier » ne redirige pas encore — branchez votre URL d'affiliation dans `handleBetCta` (match-card.tsx).

---

## 9. Roadmap suggérée

- [ ] Brancher backend Elo/H2H/IC réel (supprimer le mock)
- [ ] Ajouter module de consentement cookies (RGPD) avant PostHog init
- [ ] Live updates WebSocket pour matchs en cours
- [ ] Page de détail match complète (toutes les stats, historique H2H)
- [ ] Comparateur de cotes multi-bookmakers
- [ ] Mode « parieur pro » (densité max, tout déplié)
- [ ] PWA offline (cache des derniers matchs consultés)
