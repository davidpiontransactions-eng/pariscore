# PRODUCT.md — PariScore

> Strategic root file for PariScore. Read by every Impeccable command before
> doing any work. Answers **who / what / why**. Visual answers live in
> [DESIGN.md](./DESIGN.md).

## Register

**product**

PariScore is an **app UI**, not a marketing surface. The interface serves the
product (betting analysis, live predictions, value-bet detection). Users come
here to *do* a job — read data, compare odds, track matches, act on a bet — not
to be sold a brand story.

The few landing-shaped routes (`/`, `/setpoint`) exist for entry/navigation, but
the **primary surface is product**: dialogs, data tables, live match cards,
prediction panels, dashboards. Design is in service of clarity and speed, not
theater.

## Target users

- **Primary**: recreational-but-informed sports bettors. They understand odds,
  Elo/ratings, and form; they want an edge, not a casino thrill.
- **Secondary**: data-curious sports fans who follow tennis / football / MMA /
  F1 and want predictive context around matches.
- **Context of use**: mobile-first (PWA, Web Push alerts), often checking live
  matches and odds mid-game. Sessions are short, frequent, glanceable.
- **Language**: French primary (`next-intl`, FR config), English-capable.

## Purpose

Centralize, in one fast PWA:

- **Pre-match intelligence** across 8 sports (tennis, football, MMA, cycling, F1,
  CS2, NBA, WNBA): Elo + surface-Elo + form-driven win probabilities, PowerScore,
  H2H, implied-probability vs bookmaker odds (value-bet detection).
- **Live tracking**: scores, momentum, set-by-set, serve stats, live probability
  shifts, in-play value detection.
- **Strategy & bankroll**: betting strategies, bankroll management, bet tracking.
- **Alerts**: Web Push notifications for value bets and live match events.

The job the user is trying to get done: **"Is there a value bet here, and should
I act on it now?"** Every screen should help answer that fast.

## Brand personality

- **Data-driven, not flashy.** Numbers and probabilities lead; decoration
  follows. Trust comes from transparency (show the model, the inputs, the
  margin), not from neon excitement.
- **Calm under pressure.** During a live match the screen must stay legible and
  uncluttered even with rapid updates. No aggressive pulsing/flashing that mimics
  gambling UI.
- **Fast and decisive.** The UI should feel instant — pre-match scans, quick
  bet-slip add, one-tap value alerts. Latency and friction are the enemy.
- **Sobriety over spectacle.** A muted, dark-friendly palette with one or two
  accent colors per sport. Color encodes meaning (sport, confidence, value),
  never just decoration.

## Anti-references (what we are NOT)

- **Not a casino / gambling UI.** No slot-machine animations, no confetti, no
  "BIG WIN" flashes, no aggressive red/green pulsing that mimics roulette. We are
  an analytics tool that happens to surface bets, not a game.
- **Not a cluttered odds aggregator.** Not a wall of 40 bookmaker logos and
  scrolling tickers à la Flashscore at its busiest. Information density yes,
  visual chaos no.
- **Not a hype-y "AI prediction" landing page.** No purple gradients, no "🤖
  SUPER AI" badges, no fake authority. Models are explained in plain terms
  (Elo, form, surface) with their limits.
- **Not a dark-pattern upsell machine.** No manipulative CTAs, no urgency
  timers pushing a bet, no hidden odds margins. Honesty about vig and value.

## Strategic design principles

1. **Probability is the hero.** When a screen has a probability / PowerScore /
   value indicator, it is the largest, clearest element. Odds and bookmaker names
   are secondary.
2. **Color encodes meaning, always.** Sport (tennis green, football blue, MMA
   red, cycling amber), confidence/value (green = value for player, red = trap),
   live state (live = accent pulse, finished = muted). Never decorative color.
3. **Glanceable first, detailed on demand.** Card → dialog/tap pattern. The card
   answers "anything worth my attention?" in <1s; the detail does the deep dive.
4. **Dark mode is first-class.** Live betting happens at night, on phones, in
  low light. Dark theme must be fully designed, not an afterthought inversion.
5. **Responsible by default.** No visuals that mimic gambling reward loops.
   Bankroll/loss context is always one tap away. We surface value, we do not
   manufacture urgency.
6. **One source of truth for theme.** Design tokens live in `src/app/globals.css`
   (CSS variables) and `tailwind.config.ts`. Components are shadcn/ui (New York).
   Do not introduce ad-hoc color values in components.
