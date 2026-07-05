# ABOUT-1 — full-stack-developer

## Task
Add an "About / How it works" page (Dialog, not route) explaining the Elo prediction model to the SetPoint Next.js 16 app.

## Deliverables
- `src/components/about-dialog.tsx` (NEW): singleton `openAboutDialog()` + `<AboutDialog/>` component, max-w-2xl, ScrollArea, 7 sections with lucide icons (TrendingUp, Activity, Scale, Target, AlertTriangle, ShieldCheck), Elo formula in `<pre><code>` block (no MathJax), close button. Mobile full-width via `w-[95vw] max-w-2xl`.
- `src/messages/fr.json` + `src/messages/en.json` (MODIFIED): added `about` namespace with `title`, `subtitle`, `trigger`, `close`, and `sections.{approach,elo,form,h2h,ic,limits,transparency}.{title,body}` — plus `formula` field on `elo` only.
- `src/app/layout.tsx` (MODIFIED): import `AboutDialog`, mount after `<PrivacyDialog/>`.
- `src/app/page.tsx` (MODIFIED): import `openAboutDialog` + `HelpCircle`, added `useTranslations("about")` as `tAbout`, hero trigger button next to the "Modèle Elo+Forme+Surface" badge, footer trigger button next to "Gérer les cookies". Both ghost-styled (not primary CTA).

## Math correction
Task brief said "Δ=400 means (76 % for +400)" — this is mathematically wrong. Logistic Elo `1/(1+10^(-Δ/400))`:
- Δ=+200 → 0.760 (76 %)
- Δ=+400 → 0.909 (91 %)
- Δ=-200 → 0.240 (24 %)

Wrote the correct values in the body text so the educational content is technically accurate.

## Lint
`bun run lint` → exit code 0, no errors, no warnings. `react-hooks/set-state-in-effect` rule (implicit via next/core-web-vitals in Next 16) is satisfied: the only effect in `AboutDialog` mutates the module-scoped `openFn` ref (no `setState` call inside the effect body); the setter is invoked exclusively from external event handlers via `openAboutDialog()`.

## SSR smoke tests (curl http://localhost:3000/)
- FR default: 3 occurrences of "Comment ça marche ?" in HTML (hero title attr, hero label, footer label) + serialized `about` namespace. All 7 FR section titles present. Elo formula "P(A gagne) = 1 / (1 + 10^(-Δ/400))" present.
- EN (NEXT_LOCALE=en cookie): trigger "How it works?" appears 4×. All 7 EN section titles present ("Our approach", "The Elo model", "Recent form", "Direct H2H", "Confidence interval", "Limitations", "Transparency").

## Constraints respected
- No new route (only `/` is visible; About is a Dialog mounted in layout.tsx).
- Singleton pattern (mirrors `PrivacyDialog`).
- All text via `useTranslations("about")` — no hardcoded strings.
- Math formula in `<pre><code>` blocks — no MathJax/KaTeX.
- Mobile full-width: `w-[95vw] max-w-2xl`.
- Did NOT start dev server (system-managed). Did NOT use server actions.
- Did NOT call Complete.

## Files touched
| File | Action | LOC |
|------|--------|-----|
| `src/components/about-dialog.tsx` | NEW | 148 |
| `src/messages/fr.json` | MODIFIED | +37 lines (about namespace) |
| `src/messages/en.json` | MODIFIED | +37 lines (about namespace) |
| `src/app/layout.tsx` | MODIFIED | +2 lines (import + mount) |
| `src/app/page.tsx` | MODIFIED | +24 lines (imports, hook, hero trigger, footer trigger) |

## Sample text (FR — approach.body)
> SetPoint combine trois signaux complémentaires pour estimer la probabilité de victoire de chaque joueur : un classement Elo (ajusté par surface), une mesure de forme récente, et l'historique direct des confrontations (H2H). Aucun signal pris isolément ne suffit — le modèle les fusionne avec des poids fixes : Elo 70 %, Forme 20 %, H2H 10 %. Le résultat est une probabilité centrale accompagnée d'un intervalle de confiance à 95 %.

## Sample text (EN — elo.body, first paragraph)
> The Elo rating assigns each player a number that evolves after every match: beating a higher-rated player earns more points than beating an underdog. The win probability follows from the gap Δ (Elo A − Elo B) via a logistic function. A few reference points: Δ = +200 ≈ 76%, Δ = +400 ≈ 91%, Δ = −200 ≈ 24%.

## Issues
None. All 7 sections render in both FR and EN. Dialog opens via hero button and footer button. Escape closes (radix Dialog default behavior). Math correction applied to fix the task brief's "76 % for +400" error.
