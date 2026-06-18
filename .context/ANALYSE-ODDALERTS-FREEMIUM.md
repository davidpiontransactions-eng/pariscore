# Analyse OddAlerts — Modèle Freemium & Content Gating

**Date** : 18/06/2026  
**Source** : https://www.oddalerts.com/

---

## 1. Architecture du modèle

OddAlerts utilise un système à **3 niveaux** :

| Niveau | Accès | Prix |
|--------|-------|------|
| **Free (sans compte)** | Page d'accueil uniquement (résumés) | Gratuit |
| **Free (avec compte)** | Value bets limités (2 bets/marché, 12h, pas de filtres, ordre aléatoire) | Gratuit |
| **Day Pass** | Pro complet pendant 24h | £2.99 |
| **Pro** | Accès illimité | £19.99/mois |
| **Advanced** | Pro + API + illimité | £69.99/mois |

## 2. Mécanisme de Content Gating (côté serveur)

Le gating est fait **côté backend** — l'API renvoie des données limitées selon le rôle :

```
Freemium → 2 bets/market, 12h window, randomized, no filters
Pro      → unlimited bets, full date range, all filters
```

Le frontend affiche alors :
- Une bannière "You Are Using Free Mode"
- Les limitations listées
- Un bouton "Upgrade to Pro"

## 3. Flow d'inscription

```
1. Visiteur arrive sur la home → voit les résumés gratuitement
2. Clique "Create Free Account" → formulaire email/mdp OU OAuth (Google/Telegram)
3. Compte créé avec rôle = 'free'
4. Redirigé vers la page "Choose Your Plan"
5. Peut utiliser le site en mode limité immédiatement
6. Pour débloquer : Day Pass (£2.99) ou abonnement Pro (£19.99/m)
```

## 4. Pas de "période d'essai gratuite temporisée"

Contrairement à ce qui était pensé, OddAlerts **ne fait PAS** de trial gratuit limité dans le temps. Leur stratégie :
- Contenu **dégradé** pour les gratuits (assez pour donner envie, pas assez pour être utile)
- **Day Pass payant** pour tester le produit complet (barrière psychologique basse : £2.99)
- Conversion vers abonnement via la friction du mode gratuit

## 5. Adaptation pour PariScore

### État actuel de PariScore
- Rôle `freemium` existe déjà (créé à l'inscription)
- Rôle `pro_all` existe (4 utilisateurs)
- Route `/api/v1/auth/register` → crée `freemium`
- Table `users` avec colonnes : `id, email, role, subscription_status, premium_until`
- Gate Pro existe déjà sur certaines routes (`/api/v1/bets`, `/api/v1/bankroll`)

### Implémentation proposée

**Phase 1 — Gate Freemium (back-end)**
- Ajouter `psGateFreemium()` comme middleware existant `psGatePro()`
- Routes protégées renvoient données **limitées** au lieu de 403
  - `/api/v1/matches` → max 5 matchs, pas de edge détaillé
  - `/api/v1/strategies` → max 2 stratégies, pas de backtest
  - `/api/v1/accuracy` → données agrégées uniquement (pas par league)
  - `/api/v1/sps` → 2 joueurs max

**Phase 2 — Banner Free Mode (front-end)**
- Afficher bannière "Mode Gratuit — 2 résultats max" sur les pages protégées
- Bouton "Passer Pro" → `/tarifs`
- Compteur de vues restantes par session

**Phase 3 — Day Pass (optionnel)**
- Route `/api/v1/auth/daypass` → upgrade temporaire 24h
- Colonne `trial_until` dans `users`
- Auto-downgrade au cron ou au login
