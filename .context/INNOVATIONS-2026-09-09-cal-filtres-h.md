# Rapport améliorations & innovations — SESSION-2026-09-09-CAL-FILTRES-H
**Suite POPUP-LIVE-FOOT · 2026-09-09 · Fait + proposé par axe**

## 1. Fonctionnel (fait)
- Filtre cumulatif `≤1h→≤24h` (+16h) ; live toujours gardé ; garde-fou `v>0`.
- Code mort `stratMap/fetchTop5` supprimé (−26 lignes).
- Backfill `League.espnSlug` double clé (5 ligues) + script rejouable `--dry-run`.

## 1bis. Fonctionnel (proposé)
- **F1** Presets combinés : `En direct + ≤2h` en 1 clic (imminents + live). Coût S.
- **F2** Persister `calHours`/`calDate` en URL (`?h=2&date=`) — deep-link + retour navigateur. S.
- **F3** Renseigner `League.bzzoiroId` à l'ingestion → backfill voie 1 complet (K1/J1). S.
- **F4** `Match.espnEventId` : purger les résolutions >30j (dotenv cron). XS.
- **F5** Badges top5 revisités : si besoin réel, badge `Top over15` sur `FotmobMatchRow` via jointure normalisée `bsd-<id>` (spec visuelle d'abord). M.

## 2. Graphique (fait)
- Pilule horaire active verte `#00985f`/blanc (pattern "En direct") ; options dropdown `#222`/`#fff`.

## 2bis. Graphique (proposé)
- **G1** Unifier les 3 patterns de barres/pilules (TIME_FILTERS cyan vs FotMob vert) → 1 système. S.
- **G2** Skeleton clair pendant `fetchCal` (actuellement texte "Chargement..."). XS.
- **G3** Migrer `momentum-chart` emerald/sky → FOT (`#1a1a1a`/`#bdbdbd`/`#00985f`) — audit §13. S.
- **G4** Bloc prématch emerald/sky/rose → FOT (§14). S.
- **G5** Contrastes 11px : `#00985f`→`#007a4c` sur blanc, `#717171` en 100% (audit §15). XS.

## 3. Ergonomie (fait)
- Compteur `≤Xh (N)` dans l'option active ; `aria-label` "Matchs dans les X prochaines heures".

## 3bis. Ergonomie (proposé)
- **E1** Segmented control `≤1h|≤2h|≤4h|≤8h|≤16h` remplaçant le `<select>` (1 tap vs 2, visibilité totale). M.
- **E2** Sticky filter-bar au scroll calendrier. XS.
- **E3** `aria-live="polite"` sur le compteur + état vide ("Aucun match dans les 2 prochaines heures"). XS.
- **E4** Cibles tactiles ≥44px (audit QA top10 §I2). XS.
- **E5** Clavier : focus visible vert sur pilule + `Esc` réinitialise le filtre. XS.

## 4. Datas (fait)
- `espnSlug` persisté DB (source de vérité, plus de re-dérivation) ; cache `espnEventId` P2 réutilisé.

## 4bis. Datas (proposé)
- **D1** Monitor `estimated/total` par ligue → prioriser enrichissement (rapport innovations P3). M.
- **D2** Table alias équipes KR/JP en DB (`Team.alias`) vs `TEAM_ALIASES` en dur. S.
- **D3** Blend historique H/A dans le live (`blendWithHistorical` existe côté standings). M.
- **D4** Logger `FunnelSnapshot` + résultat final → calibration seuils (`LIVE_FUNNEL_THRESHOLDS`). M.
- **D5** Compteurs d'échec BSD vs ESPN (aujourd'hui `console.warn` aveugles) pour alerting. S.

## 5. Visibilité (fait)
- Filtre actif impossible à rater (vert plein + compteur) ; inactif neutre "Par heure".

## 5bis. Visibilité (proposé)
- **V1** Chip résumé sous la barre : `📅 12 matchs · ≤2h · 3 live` (toujours visible, même quand select fermé). XS.
- **V2** Badge `LIVE n'` pulsant vert Footmob sur lignes live du calendrier. XS.
- **V3** Dot vert sur icône calendrier quand un filtre horaire actif (rappel hors scroll). XS.
- **V4** Toast 1ère visite : "Astuce : filtrez par heure de coup d'envoi ≤". S (1 fois, localStorage).

## Priorisation
P1 : E1 + V1 + G5 + F2. P2 : F3 + D2 + G3/G4 + E3. P3 : F5 + D1/D4 + V4.
