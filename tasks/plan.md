# Plan Pariscore.fr — Amélioration & Innovation

**Périmètre** : pariscore.fr (Next.js 16, React 19, shadcn/ui, Bun, Prisma, SQLite)
**Timeline** : 4 semaines (S1–S4), livraison incrémentale par phase
**Gantt** : `tasks/pariscore-plan.svg`

---

## Architecture decisions

- Next.js App Router existant — features en Server Components quand possible, Client Components pour l'interactivité
- Base de données existante (SQLite → Prisma) — éviter les migrations lourdes, préférer des colonnes/compteurs simples
- shadcn/ui pour toute nouvelle UI (cohérence design system)
- Pas de nouveau provider externe (PostHog déjà présent pour analytics)

---

## Phase 1 : Branding, SEO & Accessibilité (S1)

### Tâche 1.1 — P0 : Corriger branding & metatags

**Description** : Renommer "SetPoint" → "ParisScore" dans tous les metatags, OG, Twitter cards, titre, manifest, JSON-LD.
Remplacer `setpoint.example` par `pariscore.fr` dans canonical URL.

**Agent** : `general` (modifications fichier unique)
**Sub-agent** : `explore` pour trouver toutes les occurrences
**Skills** : `seo-optimization`, `aos-code-review-and-quality`

**Fichiers** :
- `src/app/layout.tsx` (metatags dynamiques)
- `public/manifest.json`
- Tous les composants `page.tsx` avec `generateMetadata`

**AC** :
- [ ] canonical URL = `https://pariscore.fr/`
- [ ] OG title = "ParisScore · Prédictions Sportives IA"
- [ ] JSON-LD WebApplication pointe vers pariscore.fr
- [ ] `node --check` passe

**Vérification** : `curl -s https://pariscore.fr/ | grep -o "canonical\|og:title\|twitter:title"`

---

### Tâche 1.2 — P0 : Track record bannière

**Description** : Afficher en haut de page une bannière "Dernières prédictions : X/5 correctes" lues depuis la DB
(matchs récents avec résultat connu + prédiction du modèle).

**Agent** : `general`
**Sub-agent** : `explore` (recherche schéma DB matchs)
**Skills** : `react-component-design`, `react-api-consumer`, `frontend-a11y`

**Fichiers** :
- `src/components/TrackRecordBanner.tsx`
- API route `/api/v1/predictions/recent`

**AC** :
- [ ] Banner visible sur la page d'accueil
- [ ] Données lues depuis la table `matches` / `predictions`
- [ ] Fallback si pas assez de données ("Bientôt disponible")

---

### Tâche 1.3 — P1 : Robots.txt & Sitemap

**Description** : Créer `robots.txt` et `sitemap.xml` Next.js pour le SEO.

**Agent** : `general`
**Skills** : `seo-optimization`

**Fichiers** :
- `src/app/robots.ts`
- `src/app/sitemap.ts`

**AC** :
- [ ] `GET /robots.txt` retourne les bonnes règles
- [ ] `GET /sitemap.xml` liste toutes les pages
- [ ] Aucune page sensible (admin, API) dans le sitemap

---

### Tâche 1.4 — Audit accessibilité

**Description** : Audit axe-core + keyboard navigation sur toutes les pages.

**Agent** : `web-performance-auditor` + `code-reviewer`
**Skills** : `accessibility`, `web-accessibility-wizard`, `core-web-vitals`

**AC** :
- [ ] axe-core ne remonte aucune violation critique
- [ ] Navigation clavier possible sur tous les onglets sport
- [ ] Rapport produit dans `tasks/a11y-report.md`

---

## Phase 2 : Social Proof & Contenu (S1–S2)

### Tâche 2.1 — P1 : Compteur prédictions générées

**Description** : Petit compteur animé dans le header "X prédictions générées cette semaine".

**Agent** : `general`
**Skills** : `react-component-design`, `react-modern-react`

**Fichiers** :
- `src/components/PredictionsCounter.tsx`

**AC** :
- [ ] Compteur visible dans le header
- [ ] Valeur lue depuis une API ou un champ agrégé en DB
- [ ] Animation CSS fluide

---

### Tâche 2.2 — P1 : Page transparence "Notre Modèle"

**Description** : Page explicative du modèle Elo+Forme+Surface avec :
- Décomposition chiffrée (poids Elo 60%, Forme 25%, Surface 15%)
- Graphiques de performance passée
- Limites du modèle (incertitude, blessures)

**Agent** : `general`
**Sub-agent** : `explore` (recherche logique métier existante)
**Skills** : `tufte-data-viz`, `frontend-design`, `impeccable`

**Fichiers** :
- `src/app/model/page.tsx`
- `src/components/ModelBreakdown.tsx`

**AC** :
- [ ] Page accessible depuis le footer "Comment ça marche ?"
- [ ] Données réelles du modèle (pas du lorem)
- [ ] Aucun jargon technique inaccessible

---

### Tâche 2.3 — P1 : Contenu hors-match (classements ATP/WTA)

**Description** : Quand aucun match n'est programmé, afficher les classements ATP/WTA en direct,
la forme des 10 derniers matchs des joueurs, les stats de surface.

**Agent** : `general`
**Skills** : `tennis-data`, `react-component-design`

**Fichiers** :
- `src/components/RankingsWidget.tsx`
- `src/components/PlayerForm.tsx`

**AC** :
- [ ] Classements visibles dans l'état "0 match aujourd'hui"
- [ ] Données fraîches via API tennis
- [ ] Design cohérent avec le thème dark

---

## Phase 3 : Engagement & Innovation (S2–S3)

### Tâche 3.1 — P2 : Filtre calendrier

**Description** : Permettre de voir "Demain", "Cette semaine", "Ce week-end" en plus d'"Aujourd'hui".

**Agent** : `general`
**Skills** : `react-modern-react`, `react-component-design`

**Fichiers** :
- `src/components/DateFilterTabs.tsx`

**AC** :
- [ ] Tabs fonctionnent avec l'API existante des matchs
- [ ] Les dates sont adaptées au fuseau horaire FR

---

### Tâche 3.2 — Match IQ temps réel

**Description** : Quand un match est en cours, afficher l'évolution de la probabilité Elo
(mise à jour périodique via SSE ou polling).

**Agent** : `general`
**Sub-agent** : `code-reviewer`
**Skills** : `react-api-consumer`, `tufte-data-viz`, `performance`

**Fichiers** :
- `src/components/MatchIQ.tsx`
- API route SSE `/api/v1/match-iq/:id`

**AC** :
- [ ] Probabilité bouge en live pendant le match
- [ ] Pas de re-rendu excessif (debounce 5s)
- [ ] Accessible aux lecteurs d'écran (live region)

---

### Tâche 3.3 — P2 : Smart Feed

**Description** : Fil d'actualité dynamique : stats du jour, value bets trouvés, prédictions à venir,
performances récentes du modèle. Remplace les skeletons vides.

**Agent** : `general`
**Skills** : `react-component-design`, `impeccable`

**Fichiers** :
- `src/components/SmartFeed.tsx`

**AC** :
- [ ] Contenu pertinent quand 0 match
- [ ] Items cliquables → page détail
- [ ] Rafraîchissement périodique

---

### Tâche 3.4 — Comparateur de cotes bookmakers

**Description** : Widget comparant les cotes Winamax/Betclic/Unibet pour chaque match.
Liens d'affiliation redirect (revenu passif).

**Agent** : `general`
**Sub-agent** : `security-auditor`
**Skills** : `api-connector-builder`, `aos-security-and-hardening`

**Fichiers** :
- `src/components/OddsComparator.tsx`

**AC** :
- [ ] Minimum 3 bookmakers FR affichés
- [ ] Pas de clé API exposée côté client
- [ ] Liens d'affiliation en `rel="noopener noreferrer"`

---

## Phase 4 : Monétisation (S4)

### Tâche 4.1 — Entonnoir Free → Pro → Elite

**Description** : Mise en place du modèle freemium :
- Gratuit : 5 prédictions/jour + historique
- Pro (9.99€/mois) : illimité + alertes value bet
- Elite (29.99€/mois) : API access + optimizer combinés

**Agent** : `general`
**Sub-agent** : `security-auditor`, `code-reviewer`
**Skills** : `backend-patterns`, `aos-security-and-hardening`, `prisma-patterns`

**Fichiers** :
- `prisma/schema.prisma` (User.plan, Prediction.limit)
- `src/app/api/v1/auth/plan/route.ts`
- `src/components/PricingCards.tsx`

**AC** :
- [ ] Stripe/PayPal checkout fonctionnel en sandbox
- [ ] Rate limiting côté API (gratuit limité)
- [ ] Downgrade/upgrade seamless

---

### Tâche 4.2 — API Access + alerts Telegram

**Description** : Exposer les prédictions via API key + notifications Telegram/SMS
pour les abonnés Elite.

**Agent** : `general`
**Sub-agent** : `security-auditor`
**Skills** : `api-design`, `deployment-patterns`

**Fichiers** :
- `src/app/api/v1/predictions/public/route.ts`
- `src/lib/notifications/telegram.ts`

**AC** :
- [ ] API key générée par utilisateur
- [ ] Rate limiting 60 req/min par key
- [ ] Webhook Telegram fonctionnel

---

## QA transverse

| Tâche | Agent | Skills | S |
|-------|-------|--------|---|
| Audit a11y (axe + keyboard) | `web-performance-auditor` | `accessibility`, `core-web-vitals` | S1 |
| Core Web Vitals audit | `web-performance-auditor` | `performance`, `lighthouse-bridge` | S2 |
| Déploiement continu VPS | `general` | `deployment-patterns`, `docker-patterns` | S1→S4 |

## Cadence de livraison

```
S1 (Lun 27 Juil) : Phase 1 complète (branding + SEO + track record + a11y audit)
                     ↓ checkpoint : re-audit SEO + a11y
S2 (Lun 3 Août)  : Phase 2 (social proof + classements + contenu)
                   + début Innovation (Match IQ, comparateur)
                     ↓ checkpoint : re-audit Core Web Vitals
S3 (Lun 10 Août) : Fin Innovation + Smart Feed
                     ↓ checkpoint : UAT fonctionnel
S4 (Lun 17 Août) : Monétisation + API + déploiement final
                     ↓ checkpoint : production ready
```

## Agents disponibles par tâche

```
┌────────────────────────────────────────────────────────────────────┐
│ Tâche              │ Agent principal     │ Sub-agent    │ Skills   │
├────────────────────┼─────────────────────┼──────────────┼──────────┤
│ 1.1 Branding       │ general             │ explore      │ seo      │
│ 1.2 Track record   │ general             │ explore      │ react    │
│ 1.3 Robots/Sitemap │ general             │ —            │ seo      │
│ 1.4 Audit a11y     │ web-perf-auditor    │ code-reviewer│ a11y     │
│ 2.1 Compteur       │ general             │ —            │ react    │
│ 2.2 Page modèle    │ general             │ explore      │ viz      │
│ 2.3 Classements    │ general             │ —            │ tennis   │
│ 3.1 Calendrier     │ general             │ —            │ react    │
│ 3.2 Match IQ       │ general             │ code-reviewer│ react    │
│ 3.3 Smart Feed     │ general             │ —            │ react    │
│ 3.4 Comparateur    │ general             │ security     │ api      │
│ 4.1 Pricing        │ general             │ security+cr  │ prisma   │
│ 4.2 API + Telegram │ general             │ security     │ api      │
└────────────────────────────────────────────────────────────────────┘
```
