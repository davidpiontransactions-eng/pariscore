---
description: PariScore security rules — absolute constraints, never bypass
paths:
  - "server.js"
  - "pariscore.html"
  - ".env"
---

# Security Guards

<important if="adding API calls, new routes, or touching auth code">
## Absolute Rules (no exceptions)
- **Zero hardcoded secrets**: API keys only via `process.env.*` — never inline
- **Path traversal**: always `path.resolve(p).startsWith(__dirname)` before serving files
- **POST body**: always `readBodyLimited(req, 1_000_000)` — never raw `req.read()` unbounded
- **Stripe webhook**: raw body + `stripe.webhooks.constructEvent()` — NEVER parse body before this
- **JWT**: verify every protected route — no `req.user` without `verifyJWT()` middleware
</important>

## Anti-Patterns That Have Burned Us
- `sk_live_*` or `whsec_*` in any committed file → immediate security incident
- `CORS: *` is dev-only — restrict `ALLOWED_ORIGIN` in prod `.env`
- `.env`, `database.json`, `history.json`, `.git/` → block with 403, not 404

## VPS Hardening (post-breach checklist)
- All keys rotated after any exposure: ODDS_API_KEY, API_FOOTBALL_KEY, GEMINI_API_KEY, JWT_SECRET
- `ufw` rules: allow only 22, 80, 443, 3000
