# Stripe Checklist DG — bd s77m unblock

> Code 100% livré v12.43. Backend (5 phases) + frontend 4 boutons Pro wires + rapport sécurité .context/strategy/rapport_securite_stripe.md.
> Reste UNIQUEMENT actions manuelles DG ci-dessous.

## 1. Créer compte Stripe (mode TEST d'abord)

- https://dashboard.stripe.com/register
- Activer mode **TEST** (toggle top-right) — pas de live tant que webhook pas validé

## 2. Créer Products + Prices

Dashboard Stripe → Products → New product, pour CHAQUE produit ci-dessous :

| Product Name | Billing | Amount | Env var côté .env |
|---|---|---|---|
| PariScore Pro (Mensuel) | Recurring monthly | TBD € | `STRIPE_PRICE_PRO_MONTHLY` |
| PariScore Pro (Annuel) | Recurring yearly | TBD € | `STRIPE_PRICE_PRO_ANNUAL` |
| PariScore Pro Football | Recurring monthly | TBD € | `STRIPE_PRICE_PRO_FOOT` |
| PariScore Pro Tennis | Recurring monthly | TBD € | `STRIPE_PRICE_PRO_TENNIS` |
| PariScore Matchday Pass | One-time | TBD € | `STRIPE_MATCHDAY_PRICE_ID` |

⚠️ Décisions DG bloquantes (cf bd s77m notes) :
- Prix mensuel/annuel final
- Trial 7 jours oui/non
- Plans mono-sport (foot/tennis séparés) oui/non
- Matchday pass oui/non

→ Copier les `price_xxx` IDs générés.

## 3. Récupérer Secret Key

Dashboard → Developers → API keys → Secret key (TEST: `sk_test_...`)

→ Copier en `STRIPE_SECRET_KEY`.

## 4. Webhook endpoint

Dashboard → Developers → Webhooks → Add endpoint

- **URL** (TEST local): forward via `stripe listen` (étape 6)
- **URL** (TEST prod): `https://pariscore.fr/api/v1/payments/webhook`
- **Events** à écouter (5) :
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`
  - `customer.subscription.updated`

→ Copier `whsec_...` en `STRIPE_WEBHOOK_SECRET`.

## 5. .env complet (TEST)

Append à `.env` local + VPS prod :

```bash
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxx
STRIPE_PRICE_PRO_ANNUAL=price_xxxxxxxxxxxx
STRIPE_PRICE_PRO_FOOT=price_xxxxxxxxxxxx
STRIPE_PRICE_PRO_TENNIS=price_xxxxxxxxxxxx
STRIPE_MATCHDAY_PRICE_ID=price_xxxxxxxxxxxx
STRIPE_SUCCESS_URL=https://pariscore.fr/?stripe=success
STRIPE_CANCEL_URL=https://pariscore.fr/?stripe=cancel
STRIPE_PRO_SUCCESS_URL=https://pariscore.fr/?stripe=pro_success
STRIPE_PRO_CANCEL_URL=https://pariscore.fr/?stripe=pro_cancel
STRIPE_PORTAL_RETURN_URL=https://pariscore.fr/?stripe=portal
```

## 6. Test local Stripe CLI

```bash
# Install CLI : https://docs.stripe.com/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/v1/payments/webhook
# Garder ouvert dans terminal séparé. CLI affiche whsec_ override à coller dans .env LOCAL uniquement.

# Dans autre terminal : lancer le serveur
node server.js

# Trigger checkout flow depuis pariscore.html (clic Pro CTA)
# OU CLI direct :
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

**Verify** :
- Logs server.js → `[STRIPE] event ... processed`
- DB `pariscore.db` table `stripe_events` ligne ajoutée
- DB users table → champ `subscription_status='active'` + `stripe_customer_id` set
- Idempotency : trigger même event 2x → 2e ignoré

## 7. Bascule LIVE

Après validation TEST complète :

1. Stripe Dashboard → switch toggle **TEST → LIVE**
2. Recréer **toutes les Prices** en mode LIVE (IDs différents)
3. Récupérer `sk_live_...` + créer webhook prod URL
4. Update `.env` VPS avec keys LIVE
5. Reboot `pm2 restart pariscore`
6. Faire un achat réel test (montant min) + vérifier full flow

## 8. Sécurité — checklist finale

- [ ] `.env` jamais commit (vérifier `.gitignore`)
- [ ] Webhook signature timing-safe (déjà code v12.43 — vérifier crypto.timingSafeEqual)
- [ ] Idempotency table `stripe_events` activée
- [ ] HTTPS strict prod (nginx redirect 80→443)
- [ ] `STRIPE_WEBHOOK_SECRET` absent en code source — verify `grep -r sk_test\|sk_live\|whsec` sur tout repo doit return 0 hit
- [ ] Rotation keys policy : tous les 90 jours, ou immédiat si breach suspecté
- [ ] Dispute handling : Stripe Radar activé + webhook `charge.dispute.created` (à ajouter si besoin)

## 9. Bloquants en attente DG

Cf bd s77m notes :
- [ ] Prix mensuel final
- [ ] Prix annuel final + discount (typique -20%)
- [ ] Trial 7 jours oui/non
- [ ] Plans mono-sport (foot only / tennis only) maintenus ?
- [ ] Matchday pass one-time maintenu ?
- [ ] Dispute / refund policy (auto-refund < 24h vs case-by-case)

---

*Document généré 2026-05-21 — Code ready, awaiting DG manual config + Stripe CLI test.*
