# Marketing Affiliation 5 phases — bd `l9vk`

> CTO/Lead Data Scientist · v1.0 — 22 mai 2026
> Stack zero-dep · Node.js natif · SQLite WAL · `pariscore.html` SPA
> Auteur: GM PariScore (consult Product Manager Agent + Engineering Lead + Financier)

## 0. Contexte & objectif

PariScore lance une stratégie acquisition utilisateurs cross-canal (5 phases). Infrastructure tracking interne existante (table `affiliates` + `affiliate_clicks` + routes CRUD `/api/v1/affiliate`, route 1st-party 302 `/r/`, postback S2S `/cb/`). Cette mission complète :

- **Code** : route `affiliate_id`-based click 302 (vs bookmaker), helper UTM, hook Stripe webhook ROI (`metadata.affiliate_id`), route admin stats agrégées par affiliate × période.
- **Stratégie** : 5 phases documentées (1xBet, Twitter, YouTube, Telegram, Stripe) avec ROI estimé.
- **Landing pages** : 2 templates statiques (1xBet partnership, Telegram channel).

ROI cible 6 mois : **+800 inscriptions Premium @ €19/mo = €15 200 MRR** (CAC < €15, LTV/CAC > 3).

---

## Phase 1 — 1xBet partnership (RevShare 30–40%)

**Objectif** : monétiser le trafic existant (~5k visites/mois actuel) via deeplinks 1xBet.

**Modèle commission** :
- Hybrid CPA + RevShare : 1xBet Partners standard offre **30% RevShare lifetime** OU **€25–€50 CPA flat** par FTD (First Time Deposit).
- Recommandation : **40% RevShare négocié manager dédié** (volume > 50 FTD/mois → tier supérieur).

**Infrastructure tracking** :
- INSERT row `affiliates` avec `bookmaker='1xbet'`, `affiliate_link='https://1xbet.com/promo?ref=PARISCORE_AFF_ID'`, `deeplink_template='https://1xbet.com/sport/football/match/{matchId}?ref=PARISCORE&subid={subid}'`, `commission_type='revshare'`, `commission_rate=40`.
- Route `/r/?b=1xbet&mid=...&c=match-card` (existante) injecte `subid` composé `ps_{user}_{sport}_{league}_{match}_{ctx}`.
- Alternative : nouvelle route `GET /api/v1/affiliate/click/:affiliateId?source=X&campaign=Y` (livrée ci-dessous) pour CTAs hors-match (banner, landing, email).

**KPIs trackés** (table `affiliate_clicks`) :
- `click_id` UUID v4 (idempotency postback)
- `converted_at` (UPDATE via `/cb/` postback 1xBet ou Stripe webhook si bundling)
- `payout_cents` (montant CPA ou RevShare cumul)
- `conversion_type` ('cpa' | 'revshare' | 'cpl')

**Reconciliation Stripe ↔ 1xBet** :
- Si user PariScore Premium devient référent 1xBet : `subid` = `ps_uX_...` permet de lier clicks → user_id → Stripe customer.
- Dashboard admin agrège LTV utilisateur (revenu Stripe Premium + RevShare 1xBet sur deposits).

**ROI estim** : 200 clicks/mois × 5% conversion FTD × €40 avg deposit × 40% revshare = **€160 MRR / mois 1**. Scale 6 mois : 1000 clicks/mois × tier supérieur = **€800–1200 MRR**.

**Status** : ✅ code livré (route click + UTM helper + admin stats). ⏳ Ops : signup 1xBet Partners (manager bzzoiro déjà PariScore vendor — peut intro ?), récupération `1XBET_AFFILIATE_ID`, INSERT seed row affiliates.

---

## Phase 2 — Twitter/X content automation

**Objectif** : 3 tweets/jour automated → engagement organique → trafic top funnel.

**Format tweets** :
1. **08h00 (Top Picks AI)** : "🎯 Top 3 picks AI J : [Match A] EV+%12 · [Match B] EV+%8 · [Match C] EV+%6 → analyse complète : pariscore.com/?utm_source=twitter&utm_campaign=top_picks_morning"
2. **14h00 (ROI weekly Monday)** : "📊 ROI semaine PariScore : +18% (47 picks vérifiés, 62% accuracy O2.5). Backtest live : pariscore.com/historique"
3. **20h00 (Flash value bets)** : "⚡ VALUE BET LIVE : [Match X] Edge 11% · Cote 2.45 Pinnacle vs fair 2.18 → pariscore.com/match/X?utm_source=twitter&utm_campaign=flash"

**Bot Node.js zero-dep** :
- Twitter API v2 OAuth1 signature via `crypto.createHmac('sha1', ...)` + `fetch` natif
- Cron via `setInterval` ou cron VPS calé sur 3 horaires
- Source data : `GET /api/v1/ai-scout` (cache 6h) + `GET /api/v1/history?limit=50` (ROI rolling 7j)
- Lien short : `pariscore.com/r/?b=best&c=twitter&mid={matchId}` (route existante) ou direct `/?utm_source=twitter&utm_campaign=X`

**Tracking** : UTM tags injectés via helper `injectAffiliateUTM(url, affiliateId, source, campaign)` (livré ci-dessous). Conversion mesurée via `affiliate_clicks.context='twitter_*'` + funnel Stripe checkout `metadata.utm_campaign`.

**ROI estim** : 500 impressions/tweet × 3 tweets/jour × 30 jours = 45k impressions/mois. CTR 1.5% = 675 clicks/mois. Conv 3% Premium = 20 inscriptions @€19/mo = **€380 MRR/mois** récurrent organique.

**Status** : ⏳ code Phase 2 spec écrite, implémentation hors scope mission (ops content + bot OAuth1). Ticket bd recommandé séparé `l9vk-phase2-twitter-bot`.

---

## Phase 3 — YouTube videos hebdomadaires

**Objectif** : 1 vidéo/semaine "Top 3 EV+ J-1 ligues européennes" → SEO YouTube + backlink description.

**Format** :
- Durée : 4–6 min (sweet spot YouTube Shorts long format)
- Script auto-généré : `GET /api/v1/ai-scout` snapshot J-1 + screen-recording terminal (ffmpeg + Playwright headed)
- Voice-over : ElevenLabs TTS ou voix David (DG)
- Description : 5 affiliate links UTM `utm_source=youtube&utm_campaign=ep_X`
- Thumbnail : auto-generated via Canva API ou template SVG

**Stack production** :
- Cron VPS lundi 06h00 : génère script .txt + screen-recording 90s match analyses
- Upload manuel YT (Google API v3 require quota review — skip auto-upload phase 1)
- Tracking : UTM links dans description + commentaire épinglé

**ROI estim** : 1k vues/vidéo × 5 vidéos/mois = 5k vues. CTR description 2% = 100 clicks. Conv 4% Premium = 4 inscriptions @€19/mo = **€76 MRR/mois** + SEO YouTube long terme (effet cumulatif 18 mois).

**Status** : ⏳ ops content (David ou freelance vidéaste). Code support : générateur script `.txt` from AI-Scout snapshot livrable Phase 2 future.

---

## Phase 4 — Telegram channel funnel

**Objectif** : free tier limité → conversion Premium.

**Existant** :
- Bot `@PariScoreBot` (bd `e7l` Phase 5 livré) push alertes value bets + live momentum
- Alertes Telegram users authentifiés via `chat_id` link table `users.telegram_chat_id`

**Stratégie funnel** :
- **Channel public `@PariScoreFR`** (broadcast) : 10 picks/jour MAX, latence **30 min** (vs alertes Premium temps-réel). Teaser : "🎯 Pick AI : Match X · Cote 2.10 · Edge 8% → Premium voit les 50 autres picks J immédiatement"
- **CTA conversion** : message daily 20h00 "💎 Premium = 50 alertes/jour temps-réel + ROI tracking + Power Score → /premium" → link Stripe checkout `metadata.utm_source=telegram&utm_campaign=channel_cta`
- **Bot @PariScoreBot** : `/start` → onboarding 3 messages → CTA `/premium` après J+3 si free user

**ROI estim** : 1k abonnés channel mois 1 (croissance organique + cross-promo Twitter/YouTube). Conv Premium 2%/mois = 20 inscriptions @€19/mo = **€380 MRR/mois**. Scale 6 mois : 5k abonnés × 3% conv = **€2 850 MRR**.

**Status** : ✅ infra bot livré bd `e7l`. ⏳ ops content (poster channel public, copywriting CTA). Code support : extension webhook conversion attribution livré ci-dessous (metadata.utm_source).

---

## Phase 5 — Stripe ROI tracking (BACKEND CORE)

**Objectif** : attribution end-to-end click affiliate → Stripe Premium subscription → LTV mesurée par affiliate/canal.

**Architecture** :
1. **Click side** : route `GET /api/v1/affiliate/click/:affiliateId?source=X&campaign=Y` → INSERT `affiliate_clicks` (click_id UUID v4, context=`{source}_{campaign}`) → 302 redirect vers `affiliate.affiliate_link` + UTM injectés.
2. **Subscription side** : checkout Stripe `metadata.affiliate_click_id={click_id}` (frontend lit cookie `ps_aff_click` posé en session du redirect, l'envoie via POST `/api/v1/payments/create-checkout-session` body `affiliate_click_id`).
3. **Webhook side** : event `checkout.session.completed` ou `customer.subscription.created` → si `obj.metadata.affiliate_click_id` présent → UPDATE `affiliate_clicks SET converted_at=NOW, customer_id=stripe_customer_id WHERE click_id=?`.
4. **Recurring revenue** : event `invoice.paid` → si user a `affiliate_click_id` tracé → UPDATE `affiliate_clicks SET payout_cents = payout_cents + (invoice.amount × commission_rate%)`.

**Migration schema** : ALTER TABLE `affiliate_clicks` ADD COLUMN `customer_id TEXT` (Stripe customer_id).

**Admin dashboard route** : `GET /api/v1/admin/affiliate/stats?affiliate_id=X&period=30d` retourne `{clicks, conversions, conv_rate, ltv_total, payout_total, roi_pct}`.

**ROI estim** : permet d'identifier les canaux les plus rentables. Estim cible 6 mois :
- 1xBet : 200 conv × €40 LTV = €8 000
- Twitter : 60 conv × €228 LTV (12 mois Premium) = €13 680
- YouTube : 24 conv × €228 LTV = €5 472
- Telegram : 120 conv × €228 LTV = €27 360
- **Total LTV mois 6** : ~€54 500 vs CAC estimé €5 000 (content/ops) → **LTV/CAC ≈ 11** (excellent SaaS standard)

**Status** : ✅ code Phase 1 + 5 livré (3 routes + 1 helper + Stripe webhook hook + schema migration).

---

## Récap effort & livrables

| Phase | Code livré | Ops pending | Effort résiduel |
|---|---|---|---|
| 1 — 1xBet | ✅ route click + UTM helper | Signup partners + INSERT seed | 1h DG |
| 2 — Twitter | ⏳ spec écrite | Bot OAuth1 + cron + content | 8h dev + content |
| 3 — YouTube | ⏳ spec écrite | Script gen + recording + upload | 12h dev + 4h/semaine content |
| 4 — Telegram | ✅ bot existant bd e7l | Channel public + copywriting | 6h content + ops |
| 5 — Stripe ROI | ✅ webhook hook + admin stats | Dashboard frontend admin.html | 4h frontend (futur) |

**Total code livré mission** : ~3h dev (routes + webhook + landing pages + doc).
**Phases 2/3/4 ops/content** : ticket bd séparé recommandé (out of scope mission code).

---

## Conformité & sécurité

- **RGPD** : cookie `ps_aff_click` = first-party, 90j, opt-out via `DELETE /api/v1/affiliate/optout`.
- **Affiliate disclosure** : footer pariscore.html mentionne "Liens affiliés — PariScore peut percevoir commission".
- **ANJ France** : Coteur déjà prio 99 (comparateur légal). 1xBet = .com international → mention "Réservé hors France réglementée".
- **Stripe metadata** : `affiliate_click_id` ne contient pas de PII (UUID anonyme).
- **Rate limit** : route click 302 protégée naturellement (IP + UA log, pas de bruteforce possible car redirige).

---

*Fin doc · prochaine itération : ticket bd `l9vk-phase2-twitter` pour bot OAuth1 zero-dep si DG GO.*
