---
# Plan — Moteur CMP + Skellam + CLV (Over/Under handball)
Date : 2026-09-24. Décisions validées : (a) cotes d'ouverture 1xbet du snapshot comme proxy CLV ; (b) seuil d'edge > 1,5 % ; (c) CMP pour totaux + Skellam pour handicap.
Références : Felice & Ley doi:10.1177/22150218251313937, arXiv:2307.11777 (SEL), arXiv:2407.15987 (JO 2024), Groll et al. JSA 2020;6(3):187-197, Dixon & Coles Appl. Stat. 1997, Springer s10479-022-04722-3, ImpliedScore/SportSignals (devig).

## 1. Snapshot odds → cotes d'ouverture
Fichiers : src/lib/handball-flashscore.ts + src/lib/handball-data.ts. Mapper openingOdds { over55, under62, fav1x2, handicap, btts30 } depuis les cotes 1xbet du snapshot (handball-flashscore.ts:121). Champ dérivé isCLVTestable = terminé + openingOdds présent. Le scrape frais PM2 (543 matchs) alimente le volume ; le backtest CLV croît avec les données.

## 2. Moteur CMP — totaux
Nouveau src/lib/handball-cmp.ts (TS pur, sans dépendance). P(k; λ, ν) = λ^k/(k!)^ν · e^(−λ)/Z. MLE Newton-Raphson maison sur 5–10 derniers matchs pondérés → (λa,νa) attaque, (λd,νd) défense. Forces s_a=log(λa), s_d=−log(λd) (Felice SEL). Grille 17×17. P(total>L) = 1 − Σ P(i,j). Exports : fitCMP, cmpPmf, teamStrength, overUnderProb.

## 3. Moteur Skellam — handicap
Nouveau src/lib/handball-skellam.ts. P(k) = e^(−(λh+λe))·(λh/λe)^(k/2)·I_k(2√(λh·λe)), λh/λe issus du CMP. P(home−away > 4.5) = Σ P(k≥5). Exports : skellamPmf, handicapProb.

## 4. Devig + CLV sur cotes d'ouverture
Nouveau src/lib/handball-clv.ts. Devig proportionnel (1/cote ÷ booksum) ; test Shin optionnel avec note si résidu favori. clv = (p_model − p_implied)/p_implied par market. Métriques : meanCLV, stdCLV, nBets, hit-rate, profit simulé. Edge affiché si |CLV| > 1,5 %. Seuil n ≥ 30 par stratégie-ligue.

## 5. Backtest CLV
Nouveau src/lib/handball-cmp-backtest.ts. Walk-forward chronologique : CMP/Skellam → fair probs → CLV vs ouverture 1xbet. Sortie HandballCLVResult { league, nMatches, strategies[{key,label,market,nBets,meanCLV,stdCLV,hitRate,profitSimU,roiPct,curve}], global, methodology, clvProxy:true, computedAt }. Fallback mode simulated si openingOdds < 50 % des matchs.

## 6. Route API
Modifier src/app/api/handball/backtest/route.ts : paramètre mode=clv|simulated (défaut simulated). Cache TTL 15 min par ligue × mode. Endpoint unique.

## 7. Widget double mode
Modifier src/components/handball/handball-backtest-widget.tsx : sélecteur Simulé/CLV, tableau trié par meanCLV, badge edge |CLV|>1,5 % (#00e676/rouge), badge n<30 = bruit, note méthodologique (CMP v1, devig proportionnel, Skellam handicap, seuils), disclaimer cotes d'ouverture. MAJ COMPONENTS.md (handball-backtest-widget, handball-cmp, handball-skellam, handball-clv).

## 8. handball-strategy-top8.ts
over55/under62 → settle CMP overUnderProb ; handicap → settle Skellam handicapProb ; bestTeam1x2 → forces CMP s_a/s_d au lieu de ppgCareer ; valueBet rejouable (p_model × cote − 1 > 0), AVG_ODDS_* en fallback.

## 9. handball-top8-widget.tsx
Afficher proba CMP Over/Under à côté de la cote + badge edge si |CLV|>1,5 % + leagueCountry via leagueCountry()/COUNTRY_ISO.

## 10. Tests + gates
src/lib/__tests__/handball-cmp.test.ts (Σ=1, Under 2.5 = 59,6 % réf. SportSignals λh=1.4 λe=0.9, convergence fitCMP, ν=1 → Poisson). handball-skellam.test.ts (Σ=1, cohérence manuelle). handball-clv.test.ts (CLV≈0 si cotes=modèle, >0 si modèle meilleur). Gates : tsc --noEmit, eslint, bun run typecheck. data/ déjà gitignoré.

## 11. Commit + deploy
bd claim bead feat(handball):cmp+skellam+clv, commit séparé, scripts\deploy-v2.bat, vérifier VPS_DEPLOY_OK + health + cron PM2.
---
