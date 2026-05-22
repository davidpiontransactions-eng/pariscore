---
type: entity
slug: stripe
title: Stripe (Checkout + Webhook + Portal)
status: active-test-mode-attente-DG
tags: [vendor, payment, saas, subscription, security, pci-dss]
updated: 2026-05-22
sources: ["server.js", "CLAUDE.md", ".context/stripe_dg_checklist.md", "stripe_payments.js"]
xref: [[mes-paris]], [[mobile-pwa]], [[zero-dep-node]]
bd: [s77m]
---

# Stripe (Checkout + Webhook + Customer Portal)

**TL;DR:** Provider paiement abonnements Pro PariScore. Code livré v12.43 (Checkout + Webhook signature verify + Customer Portal). **Pending DG decisions** (9 sections checklist) avant activation live mode. Bd `s77m` P0.

## Directives sécurité absolues

1. **Zero hardcoding** clés (`sk_live_*`, `whsec_*`) — `.env` only, jamais dans git
2. **Webhook signature verify** mandatory — `stripe.webhooks.constructEvent(payload_raw, signature, secret)` avec raw body (pas parsé)
3. **Atomic role sync** — invoice.paid + customer.subscription.deleted → `users.premium_until` + `users.subscription_status` updated atomiquement
4. **PCI-DSS scope minimal** — jamais stocker carte side serveur (tokenized via Stripe.js client-side)

## État livraisons (server.js)

| Composant | Status | Location |
|---|---|---|
| Schema users SQLite | ✅ livré | `server.js:3658+` (cols `stripe_customer_id`, `stripe_subscription_id`, `premium_until`) |
| JWT + bcrypt auth | ✅ livré | `server.js:14120+` middleware FOOT_PRO gate |
| `stripeRequest()` helper | ✅ livré v12.43 | `server.js:13893+` |
| Route `/api/v1/checkout/matchday` | ✅ livré | one-time matchday pass |
| Table `stripe_events` | ✅ livré | dedup `event_id` webhook |
| Route `/api/v1/webhook/stripe` | ✅ livré | signature verify payload raw |
| Customer Portal | ✅ livré v12.43 | bd `s77m` |

## Pending DG decisions (9 sections checklist)

cf. `.context/stripe_dg_checklist.md`:

1. **Prix mensuel Pro €19** confirmé ? annuel ? mono-sport (foot only / tennis only) ?
2. **Trial gratuit** 7j / 14j / aucun ?
3. **Matchday pass** €X.XX one-time J-1 active ?
4. **Currency** : € only ou multi-devise launch ?
5. **Webhook secret** `whsec_*` configuré .env VPS ?
6. **Stripe Connect** (affiliate) Phase 2 ou jamais ?
7. **Refund policy** : no-refund SaaS / 14j cooling-off EU ?
8. **Cancellation flow UX** : immediate vs end-of-period ?
9. **Pricing page Public** : toggle test/live mode ?

⚠️ **Tant que checklist DG non validée: TEST MODE strict. Pas de `sk_live_*` injecté.**

## Custom impl Stripe SDK-less

Cohérent avec [[zero-dep-node]] — pas de `stripe-node` SDK npm. Custom HTTP wrapper:

```js
async function stripeRequest(path, method, body) {
  const url = `https://api.stripe.com/v1${path}`;
  const formBody = body ? new URLSearchParams(body).toString() : '';
  const res = await httpsFetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formBody
  });
  return res.json();
}
```

Webhook signature verify manual:
```js
function verifyStripeSignature(payload_raw, signature_header, secret) {
  const elements = signature_header.split(',').reduce(...);
  const expected = crypto.createHmac('sha256', secret)
    .update(`${elements.t}.${payload_raw}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(elements.v1), Buffer.from(expected));
}
```

## Webhook events handled

- `invoice.paid` — mark `premium_until = now + 30j`
- `invoice.payment_failed` — `subscription_status = 'past_due'`
- `customer.subscription.deleted` — `premium_until = now` (downgrade)
- `customer.subscription.updated` — sync plan changes

## Tarifs target (TBD DG)

| Plan | Prix proposé | Coverage |
|---|---|---|
| Gratuit | €0 | 5 ligues UE + tableau readonly + AI Scout 1/jour |
| Pro Foot | €19/mo | 18 ligues + Insights modal full + AI Scout illimité + Mes Paris |
| Pro Tennis | €X/mo | Tennis only (TBD) |
| Pro Duo | €25/mo | Foot + Tennis (TBD) |
| Annuel | -20% | 12 mois × prix - 20% |
| Matchday Pass | €X one-time | Accès Pro J-1 / J / J+1 single match |

## Risques

- Activation live sans webhook verify validation = vulnerability payment forgery
- Refund policy floue = chargebacks risk
- Trial sans card requirement = trial abuse vector

## Bd ticket

- `s77m` P0 — Code livré, DG checklist 9 sections pending

## Related

- [[mes-paris]] — Feature gated par Pro plan
- [[mobile-pwa]] — Pricing page accessibility mobile
- [[zero-dep-node]] — Justification SDK-less impl

## Changelog

- 2026-05-22: création initiale lors du bootstrap wave 2
