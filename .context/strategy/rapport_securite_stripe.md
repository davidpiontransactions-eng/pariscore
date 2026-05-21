# Rapport sécurité — Intégration Stripe Subscription Pro (bd s77m)

> **Statut** : Phase 0-4 livrées · Phase 5 (ce rapport) · **ATTENTE GO DG avant test Stripe CLI live**
> **Auteur** : Lead Security Architect (CTO PariScore)
> **Date** : 2026-05-21
> **Scope** : abonnement Pro mensuel/annuel via Stripe Checkout + Customer Portal + Webhook hardened

---

## 1. Conformité directives DG (CLAUDE.md § Module Stripe)

| Directive | Statut | Implémentation |
|---|---|---|
| Zéro hardcoding clés | ✅ | Toutes via `process.env.*` ; jamais dans le code ; `.env` listé dans `.gitignore` (vérifié) |
| Signature webhook vérifiée | ✅ | `verifyStripeSignature(rawBody, sigHeader)` HMAC-SHA256 timing-safe |
| Raw body intercept | ✅ | `readBodyLimited()` lit chunks AVANT tout JSON.parse middleware (vanilla Node, pas Express) |
| Sync atomique état abonnement | ✅ | `psSyncUserSubscription()` UPDATE single statement sur `users` |
| Évènements clés gérés | ✅ | `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.{created,updated,deleted}` |
| Zéro dépendance npm | ✅ | Réutilisation pattern HTTPS natif (`stripeRequest`) existant ; pas de `npm install stripe` |

## 2. Architecture livrée

### 2.1 Schéma DB (migrations idempotentes)

```sql
-- Extension users (ALTER si colonne absente, PRAGMA check)
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT;  -- active|trialing|past_due|canceled|...
ALTER TABLE users ADD COLUMN premium_until INTEGER;     -- epoch sec, current_period_end
ALTER TABLE users ADD COLUMN preferences_json TEXT;     -- filtres favoris Foot/Tennis (cahier des charges)
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Idempotency webhook (anti-rejeu)
CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  payload_hash TEXT
);
```

### 2.2 Routes API ajoutées

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/payments/create-checkout-session` | `requireUserAuth` | Crée session Stripe mode=subscription. Body `{plan,billing}`. Réutilise `customer` existant si déjà lié. |
| POST | `/api/v1/payments/customer-portal` | `requireUserAuth` | Génère URL Billing Portal Stripe (self-service annulation/upgrade) |
| GET | `/api/v1/payments/subscription` | `requireUserAuth` | Retourne status courant + premium_until + days_remaining |
| POST | `/api/v1/webhook/stripe` | signature Stripe | **Étendu** : matchday (legacy) + subscription Pro (5 event types) |
| GET | `/api/v1/auth/me` | JWT | **Étendu** : retourne subscription_status, premium_until ; refresh token si role drift |

### 2.3 Helpers internes

- `stripeRequest(method, endpoint, params)` : durci avec flatten récursif (objets/arrays Stripe form encoding)
- `verifyStripeSignature(raw, sig, tolerance=300s)` : tolérance timestamp + parse multi-v1 (rotation secret) + `crypto.timingSafeEqual`
- `psResolveProPriceId(plan, billing)` : mapping plan UI → Price ID env
- `psStripePriceToRole(priceId)` : mapping Stripe → role JWT (`pro_all` / `pro_foot` / `pro_tennis`)
- `psStripeEventAlreadyProcessed(eventId, eventType)` : INSERT idempotency + return true si UNIQUE conflict
- `psSyncUserSubscription({...})` : UPDATE atomique partiel
- `psFindUserByCustomer(customerId)` : lookup inversé pour events sans metadata

## 3. Coverage sécurité — checklist

### 3.1 Signature webhook
- ✅ HMAC-SHA256 sur `${timestamp}.${rawBody}` avec `STRIPE_WEBHOOK_SECRET`
- ✅ Tolérance timestamp 300s (anti-replay)
- ✅ `crypto.timingSafeEqual` (anti timing-attack)
- ✅ Support multiples `v1=...` dans header (rotation secret Stripe)
- ✅ Refus 400 si signature absente/invalide (jamais 200 silencieux)
- ⚠️ Body est string concat — Stripe envoie UTF-8 valide donc OK ; durcissement futur : Buffer pur

### 3.2 Idempotency
- ✅ Table `stripe_events` PRIMARY KEY sur `event_id`
- ✅ INSERT à réception → si UNIQUE conflict, skip (Stripe retry safe)
- ✅ Si handler échoue (catch 500) → DELETE event_id pour autoriser retry valide
- ✅ Stripe re-tente jusqu'à 3 jours → couverture suffisante

### 3.3 Validation user access
- ✅ `requireUserAuth` exige JWT valide + `userId` (exclut admin/matchday qui n'ont pas d'ID DB)
- ✅ Checkout session lie `metadata.user_id` ET `client_reference_id` (double belt+suspenders)
- ✅ `subscription_data.metadata.user_id` propagé pour events `invoice.*` qui n'ont pas session metadata
- ✅ Customer Portal vérifie `stripe_customer_id` existant avant ouverture

### 3.4 Rotation clés
- ✅ `.env` jamais committé (`.gitignore` confirmé)
- ✅ `render.yaml` toutes les `STRIPE_*` en `sync: false` → injection manuelle dashboard
- ✅ Signature accepte multiples v1 → rotation `STRIPE_WEBHOOK_SECRET` sans downtime
- ⚠️ **Reste à faire DG** : bd c8m rotation 8 clés post-incident 2026-05-20 (cf. ticket)

### 3.5 Dispute handling
- 🟡 Non implémenté ce sprint : `charge.dispute.created` → marquer user `disputed` + freeze
- 🟡 Pour Phase 2 : webhook handler `radar.early_fraud_warning.created`

### 3.6 Downgrade gracieux
- ✅ `invoice.payment_failed` → status=`past_due` mais role **non révoqué** (grace period Stripe retries)
- ✅ `customer.subscription.deleted` → role=`freemium`, premium_until=null, sub_id=null, **customer_id conservé** (ré-abonnement easy)
- ✅ `customer.subscription.updated` avec status non-active → préserve role courant jusqu'à deleted

## 4. Variables d'environnement requises

```bash
# .env (jamais committé)
STRIPE_SECRET_KEY=sk_live_...               # ou sk_test_ pour dev
STRIPE_WEBHOOK_SECRET=whsec_...             # Stripe dashboard Webhooks
STRIPE_PRICE_PRO_MONTHLY=price_...          # OBLIGATOIRE — créer sur Products
STRIPE_PRICE_PRO_ANNUAL=price_...           # optionnel
STRIPE_PRICE_PRO_FOOT=price_...             # optionnel (plan mono-sport)
STRIPE_PRICE_PRO_TENNIS=price_...           # optionnel
STRIPE_PRO_SUCCESS_URL=https://pariscore.fr/?subscription=success
STRIPE_PRO_CANCEL_URL=https://pariscore.fr/?subscription=cancel
STRIPE_PORTAL_RETURN_URL=https://pariscore.fr/?portal=back
# Legacy matchday (existant)
STRIPE_MATCHDAY_PRICE_ID=price_...
STRIPE_SUCCESS_URL=https://pariscore.fr/?matchday=success
STRIPE_CANCEL_URL=https://pariscore.fr/
```

## 5. Plan de test (à exécuter post-GO DG)

### 5.1 Local (Stripe CLI test mode)

```bash
# 1. Démarrer Stripe CLI listener
stripe listen --forward-to localhost:3000/api/v1/webhook/stripe
# Copier whsec_... affiché dans .env > STRIPE_WEBHOOK_SECRET

# 2. Créer un Product + Price en mode test
stripe products create --name="PariScore Pro"
stripe prices create --product=prod_XXX --unit-amount=1900 --currency=eur \
  --recurring[interval]=month
# Copier price_... dans .env > STRIPE_PRICE_PRO_MONTHLY

# 3. Démarrer server
node server.js

# 4. Login user test puis appel route checkout
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@pariscore.fr","password":"Test1234!"}'
# token=...

curl -X POST http://localhost:3000/api/v1/payments/create-checkout-session \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
  -d '{"plan":"pro_all","billing":"monthly"}'
# → ouvrir url retournée, payer avec card 4242 4242 4242 4242

# 5. Vérifier DB
sqlite3 pariscore.db "SELECT id,email,role,subscription_status,premium_until FROM users WHERE email='test@pariscore.fr'"
# Doit afficher : role=pro_all, subscription_status=active, premium_until=<epoch>
```

### 5.2 Tests events à déclencher manuellement (Stripe CLI)

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
stripe trigger customer.subscription.updated
```

### 5.3 Test idempotency (anti-rejeu)

```bash
# Capturer un event_id réel puis le rejouer 2x avec même signature
# Attendu : 1er → 200 received:true · 2e → 200 received:true,idempotent:true
# DB : aucune double application (role/period_end inchangé au 2e)
```

### 5.4 Test signature invalide

```bash
curl -X POST http://localhost:3000/api/v1/webhook/stripe \
  -H "Stripe-Signature: t=1234567890,v1=invalid" \
  -d '{"id":"evt_fake","type":"invoice.paid"}'
# Attendu : 400 Signature invalide
```

## 6. Risques résiduels & mitigations

| Risque | Sévérité | Mitigation |
|---|---|---|
| User logout/login requis pour voir nouveau rôle | MOYEN | `/api/v1/auth/me` refresh token automatique si role drift DB vs JWT |
| Webhook reçu avant que `/checkout/sessions` retourne id côté client | FAIBLE | Webhook utilise `metadata.user_id` → indépendant du flow client |
| Stripe customer créé sans user_id metadata (legacy import) | FAIBLE | `psFindUserByCustomer` fallback ; `metadata.user_id` toujours injecté à la création |
| Multiple subscriptions actives même user | MOYEN | `customer.subscription.updated` ré-écrit `stripe_subscription_id` → dernier wins. **TODO** : check pre-create + bloquer si existant active |
| RACE : 2 webhooks parallèles même customer | FAIBLE | better-sqlite3 transactions sérialisées, UPDATE single-row atomique |
| Body string concat (vs Buffer) pour signature | FAIBLE | Stripe garantit UTF-8 ; durcissement futur possible |
| `STRIPE_WEBHOOK_SECRET` non set en dev | MOYEN | Webhook short-circuits `verifyStripeSignature` → return false → 400. Dev doit set un secret factice ou désactiver vérif explicitement. |

## 7. Liens vers le code

- Migrations DB : `server.js:3359-3404`
- Stripe env vars : `server.js:13392-13410`
- Helpers (`psResolveProPriceId`, `psStripeEventAlreadyProcessed`, `psSyncUserSubscription`) : `server.js:13452-13525`
- Routes payments : `server.js:20920-21030` (approximatif)
- Webhook étendu : `server.js:21035-21155` (approximatif)
- render.yaml Stripe Pro vars : `render.yaml:85-100`

## 8. Décisions DG en attente

1. **Pricing final** : €19/mois Pro All confirmé ? Annuel offrir −15% (€190/an) ?
2. **Plans mono-sport** : Pro Foot / Pro Tennis distincts (€11/mois chacun ?) ou Duo uniquement ?
3. **Période d'essai** : 7 jours gratuits via Stripe trial ? (à activer dans Stripe Dashboard côté Price)
4. **GO test Stripe CLI live** : valider une fois Phase 4 frontend hookée
5. **Dispute handling** : Phase 2 séparée ou intégrer dispute webhook maintenant ?

---

*Rapport livré 2026-05-21 — bd ParisScorebis-s77m Phase 0-5. Attente GO DG.*
