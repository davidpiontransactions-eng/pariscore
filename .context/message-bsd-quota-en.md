# Message BSD Sports API — quota & rate limits (draft EN)

> Bead `ParisScorebis-9eo6`, livrable 3. À envoyer à l'équipe BSD
> (sports.bzzoiro.com — contact support/doc register) tel quel ou légèrement
> personnalisé. Objet : clarifier les quotas avant d'ajuster notre intégration.

---

**Subject: Quick question about tennis live rate limits & quota codes (ParisScore)**

Hi BSD team,

First of all — thank you for the tennis API v2. The data quality (live
scores, point-by-point, odds, H2H) is exactly what we need, and the docs are
clear overall. We're building **ParisScore**, a small French sports-analysis
web app, and tennis is one of our core sports.

We're reaching out because we hit a few **misunderstandings around quota
behaviour** and we'd like to make sure we're good citizens of the API before
we scale up:

1. **Two different 429 codes.** We receive `rate_limited` (with
   `Retry-After: 1`, burst) and `taster_exhausted` (with `Retry-After`
   counting down to midnight UTC). Could you confirm that
   `taster_exhausted` is the **daily window** quota for the free/taster
   tier, and that it **resets at 00:00 UTC** exactly? We want to build our
   fallback logic on the right assumption.

2. **Live polling cadence.** Your docs say *"poll live lists no more often
   than every 10 s"*. We've just moved our poller from 5 s to 10 s to
   comply. Two questions:
   - Does this apply **per token**, per IP, or globally?
   - Since `/matches/live/` is cached 30 s on your side, would you
     recommend a longer cadence (e.g. 30 s) for a smoother quota?

3. **Fan-out per selected match.** When a user opens a match detail, we
   fetch 5 endpoints in parallel
   (`matches/{id}`, `odds`, `h2h`, `predictions`, `point-by-point`).
   With several users on different matches, does this stay inside the
   25 req/s burst comfortably, or would you rather we **sequence** those
   calls / add a server-side cache window you'd recommend?

4. **Quota visibility on paid plans.** The docs mention that paid plans
   have no `RateLimit` / `RateLimit-Policy` headers (meaning "unlimited").
   If that ever changes, or if you plan to expose remaining-credits
   headers, we'd love a heads-up — we'd rather back off **before** hitting
   429s than after.

5. **Addon scope.** Just to confirm: with the **Sports Addon ($5/mo)**
   active, tennis endpoints stop returning `402 addon_required` for all
   v2 tennis routes (including `predictions` and `point-by-point`), correct?

We've already adjusted our side to respect `Retry-After` (we only retry
when it's ≤ 5 s — the burst case — and otherwise fall back to our own data
sources instead of hammering the API), and we never cache or redistribute
raw responses — only derived aggregates inside our app.

Happy to move this to email/support if that's easier. Thanks again for the
great API — and for any clarification you can share.

Best regards,
David — ParisScore (pariscore.fr)

---

## Notes internes (ne pas envoyer)

- Notre behaviour post-fix : poll live **10 s** (`live-broker.ts`), retry
  429 uniquement si `Retry-After ≤ 5 s` (burst), sinon fallback immédiat
  (`prematch/route.ts`), `AppError(message, code, status)` réaligné +
  `retryAfterSec` propagé (`bsd-tennis-service.ts`).
- Si réponse reçue : archiver dans `.context/` et mettre à jour le bead
  `ParisScorebis-hxyy` (analyse BSD API) avec les limites confirmées.
