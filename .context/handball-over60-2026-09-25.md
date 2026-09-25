# Handball — Over points adaptatif (base 60), 1X2 & force des équipes

_Généré le 2026-09-25 16:12 UTC · calendrier scrapé 2026-09-25T14:44:19.864Z_

## 1. Méthode

- **Base points** : 60 → ligne de départ **59.5 (Over 60)** ; si P(Over) ≤ 50 %, on descend de 2 buts : 59.5 → 58.5 → 56.5 → 54.5 → 52.5. Ligne retenue = plus haute ligne avec P(Over) > 50 %.
- **Historique** : 422 matchs terminés sur 8 jours (BetExplorer results + feeds Flashscore J-1..J-7), moyenne observée **60.46 pts/match** (σ = 7.79).
- **ν CMP** : 0.997 — apparillage variance (modèle 60.62 vs observé 60.62).
- **Calibration** : facteur unique k = 0.992 appliqué aux λ → moyenne du calendrier **60.47 pts** (moyenne modèle = 60).
- **λ par équipe** : (attaque + défense adverse)/2, moyenne glissante 10 matchs, shrinkage prior 3 matchs vers la moyenne mondiale 30.2 ; avantage domicile +0.9/−0.45 (convention `handball-strategy-top8.ts`).
- **Moteurs** : CMP (`src/lib/handball-cmp.ts`) pour le total, Skellam (`src/lib/handball-skellam.ts`) pour le 1X2.
- **Fiabilité par match (colonne Suivi)** : ✅ 2 équipes suivies (≥2 matchs) · ⚠️ 1 · ❌ 0 (retombe sur la moyenne mondiale) — 192/522 matchs fiables.
- **Buteurs (section 8)** : P(au moins 2/3/4/5 buts) du meilleur buteur de chaque équipe, retenue si ≥ 55.00000000000001 % — snapshots `hbl_players.json` + `lnh_players.json` (queue de Poisson, λ ajusté au rythme du match).

> Limites : pas de cotes dans le feed (pas d'EV/CLV), forme sur fenêtre courte (8 jours), matchs en cours exclus.

## 2. Synthèse

| Indicateur | Valeur |
| --- | --- |
| Matchs analysés | 522 |
| E(total) moyen du calendrier | 60.47 pts |
| P(Over 59.5) moyenne | 56.6% |
| Ligne retenue = 59.5 (Over 60) | 464 |
| Ligne retenue = 58.5 | 41 |
| Ligne retenue = 56.5 | 16 |
| Ligne retenue = 54.5 | 1 |
| Ligne retenue = 52.5 | 0 |
| Aucune ligne > 50 % | 0 |
| Équipes avec ≥2 matchs d'historique | 137 |
| Matchs avec données buteurs (HBL/StarLigue) | 50 |

## 3. Top Over — lignes hautes

_Classement par ligne retenue puis par probabilité : les matchs qui tiennent encore 59.5 avec >50 % sont en tête._

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10-02 15:00 | **Karpaty Uzhgorod** vs Motor Zaporozhye | Superleague | 66.3 | **59.5** | **81.6%** | 65.4% | 4.4% | 30.2% | ⚠️ |
| 10-02 15:00 | **Khmelnitsky** vs Kharkiv | Superleague | 66.3 | **59.5** | **81.6%** | 65.4% | 4.4% | 30.2% | ⚠️ |
| 09-25 17:00 | **Ademar** vs Morrazo Cangas | Liga ASOBAL | 64.3 | **59.5** | **74.5%** | 54.7% | 4.9% | 40.4% | ✅ |
| 10-02 16:00 | **Maritimo** vs Sporting | Andebol 1 | 64 | **59.5** | **73%** | 41.7% | 4.9% | 53.4% | ✅ |
| 10-02 16:00 | **Ferencvaros** vs Szeged | NB I | 63.6 | **59.5** | **71.3%** | 39.9% | 4.9% | 55.2% | ⚠️ |
| 09-27 15:00 | **Emsdetten** vs Lubeck-Schwartau | 2. Bundesliga | 63.4 | **59.5** | **70.8%** | 57.1% | 4.9% | 38% | ✅ |
| 09-26 17:00 | **Sporting** vs Carvalhos | Andebol 1 | 63.4 | **59.5** | **70.7%** | 76.1% | 3.7% | 20.2% | ⚠️ |
| 09-26 16:00 | **Barcelona** vs Caserio Ciudad Real | Liga ASOBAL | 63.4 | **59.5** | **70.6%** | 66.6% | 4.5% | 29% | ✅ |
| 09-30 16:45 | **Flensburg-H.** vs Granollers | European League | 63.3 | **59.5** | **70.2%** | 58.1% | 4.8% | 37% | ✅ |
| 09-27 15:00 | **Grudziadz** vs SMS Kwidzyn | I Liga | 63.2 | **59.5** | **69.9%** | 59.7% | 4.8% | 35.5% | ❌ |
| 09-26 18:00 | **SC Magdeburg** vs Bietigheim-Metterzimmern | Bundesliga | 63.2 | **59.5** | **69.8%** | 70.3% | 4.2% | 25.5% | ✅ |
| 10-02 17:00 | **Sonderjyske** vs Ringsted | Herre Handbold Ligaen | 63.1 | **59.5** | **69.5%** | 59.7% | 4.8% | 35.5% | ⚠️ |
| 09-26 16:00 | **Kiel** vs Flensburg-H. | Bundesliga | 63.1 | **59.5** | **69.4%** | 57.5% | 4.9% | 37.6% | ✅ |
| 09-29 16:45 | **Karvina** vs Holstebro | European League | 63.1 | **59.5** | **69.1%** | 55.4% | 4.9% | 39.6% | ❌ |
| 10-01 20:30 | **Fram** vs Afturelding | Olis Deildin | 63.1 | **59.5** | **69.1%** | 44.3% | 5% | 50.7% | ❌ |
| 10-02 18:30 | **Caserio Ciudad Real** vs Ademar | Liga ASOBAL | 63 | **59.5** | **69%** | 59.1% | 4.8% | 36.1% | ✅ |
| 09-26 16:00 | **HC Kriens** vs Bern | NLA | 63 | **59.5** | **69%** | 51% | 5% | 44% | ⚠️ |
| 09-30 16:00 | **Besancon** vs Tremblay | Coupe de France | 62.9 | **59.5** | **68.5%** | 56.7% | 4.9% | 38.4% | ⚠️ |
| 09-27 16:00 | **Hamburg** vs HSG Wetzlar | Bundesliga | 62.8 | **59.5** | **67.9%** | 59.1% | 4.8% | 36% | ✅ |
| 09-28 16:30 | **Ribe-Esbjerg** vs GOG | Herre Handbold Ligaen | 62.7 | **59.5** | **67.6%** | 57.7% | 4.9% | 37.4% | ⚠️ |
| 09-25 18:00 | **Chambery Savoie** vs Tremblay | Starligue | 62.7 | **59.5** | **67.5%** | 60% | 4.8% | 35.2% | ✅ |
| 09-28 17:00 | **Fredericia** vs Sonderjyske | Herre Handbold Ligaen | 62.7 | **59.5** | **67.5%** | 56.1% | 4.9% | 39% | ❌ |
| 09-28 16:00 | **Szeged** vs Gyongyosi | NB I | 62.6 | **59.5** | **67.2%** | 58.7% | 4.9% | 36.5% | ⚠️ |
| 09-27 16:00 | **Hagen** vs Ferndorf | 2. Bundesliga | 62.6 | **59.5** | **67.2%** | 56.7% | 4.9% | 38.4% | ⚠️ |
| 09-26 16:00 | **Szigetszentmiklosi** vs Szeged | NB I | 62.6 | **59.5** | **67.2%** | 49.7% | 5% | 45.2% | ⚠️ |
| 09-26 11:00 | **AIFK** vs HIFK | Aktialiiga | 62.6 | **59.5** | **67.2%** | 65.1% | 4.6% | 30.3% | ❌ |
| 10-02 16:30 | **HIFK** vs AIFK | Suomen Cup | 62.6 | **59.5** | **67.2%** | 43% | 5% | 52% | ❌ |
| 09-27 15:00 | **Jeziorak** vs Wejherowo | I Liga | 62.6 | **59.5** | **66.9%** | 60.4% | 4.8% | 34.8% | ❌ |
| 09-26 18:00 | **Tachos (Ned)** vs Arnhem (Ned) | Super Handball League | 62.5 | **59.5** | **66.6%** | 57.3% | 4.9% | 37.8% | ❌ |
| 09-26 18:15 | **Bevo HC (Ned)** vs Izegem (Bel) | Super Handball League | 62.5 | **59.5** | **66.6%** | 57.3% | 4.9% | 37.8% | ❌ |

## 4. Lignes descendues — Over 60 refusé (P(Over 59.5) ≤ 50 %)

_Matchs où il faut descendre d'au moins une ligne (−2 buts) pour retrouver >50 % de réussite._

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-24 14:00 | **Croatia W** vs Montenegro W | Friendly International Women | 55.4 | **54.5** | **56.2%** | 54.5% | 5.3% | 40.2% | ❌ |
| 09-26 15:00 | **Serbia W** vs Montenegro W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 49.2% | 5.3% | 45.5% | ❌ |
| 09-25 13:30 | **Croatia W** vs Serbia W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 59.6% | 5.1% | 35.3% | ❌ |
| 09-25 15:30 | **North Macedonia W** vs Montenegro W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 59.6% | 5.1% | 35.3% | ❌ |
| 09-26 17:00 | **North Macedonia W** vs Croatia W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 59.6% | 5.1% | 35.3% | ❌ |
| 09-27 03:00 | **China W** vs Vietnam W | Asian Games Women | 56.8 | **56.5** | **53%** | 63.4% | 4.9% | 31.7% | ✅ |
| 09-27 14:00 | **HOJ** vs Tonder | 1. Division | 57.3 | **56.5** | **56.1%** | 51.9% | 5.2% | 42.8% | ⚠️ |
| 09-27 08:00 | **Sydney University** vs Los Angeles | Club World Championship - 9th-10th places | 57.4 | **56.5** | **56.3%** | 41.4% | 5.2% | 53.4% | ✅ |
| 09-27 03:00 | **Uzbekistan W** vs Hong Kong W | Asian Games Women | 57.4 | **56.5** | **56.5%** | 48.1% | 5.3% | 46.7% | ✅ |
| 09-26 08:30 | **South Korea W** vs Vietnam W | Asian Games Women | 57.5 | **56.5** | **57.1%** | 89.8% | 2.2% | 8% | ✅ |
| 09-26 17:00 | **Koprivnice** vs Zubri | Extraliga | 57.6 | **56.5** | **57.4%** | 44% | 5.2% | 50.8% | ❌ |
| 09-27 14:00 | **Rzeszow W** vs SMS ZPRP Lublin W | I Liga Women | 57.6 | **56.5** | **57.4%** | 63.3% | 4.9% | 31.9% | ❌ |
| 09-26 07:00 | **Qatar** vs Iran | Asian Games - Play Offs | 57.6 | **56.5** | **57.5%** | 73.1% | 4.2% | 22.7% | ✅ |
| 09-28 16:00 | **Stal Mielec** vs Wisla Plock | Superliga | 57.7 | **56.5** | **57.9%** | 53.7% | 5.2% | 41.1% | ⚠️ |
| 09-30 13:30 | **Dynamo Sungul** vs CSKA Moscow | Superleague | 57.7 | **56.5** | **58%** | 44.8% | 5.3% | 50% | ⚠️ |
| 09-30 17:30 | **Rudar Labin W** vs Zamet W | 1. HRL Women | 57.9 | **56.5** | **58.7%** | 62% | 4.9% | 33.1% | ❌ |
| 09-26 03:30 | **Kazakhstan W** vs Uzbekistan W | Asian Games Women | 57.9 | **56.5** | **59.2%** | 69.4% | 4.5% | 26.1% | ✅ |
| 09-26 06:00 | **China W** vs Hong Kong W | Asian Games Women | 58.2 | **58.5** | **50.2%** | 76.5% | 3.8% | 19.6% | ✅ |
| 10-02 17:30 | **DHG W** vs Hadsten W | 1. Division Women | 58.2 | **58.5** | **50.3%** | 52.4% | 5.2% | 42.4% | ❌ |
| 09-30 16:00 | **Saran** vs Toulouse | Coupe de France | 58.3 | **58.5** | **50.8%** | 57.4% | 5.1% | 37.6% | ✅ |
| 09-26 15:00 | **Hammarby** vs Hallby | Handbollsligan | 58.3 | **58.5** | **50.9%** | 54.4% | 5.2% | 40.5% | ❌ |
| 09-26 16:00 | **Povazska Bystrica** vs SKP Bratislava | Extraliga | 58.3 | **58.5** | **50.9%** | 58.2% | 5% | 36.7% | ❌ |
| 10-01 17:00 | **Aker W** vs Gjovik W | 1. Division Women | 58.3 | **58.5** | **50.9%** | 62% | 4.9% | 33.1% | ❌ |
| 09-25 15:00 | **Buzau** vs Din. Bucuresti | Liga Nationala | 58.4 | **58.5** | **51%** | 56.4% | 5.1% | 38.5% | ⚠️ |
| 10-02 15:00 | **Timisoara** vs Din. Bucuresti | Liga Nationala | 58.4 | **58.5** | **51%** | 56.4% | 5.1% | 38.5% | ⚠️ |
| 10-01 16:00 | **Chekhovskiye Medvedi** vs Krasnodar | Superleague | 58.4 | **58.5** | **51.1%** | 44.9% | 5.2% | 49.8% | ⚠️ |
| 09-26 05:00 | **South Korea** vs China | Asian Games - Play Offs | 58.4 | **58.5** | **51.2%** | 58.9% | 5% | 36.1% | ✅ |
| 09-30 17:00 | **Kjelsas W** vs Volda W | 1. Division Women | 58.5 | **58.5** | **51.6%** | 58.8% | 5% | 36.2% | ❌ |
| 09-27 15:00 | **Pietrowice Wielkie W** vs Zabrze W | I Liga Women | 58.5 | **58.5** | **51.9%** | 53.7% | 5.2% | 41.1% | ❌ |
| 09-27 11:00 | **Jelenia Gora W** vs Kepno W | I Liga Women | 58.5 | **58.5** | **51.9%** | 55% | 5.1% | 39.9% | ❌ |

## 5. Top favoris 1X2

| Date | Match | Favori | P(favori) | Ligne | P(Over ligne) | Suivi |
| --- | --- | --- | --- | --- | --- | --- |
| 09-26 08:30 | South Korea W vs Vietnam W | 1 — South Korea W | **89.8%** | 56.5 | 57.1% | ✅ |
| 09-26 09:00 | Bahrain vs Hong Kong | 1 — Bahrain | **89.1%** | 58.5 | 54.4% | ✅ |
| 09-26 06:00 | China W vs Hong Kong W | 1 — China W | **76.5%** | 58.5 | 50.2% | ✅ |
| 09-26 17:00 | Sporting vs Carvalhos | 1 — Sporting | **76.1%** | 59.5 | 70.7% | ⚠️ |
| 09-27 16:00 | Haslum HK vs Lillestrom | 1 — Haslum HK | **75.2%** | 59.5 | 61.7% | ⚠️ |
| 09-29 10:15 | El Zamalek (Egy) vs Pinheiros (Bra) | 1 — El Zamalek (Egy) | **74.9%** | 59.5 | 65.8% | ❌ |
| 09-29 12:30 | Barcelona (Esp) vs Montada (Mar) | 1 — Barcelona (Esp) | **74.9%** | 59.5 | 65.8% | ❌ |
| 09-26 14:00 | Real Astromal Leszno vs Orlik Brzeg | 1 — Real Astromal Leszno | **73.6%** | 59.5 | 59.5% | ❌ |
| 09-26 15:00 | Nowa Sol vs Oborniki Slaskie | 1 — Nowa Sol | **73.6%** | 59.5 | 59.5% | ❌ |
| 09-26 07:00 | Qatar vs Iran | 1 — Qatar | **73.1%** | 56.5 | 57.5% | ✅ |
| 09-26 18:00 | SC Magdeburg vs Bietigheim-Metterzimmern | 1 — SC Magdeburg | **70.3%** | 59.5 | 69.8% | ✅ |
| 09-26 03:30 | Kazakhstan W vs Uzbekistan W | 1 — Kazakhstan W | **69.4%** | 56.5 | 59.2% | ✅ |
| 09-27 15:00 | Runar vs Viking TIF | 1 — Runar | **69.1%** | 59.5 | 51.7% | ⚠️ |
| 09-27 14:00 | Nordstrand vs Tiller | 1 — Nordstrand | **68.7%** | 59.5 | 62.2% | ❌ |
| 09-30 17:30 | Hypo NO W vs Atzgersdorf W | 1 — Hypo NO W | **68.3%** | 59.5 | 54.4% | ❌ |
| 09-27 14:30 | Baekkelaget vs Kragero IF | 1 — Baekkelaget | **68%** | 59.5 | 65.2% | ❌ |
| 09-30 16:00 | Creteil vs Chartres | 1 — Creteil | **66.6%** | 59.5 | 60.1% | ⚠️ |
| 09-26 16:00 | Barcelona vs Caserio Ciudad Real | 1 — Barcelona | **66.6%** | 59.5 | 70.6% | ✅ |
| 09-29 18:00 | Jomi Salerno W vs HAC Nuoro W | 1 — Jomi Salerno W | **66%** | 59.5 | 53.2% | ❌ |
| 10-02 12:00 | MK Holon vs Hapoel Ashdod | 1 — MK Holon | **66%** | 59.5 | 55.7% | ❌ |
| 10-02 12:00 | Ramat Hasharon vs MK Beer Sheva | 1 — Ramat Hasharon | **66%** | 59.5 | 55.7% | ❌ |
| 09-25 18:30 | Cournon d'Auvergne vs Draguignan Var | 1 — Cournon d'Auvergne | **65.5%** | 59.5 | 52.2% | ❌ |
| 10-02 15:00 | Karpaty Uzhgorod vs Motor Zaporozhye | 1 — Karpaty Uzhgorod | **65.4%** | 59.5 | 81.6% | ⚠️ |
| 10-02 15:00 | Khmelnitsky vs Kharkiv | 1 — Khmelnitsky | **65.4%** | 59.5 | 81.6% | ⚠️ |
| 09-27 15:00 | Suhr Aarau vs Zurich | 1 — Suhr Aarau | **65.1%** | 59.5 | 65.6% | ⚠️ |

## 6. Calendrier complet

### 2026-09-24

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-24 14:00 | **Croatia W** vs Montenegro W | Friendly International Women | 55.4 | **54.5** | **56.2%** | 54.5% | 5.3% | 40.2% | ❌ | ⚪N → ⚪N |
### 2026-09-25

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-25 13:30 | **Croatia W** vs Serbia W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 59.6% | 5.1% | 35.3% | ❌ | ⚪N → ⚪D |
| 09-25 14:30 | **MRHC** vs Meshkov Brest | Division 1 | 61.4 | **59.5** | **61.3%** | 48% | 5.1% | 46.9% | ❌ | — → ⚪V |
| 09-25 14:30 | **Suceava** vs Teutonii Ghimbav | Liga Nationala | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 14:30 | **Astrahanochka W** vs Rostov-Don W | Superleague Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 15:00 | **Buzau** vs Din. Bucuresti | Liga Nationala | 58.4 | **58.5** | **51%** | 56.4% | 5.1% | 38.5% | ⚠️ | — → 🔴DN |
| 09-25 15:00 | **Izhevsk W** vs Adyif W | Superleague Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 15:30 | **Eurofarm Pelister** vs Eurofarm Pelister 2 | Superleague | 60 | **59.5** | **54.1%** | 58.7% | 5% | 36.3% | ❌ | ⚪V → ⚪V |
| 09-25 15:30 | **North Macedonia W** vs Montenegro W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 59.6% | 5.1% | 35.3% | ❌ | ⚪V → ⚪N |
| 09-25 15:30 | **Al Ahly (Egy)** vs Veszprem (Hun) | Club World Championship | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 16:00 | **Ferencvaros** vs Eger | NB I | 61.4 | **59.5** | **61.6%** | 47.3% | 5.1% | 47.6% | ❌ | ⚪D → ⚪D |
| 09-25 16:00 | **Bergsoy** vs Elverum | Elkjop-ligaen | 59.5 | **59.5** | **51.9%** | 47.3% | 5.2% | 47.5% | ❌ | — → ⚪V |
| 09-25 16:00 | **Krasnodar W** vs Dinamo-Sinara W | Superleague Women | 59.9 | **59.5** | **53.8%** | 60.6% | 4.9% | 34.5% | ❌ | — → ⚪D |
| 09-25 16:00 | **Lavovi** vs Crvena zvezda | ARKUS Liga | 60.4 | **59.5** | **56.3%** | 50.5% | 5.1% | 44.4% | ❌ | — → ⚪V |
| 09-25 16:00 | **HK Kosice** vs Presov | Extraliga | 60.1 | **59.5** | **54.6%** | 54.8% | 5.1% | 40.1% | ⚠️ | 🟡DV → — |
| 09-25 16:00 | **Czech Republic W** vs Poland W | Friendly International Women | 61 | **59.5** | **59.2%** | 49.8% | 5.1% | 45% | ❌ | ⚪D → ⚪D |
| 09-25 16:30 | **Bjerringbro/Silkeborg** vs Skive | Herre Handbold Ligaen | 60.6 | **59.5** | **57.6%** | 60.5% | 4.9% | 34.6% | ❌ | ⚪V → — |
| 09-25 17:00 | **Nexe** vs Bjelovar | Premijer liga | 60.9 | **59.5** | **58.8%** | 50.5% | 5.1% | 44.4% | ❌ | ⚪D → — |
| 09-25 17:00 | **Holstebro** vs Kolding | Herre Handbold Ligaen | 62.4 | **59.5** | **66.3%** | 61% | 4.8% | 34.2% | ❌ | ⚪V → ⚪D |
| 09-25 17:00 | **Raekker Molle** vs Lemvig | 1. Division | 60.3 | **59.5** | **55.7%** | 52.4% | 5.1% | 42.5% | ❌ | ⚪D → — |
| 09-25 17:00 | **SMS ZPRP Plock W** vs Handball Warszawa W | Central League Women | 60.9 | **59.5** | **58.8%** | 55.5% | 5% | 39.4% | ❌ | — → ⚪D |
| 09-25 17:00 | **CSM Bucuresti** vs Timisoara | Liga Nationala | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 17:00 | **Zahoraci** vs Modra | Extraliga | 61.9 | **59.5** | **64%** | 49.8% | 5.1% | 45.1% | ❌ | ⚪D → ⚪D |
| 09-25 17:00 | **Ademar** vs Morrazo Cangas | Liga ASOBAL | 64.3 | **59.5** | **74.5%** | 54.7% | 4.9% | 40.4% | ✅ | 🔴DD → 🔴DD |
| 09-25 17:00 | **Aranas** vs Torslanda | Allsvenskan | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 17:30 | **Barnbach/K.** vs Fuchse | HLA | 59.4 | **59.5** | **51.2%** | 55.6% | 5.1% | 39.3% | ❌ | — → ⚪D |
| 09-25 17:30 | **St. Raphael** vs Saran | Starligue | 60 | **59.5** | **54.2%** | 48.8% | 5.2% | 46.1% | ✅ | 🔴DVD → 🟢VVD |
| 09-25 17:30 | **Loznica** vs Partizan | ARKUS Liga | 62.1 | **59.5** | **64.6%** | 58% | 4.9% | 37.1% | ⚠️ | — → 🔴DDV |
| 09-25 17:30 | **Guif** vs Vasteras Irsta HF | Allsvenskan | 59.6 | **59.5** | **52.5%** | 55.6% | 5.1% | 39.3% | ❌ | ⚪V → — |
| 09-25 17:45 | **Ohrid** vs Prilep | Superleague | 61.4 | **59.5** | **61.6%** | 59.8% | 4.9% | 35.3% | ❌ | ⚪V → ⚪N |
| 09-25 17:45 | **Burgan (Kuw)** vs Fuchse Berlin (Ger) | Club World Championship | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 18:00 | **Chambery Savoie** vs Tremblay | Starligue | 62.7 | **59.5** | **67.5%** | 60% | 4.8% | 35.2% | ✅ | 🔴DDV → 🔴DDV |
| 09-25 18:00 | **Chartres** vs Cesson Rennes-Metropole | Starligue | 60.7 | **59.5** | **58%** | 47.5% | 5.1% | 47.4% | ✅ | 🔴DVD → 🔴DDV |
| 09-25 18:00 | **Nimes** vs Dunkerque | Starligue | 60.9 | **59.5** | **58.8%** | 58.5% | 4.9% | 36.6% | ✅ | 🟢VDV → 🔴DDD |
| 09-25 18:00 | **Provence Aix** vs Caen | Starligue | 60.5 | **59.5** | **56.7%** | 55.6% | 5% | 39.4% | ✅ | 🔴VDD → 🟢VVD |
| 09-25 18:00 | **Istres** vs Pontault | Proligue | 59.8 | **59.5** | **53.5%** | 63% | 4.8% | 32.2% | ❌ | ⚪V → ⚪D |
| 09-25 18:00 | **Norway B W** vs Slovenia W | Friendly International Women | 61 | **59.5** | **59.2%** | 58.7% | 4.9% | 36.4% | ❌ | ⚪V → ⚪V |
| 09-25 18:30 | **Selestat** vs Montpellier | Starligue | 60.6 | **59.5** | **57.2%** | 47.3% | 5.1% | 47.6% | ✅ | 🟢DVV → 🟢VVVDD |
| 09-25 18:30 | **Cherbourg** vs Frontignan | Proligue | 60.5 | **59.5** | **56.7%** | 58.7% | 4.9% | 36.4% | ❌ | ⚪V → ⚪D |
| 09-25 18:30 | **Cournon d'Auvergne** vs Draguignan Var | Proligue | 59.6 | **59.5** | **52.2%** | 65.5% | 4.7% | 29.9% | ❌ | ⚪V → ⚪D |
| 09-25 18:30 | **Creteil** vs Sarrebourg | Proligue | 60.5 | **59.5** | **57%** | 57.4% | 5% | 37.6% | ❌ | ⚪V → — |
| 09-25 18:30 | **Pau Billere** vs Massy Essonne | Proligue | 61.6 | **59.5** | **62.5%** | 55.5% | 5% | 39.5% | ❌ | ⚪V → — |
| 09-25 18:30 | **Saintes** vs Besancon | Proligue | 61.3 | **59.5** | **61%** | 51.7% | 5.1% | 43.2% | ❌ | ⚪D → ⚪D |
| 09-25 18:30 | **Val d'Oise** vs Valence | Proligue | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 19:00 | **Vikingur** vs Thor Akureyri | Olis Deildin | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-25 19:30 | **Valur** vs KA | Olis Deildin | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
### 2026-09-26

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-26 03:00 | **Japan** vs Kuwait | Asian Games - Play Offs | 58.7 | **58.5** | **52.7%** | 56.4% | 5.1% | 38.5% | ✅ | 🟢VVD → 🟡VDVD |
| 09-26 03:30 | **Kazakhstan W** vs Uzbekistan W | Asian Games Women | 57.9 | **56.5** | **59.2%** | 69.4% | 4.5% | 26.1% | ✅ | 🔴DDVVD → 🔴DDDV |
| 09-26 05:00 | **South Korea** vs China | Asian Games - Play Offs | 58.4 | **58.5** | **51.2%** | 58.9% | 5% | 36.1% | ✅ | 🟡VNDV → 🔴DDV |
| 09-26 06:00 | **China W** vs Hong Kong W | Asian Games Women | 58.2 | **58.5** | **50.2%** | 76.5% | 3.8% | 19.6% | ✅ | 🟡VVDD → 🔴DVDD |
| 09-26 07:00 | **Qatar** vs Iran | Asian Games - Play Offs | 57.6 | **56.5** | **57.5%** | 73.1% | 4.2% | 22.7% | ✅ | 🟢VVV → 🔴DDNV |
| 09-26 08:30 | **South Korea W** vs Vietnam W | Asian Games Women | 57.5 | **56.5** | **57.1%** | 89.8% | 2.2% | 8% | ✅ | 🟢VVVV → 🔴DDD |
| 09-26 09:00 | **Bahrain** vs Hong Kong | Asian Games - Play Offs | 59 | **58.5** | **54.4%** | 89.1% | 2.3% | 8.6% | ✅ | 🟢VVVV → 🔴DDD |
| 09-26 10:00 | **Orsha** vs Kronon | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 10:00 | **ZPRP Kalisz W** vs Gniezno II W | I Liga Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 10:30 | **Sviesa (Ltu)** vs Cocks (Fin) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 11:00 | **Vilnius (Ltu)** vs Granitas-Karys (Ltu) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 11:00 | **AIFK** vs HIFK | Aktialiiga | 62.6 | **59.5** | **67.2%** | 65.1% | 4.6% | 30.3% | ❌ | ⚪V → — |
| 09-26 11:15 | **Norway W** vs Hungary W | EHF Euro Cup Women - Play Offs | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 12:00 | **BGUFK-SKA** vs SKA Minsk | Division 1 | 61.4 | **59.5** | **61.3%** | 48% | 5.1% | 46.9% | ❌ | ⚪D → — |
| 09-26 12:00 | **Midtjylland** vs Koge | 1. Division | 59 | **58.5** | **54.5%** | 60% | 4.9% | 35% | ❌ | — → ⚪D |
| 09-26 12:00 | **Stoholm** vs Grindsted | 1. Division | 61.4 | **59.5** | **61.3%** | 59.2% | 4.9% | 35.9% | ❌ | — → ⚪D |
| 09-26 12:00 | **Zabrze II** vs Palac Tarnow | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 12:00 | **IFK Ystads** vs Kroppskultur | Allsvenskan | 59.8 | **59.5** | **53.2%** | 60% | 4.9% | 35.1% | ❌ | ⚪V → — |
| 09-26 12:00 | **Redbergslids W** vs Tyreso W | Allsvenskan Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 12:00 | **Besiktas** vs Trabzon | Superlig | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 12:00 | **Giresunspor** vs Mihaliccik | Superlig | 61.8 | **59.5** | **63.1%** | 51.1% | 5.1% | 43.8% | ❌ | ⚪D → — |
| 09-26 12:30 | **Dragunas Klaipeda (Ltu)** vs Mistra (Est) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 12:30 | **HK Ogre/Miandum (Lat)** vs Pieno zvaigzdes (Ltu) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 12:45 | **Aarhus Handbold W** vs Fredericia W | 1. Division Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 13:00 | **Masheka** vs Gomel | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 13:00 | **Ringsted** vs Aalborg | Herre Handbold Ligaen | 62.1 | **59.5** | **64.9%** | 44.6% | 5.1% | 50.4% | ✅ | 🔴DD → 🟢NVVV |
| 09-26 13:00 | **Sydhavsoerne** vs Norddjurs | 1. Division | 61.1 | **59.5** | **60.1%** | 53% | 5.1% | 41.9% | ❌ | ⚪D → — |
| 09-26 13:00 | **GrIFK** vs Dicken | Aktialiiga | 61 | **59.5** | **59.5%** | 51.1% | 5.1% | 43.8% | ❌ | — → ⚪V |
| 09-26 13:00 | **Piotrkowianin Piotrkow** vs MMTS Kwidzyn | Superliga | 60.5 | **59.5** | **57%** | 64.8% | 4.7% | 30.6% | ❌ | — → ⚪D |
| 09-26 13:00 | **Szczecin** vs KPR Zukowo | Central League | 59.8 | **59.5** | **53.2%** | 60% | 4.9% | 35.1% | ❌ | ⚪V → — |
| 09-26 13:00 | **Wagrowiec** vs ZPRP Kielce | Central League | 60.8 | **59.5** | **58.2%** | 54.9% | 5% | 40% | ❌ | — → ⚪D |
| 09-26 13:00 | **SMS ZPRP Plock** vs Bydgoszcz | I Liga | 61.4 | **59.5** | **61.3%** | 55.5% | 5% | 39.5% | ❌ | — → ⚪D |
| 09-26 13:00 | **Wielun** vs Trojka Ostroleka | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 13:00 | **Jutrzenka Plock W** vs Koszalin W | Central League Women | 60.5 | **59.5** | **56.7%** | 58.8% | 4.9% | 36.3% | ⚠️ | — → 🔴DD |
| 09-26 13:00 | **Skovde** vs Karlskrona | Handbollsligan | 60.8 | **59.5** | **58.6%** | 51.7% | 5.1% | 43.2% | ❌ | ⚪D → ⚪D |
| 09-26 13:00 | **Goztepe** vs Spor Toto | Superlig | 60.6 | **59.5** | **57.6%** | 53% | 5.1% | 41.9% | ❌ | — → ⚪V |
| 09-26 13:30 | **Dobrudja** vs HK Levski | A RHG | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 13:30 | **Kungalvs W** vs Tumba W | Allsvenskan Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 14:00 | **Fregata Burgas** vs Osam Lovech | A RHG | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 14:00 | **Spartak Varna** vs Lokomotiv Gorna | A RHG | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 14:00 | **Skanderborg AGF** vs Mors | Herre Handbold Ligaen | 59.7 | **59.5** | **53%** | 40.6% | 5.1% | 54.3% | ✅ | 🔴DND → 🟢VV |
| 09-26 14:00 | **Denmark W** vs Romania W | EHF Euro Cup Women - Play Offs | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 14:00 | **Dessauer** vs Potsdam | 2. Bundesliga | 60.7 | **59.5** | **57.9%** | 43.5% | 5.1% | 51.4% | ❌ | ⚪D → ⚪V |
| 09-26 14:00 | **Kolstad** vs Follo | Elkjop-ligaen | 60.7 | **59.5** | **58%** | 53.5% | 5.1% | 41.4% | ✅ | 🟡DDVV → 🔴DD |
| 09-26 14:00 | **Kristiansand** vs Sandnes | Elkjop-ligaen | 59.2 | **59.5** | **50.3%** | 60% | 4.9% | 35% | ❌ | ⚪V → ⚪D |
| 09-26 14:00 | **Halden** vs Notteroy | 1. Division | 61 | **59.5** | **59.5%** | 64.7% | 4.6% | 30.6% | ❌ | ⚪V → — |
| 09-26 14:00 | **Real Astromal Leszno** vs Orlik Brzeg | I Liga | 61 | **59.5** | **59.5%** | 73.6% | 4% | 22.3% | ❌ | — → ⚪D |
| 09-26 14:00 | **Zgoda Ruda Slaska W** vs Grunwald Ruda Slaska W | I Liga Women | 60 | **59.5** | **54.4%** | 60% | 4.9% | 35.1% | ❌ | ⚪V → — |
| 09-26 14:00 | **ABC Braga** vs Benfica | Andebol 1 | 59.6 | **59.5** | **52%** | 46.4% | 5.2% | 48.4% | ⚠️ | 🟢VV → ⚪V |
| 09-26 14:00 | **Santo Tirso** vs Aguas Santas | Andebol 1 | 59.7 | **59.5** | **52.6%** | 53.3% | 5.1% | 41.6% | ✅ | 🔴DD → 🔴DD |
| 09-26 14:00 | **Cuenca** vs Proin Sevilla | Liga ASOBAL | 60.5 | **59.5** | **56.7%** | 58.3% | 5% | 36.7% | ✅ | 🟡DV → 🔴DD |
| 09-26 14:00 | **Malmo** vs Helsingborg | Handbollsligan | 61.2 | **59.5** | **60.4%** | 51.1% | 5.1% | 43.8% | ❌ | ⚪D → ⚪N |
| 09-26 14:00 | **Istanbul Genclik Spor Kulubu** vs Guneysu | Superlig | 61.6 | **59.5** | **62.2%** | 58% | 4.9% | 37.1% | ❌ | ⚪V → ⚪D |
| 09-26 14:30 | **Bukowsko Dopiewski W** vs Wabrzezno W | I Liga Women | 59 | **58.5** | **54.2%** | 63.7% | 4.8% | 31.5% | ❌ | ⚪V → ⚪D |
| 09-26 14:30 | **Redbergslids** vs Tyreso | Allsvenskan | 58.9 | **58.5** | **53.8%** | 58.2% | 5% | 36.8% | ❌ | ⚪V → — |
| 09-26 15:00 | **Dugo Selo** vs RK Zagreb | Premijer liga | 60.3 | **59.5** | **56%** | 54.5% | 5.1% | 40.4% | ⚠️ | ⚪V → 🟢VDV |
| 09-26 15:00 | **Aarhus Handbold** vs Odder | 1. Division | 60.3 | **59.5** | **55.7%** | 56.2% | 5% | 38.8% | ❌ | ⚪V → — |
| 09-26 15:00 | **Polva Serviti (Est)** vs Tenax Dobele (Lat) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 15:00 | **Viljandi (Est)** vs ASK/MSG (Lat) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 15:00 | **AEK Athens** vs PAOK | A1 | 60.5 | **59.5** | **57%** | 58.7% | 4.9% | 36.4% | ❌ | ⚪V → — |
| 09-26 15:00 | **Aris** vs Olympiacos SFP | A1 | 59.8 | **59.5** | **53.5%** | 46.7% | 5.2% | 48.2% | ❌ | ⚪V → ⚪V |
| 09-26 15:00 | **A.S.E. Douka** vs Zafeirakis | A1 | 60 | **59.5** | **54.4%** | 53.7% | 5.1% | 41.2% | ❌ | ⚪D → — |
| 09-26 15:00 | **Ionikos** vs Diomidis Argous | A1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 15:00 | **Kilkis** vs Athinaikos | A1 | 60.3 | **59.5** | **55.7%** | 62.4% | 4.8% | 32.8% | ❌ | — → ⚪D |
| 09-26 15:00 | **XANTH** vs Drama | A1 | 60.5 | **59.5** | **57%** | 58.7% | 4.9% | 36.4% | ❌ | — → ⚪D |
| 09-26 15:00 | **Csurgoi** vs Gyongyosi | NB I | 59.9 | **59.5** | **53.8%** | 55.6% | 5.1% | 39.4% | ❌ | ⚪V → — |
| 09-26 15:00 | **Haenna** vs Cingoli | Serie A | 59 | **58.5** | **54.4%** | 52.5% | 5.2% | 42.3% | ⚠️ | 🔴DD → ⚪D |
| 09-26 15:00 | **Gwardia Koszalin** vs Grunwald Poznan | Central League | 59.8 | **59.5** | **53.2%** | 48.6% | 5.2% | 46.3% | ❌ | ⚪D → — |
| 09-26 15:00 | **Anilana Lodz** vs Warszawianka | I Liga | 62 | **59.5** | **64.3%** | 63.4% | 4.7% | 31.9% | ❌ | ⚪V → — |
| 09-26 15:00 | **Konskie** vs UW Warszawa | I Liga | 59.4 | **59.5** | **51.2%** | 58.1% | 5% | 36.9% | ❌ | ⚪V → — |
| 09-26 15:00 | **Nowa Sol** vs Oborniki Slaskie | I Liga | 61 | **59.5** | **59.5%** | 73.6% | 4% | 22.3% | ❌ | ⚪V → — |
| 09-26 15:00 | **Olimpia Piekary** vs Zaglebie Sosnowiec | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 15:00 | **Silvant Elblag** vs Mazur Sierpc | I Liga | 61.4 | **59.5** | **61.3%** | 55.5% | 5% | 39.5% | ❌ | ⚪V → — |
| 09-26 15:00 | **SKPR Swidnica** vs Gryfino | I Liga | 60.5 | **59.5** | **57%** | 58.7% | 4.9% | 36.4% | ❌ | — → ⚪D |
| 09-26 15:00 | **Kielce W** vs Legnica W | Central League Women | 58.9 | **58.5** | **53.8%** | 60.7% | 4.9% | 34.4% | ❌ | ⚪V → — |
| 09-26 15:00 | **Bialystok W** vs Agrykola Warszawa W | I Liga Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 15:00 | **CSM Constanta** vs Cluj | Liga Nationala | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 15:00 | **Minaur Baia Mare** vs Potaissa Turda | Liga Nationala | 59.1 | **58.5** | **55.1%** | 53.1% | 5.1% | 41.8% | ❌ | — → ⚪V |
| 09-26 15:00 | **Nava** vs La Rioja | Liga ASOBAL | 61.5 | **59.5** | **61.6%** | 47.2% | 5.1% | 47.7% | ✅ | 🔴DD → 🟡DV |
| 09-26 15:00 | **Amo HK** vs Alingsas | Handbollsligan | 61.1 | **59.5** | **59.8%** | 50.5% | 5.1% | 44.4% | ❌ | ⚪N → ⚪V |
| 09-26 15:00 | **Hammarby** vs Hallby | Handbollsligan | 58.3 | **58.5** | **50.9%** | 54.4% | 5.2% | 40.5% | ❌ | ⚪D → ⚪D |
| 09-26 15:00 | **Serbia W** vs Montenegro W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 49.2% | 5.3% | 45.5% | ❌ | ⚪D → ⚪N |
| 09-26 15:30 | **Zwolen** vs AZS AWF Warszawa | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 15:30 | **Kungalvs HK** vs Tumba | Allsvenskan | 59.2 | **59.5** | **50.3%** | 60% | 4.9% | 35% | ❌ | ⚪V → ⚪D |
| 09-26 15:35 | **Topolcany** vs Hlohovec | Extraliga | 61.9 | **59.5** | **64%** | 43.6% | 5.1% | 51.4% | ❌ | ⚪V → ⚪V |
| 09-26 15:45 | **Bocholt 2** vs Sporting Pelt 2 | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Montegnee** vs Sasja | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Metkovic** vs Osijek | Premijer liga | 59.6 | **59.5** | **52.2%** | 60.6% | 4.9% | 34.5% | ❌ | ⚪V → ⚪D |
| 09-26 16:00 | **Jicin** vs Zlin | Extraliga | 59.3 | **59.5** | **50.6%** | 49.8% | 5.2% | 45% | ❌ | — → ⚪V |
| 09-26 16:00 | **Karvina** vs Brno | Extraliga | 59.6 | **59.5** | **52.2%** | 61.8% | 4.8% | 33.3% | ❌ | ⚪V → ⚪D |
| 09-26 16:00 | **Kiel** vs Flensburg-H. | Bundesliga | 63.1 | **59.5** | **69.4%** | 57.5% | 4.9% | 37.6% | ✅ | 🟢VVVVV → 🟢VVVVV |
| 09-26 16:00 | **Coburg 2000** vs Grosswallstadt | 2. Bundesliga | 60.6 | **59.5** | **57.6%** | 47.9% | 5.1% | 46.9% | ❌ | ⚪D → — |
| 09-26 16:00 | **Hamm-Westfalen** vs Elbflorenz | 2. Bundesliga | 61.6 | **59.5** | **62.6%** | 55.8% | 5% | 39.3% | ⚠️ | — → 🔴DD |
| 09-26 16:00 | **Balatonfuredi** vs Tatabanya | NB I | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Dabas** vs PLER | NB I | 60.5 | **59.5** | **57%** | 57.4% | 5% | 37.6% | ❌ | ⚪V → — |
| 09-26 16:00 | **NEKA** vs Budai Farkasok | NB I | 59.9 | **59.5** | **53.8%** | 55.6% | 5.1% | 39.4% | ❌ | — → ⚪D |
| 09-26 16:00 | **Szigetszentmiklosi** vs Szeged | NB I | 62.6 | **59.5** | **67.2%** | 49.7% | 5% | 45.2% | ⚠️ | — → 🟡VD |
| 09-26 16:00 | **Chiaravalle** vs Sassari | Serie A | 59.6 | **59.5** | **52.1%** | 56.4% | 5.1% | 38.6% | ⚠️ | 🟡DV → — |
| 09-26 16:00 | **Bevo HC 2** vs Dynamico | Eredivisie | 59.8 | **59.5** | **53.5%** | 63% | 4.8% | 32.2% | ❌ | ⚪V → ⚪D |
| 09-26 16:00 | **Struga** vs Butel Skopje | Superleague | 61.7 | **59.5** | **62.8%** | 54.9% | 5% | 40.1% | ❌ | ⚪D → ⚪D |
| 09-26 16:00 | **Chrobry Glogow** vs Wybrzeze Gdansk | Superliga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Bartoszyce** vs Olsztyn | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Komprachcice** vs Wybicki Kielce | I Liga | 60.1 | **59.5** | **55.1%** | 55.6% | 5% | 39.4% | ❌ | ⚪V → — |
| 09-26 16:00 | **Lider Radom** vs Strzalkowo | I Liga | 62 | **59.5** | **64.3%** | 63.4% | 4.7% | 31.9% | ❌ | — → ⚪D |
| 09-26 16:00 | **Morag** vs Czersk | I Liga | 60.3 | **59.5** | **56.1%** | 63% | 4.8% | 32.2% | ❌ | ⚪V → ⚪D |
| 09-26 16:00 | **Oborniki** vs Zielona Gora | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Ruda Slaska** vs Chrzanow | I Liga | 60.1 | **59.5** | **55.1%** | 53% | 5.1% | 41.9% | ❌ | ⚪D → — |
| 09-26 16:00 | **Zawadzkie** vs ZPRP Kielce II | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Slask Wroclaw W** vs Krapkowice W | I Liga Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Povazska Bystrica** vs SKP Bratislava | Extraliga | 58.3 | **58.5** | **50.9%** | 58.2% | 5% | 36.7% | ❌ | ⚪V → ⚪D |
| 09-26 16:00 | **Barcelona** vs Caserio Ciudad Real | Liga ASOBAL | 63.4 | **59.5** | **70.6%** | 66.6% | 4.5% | 29% | ✅ | 🟢VVVVV → 🟡NV |
| 09-26 16:00 | **BM Sinfin** vs Quabit Guadalajara | Division de Honor Plata | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:00 | **Handball Stafa** vs RTV Basel | NLA | 59.2 | **59.5** | **50.3%** | 44.7% | 5.2% | 50.1% | ❌ | ⚪D → ⚪V |
| 09-26 16:00 | **HC Kriens** vs Bern | NLA | 63 | **59.5** | **69%** | 51% | 5% | 44% | ⚠️ | 🔴DDDV → ⚪N |
| 09-26 16:00 | **Pfadi Winterthur** vs Wacker Thun | NLA | 60.7 | **59.5** | **57.9%** | 49.8% | 5.1% | 45% | ❌ | ⚪D → ⚪N |
| 09-26 16:00 | **St. Gallen** vs Kadetten Schaffhausen | NLA | 60.6 | **59.5** | **57.3%** | 46.7% | 5.1% | 48.2% | ❌ | ⚪D → ⚪V |
| 09-26 16:30 | **Mladost 1977** vs Alkaloid | Superleague | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 16:30 | **Antequera** vs Huesca | Division de Honor Plata | 60.1 | **59.5** | **55.1%** | 56.8% | 5% | 38.2% | ❌ | ⚪V → — |
| 09-26 17:00 | **Ferlach** vs Voslauer | HLA | 60.5 | **59.5** | **57%** | 58.7% | 4.9% | 36.4% | ❌ | — → ⚪D |
| 09-26 17:00 | **Krems** vs Alpla Hard | HLA | 59.5 | **59.5** | **51.6%** | 51.1% | 5.2% | 43.7% | ❌ | ⚪V → ⚪V |
| 09-26 17:00 | **Linz** vs HSG Graz | HLA | 60.9 | **59.5** | **58.8%** | 58% | 4.9% | 37% | ❌ | ⚪V → — |
| 09-26 17:00 | **Porec** vs Ardiaei | Premijer liga | 59.8 | **59.5** | **53.2%** | 56.2% | 5% | 38.7% | ❌ | — → ⚪D |
| 09-26 17:00 | **RK Medjimurje** vs Sisak | Premijer liga | 59.8 | **59.5** | **53.2%** | 57.5% | 5% | 37.5% | ❌ | ⚪V → — |
| 09-26 17:00 | **Trogir** vs Sesvete | Premijer liga | 60.8 | **59.5** | **58.2%** | 54.9% | 5% | 40% | ❌ | — → ⚪D |
| 09-26 17:00 | **Koprivnice** vs Zubri | Extraliga | 57.6 | **56.5** | **57.4%** | 44% | 5.2% | 50.8% | ❌ | ⚪D → ⚪V |
| 09-26 17:00 | **Aalsmeer (Ned)** vs Vise (Bel) | Super Handball League | 60.8 | **59.5** | **58.2%** | 57.4% | 5% | 37.6% | ❌ | ⚪V → — |
| 09-26 17:00 | **Hercules (Ned)** vs Hubo Handbal (Bel) | Super Handball League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Limoges** vs PSG | Starligue | 61.1 | **59.5** | **59.7%** | 54.9% | 5% | 40.1% | ✅ | 🟢VDV → 🟢VNVVV |
| 09-26 17:00 | **Fuchse Berlin** vs HBW Balingen-Weilstetten | Bundesliga | 62.1 | **59.5** | **64.7%** | 54.8% | 5% | 40.2% | ✅ | 🟢VVVDV → 🟡VDDDV |
| 09-26 17:00 | **Conversano** vs Cologne | Serie A | 59.2 | **59.5** | **50.2%** | 53.1% | 5.1% | 41.8% | ⚠️ | ⚪D → 🟡VD |
| 09-26 17:00 | **Meran** vs Cassano | Serie A | 61 | **59.5** | **59.2%** | 51.1% | 5.1% | 43.8% | ❌ | ⚪D → ⚪V |
| 09-26 17:00 | **Partizan Tivat** vs Rudar | Prva liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Hellas** vs Houten | Eredivisie | 60.3 | **59.5** | **55.7%** | 56.2% | 5% | 38.8% | ❌ | — → ⚪D |
| 09-26 17:00 | **Vlug en Lenig W** vs Quintus W | Eredivisie Women | 59.1 | **58.5** | **55.1%** | 58.2% | 5% | 36.8% | ❌ | — → ⚪D |
| 09-26 17:00 | **Ciechanow** vs Zaglebie | Central League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Krakow** vs Biala Podlaska | Central League | 61.1 | **59.5** | **59.8%** | 55.5% | 5% | 39.5% | ❌ | ⚪V → ⚪D |
| 09-26 17:00 | **Zamosc** vs Katy Wroclawskie | Central League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Konin** vs Pabianice | I Liga | 59.4 | **59.5** | **51.2%** | 58.1% | 5% | 36.9% | ❌ | — → ⚪D |
| 09-26 17:00 | **Nowe Piekuty** vs UMCS Lublin | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Ol.Grodkow** vs Olawa | I Liga | 60.5 | **59.5** | **57%** | 58.7% | 4.9% | 36.4% | ❌ | ⚪V → — |
| 09-26 17:00 | **Marcovia W** vs Olkusz W | Central League Women | 61.3 | **59.5** | **61%** | 60.5% | 4.8% | 34.7% | ❌ | ⚪V → ⚪D |
| 09-26 17:00 | **Ruch Chorzow II W** vs Kobierzyce II W | I Liga Women | 60 | **59.5** | **54.4%** | 60% | 4.9% | 35.1% | ❌ | — → ⚪D |
| 09-26 17:00 | **Zielona Gora W** vs SMS ZPRP Plock II W | I Liga Women | 60 | **59.5** | **54.4%** | 61.2% | 4.9% | 33.9% | ❌ | ⚪V → — |
| 09-26 17:00 | **Avanca** vs Belenenses | Andebol 1 | 60.6 | **59.5** | **57.6%** | 54.8% | 5% | 40.2% | ⚠️ | 🔴DD → ⚪D |
| 09-26 17:00 | **Sporting** vs Carvalhos | Andebol 1 | 63.4 | **59.5** | **70.7%** | 76.1% | 3.7% | 20.2% | ⚠️ | 🟢VVV → ⚪D |
| 09-26 17:00 | **Jugovic** vs Vojvodina | ARKUS Liga | 60.4 | **59.5** | **56.3%** | 50.5% | 5.1% | 44.4% | ❌ | ⚪D → — |
| 09-26 17:00 | **Radnicki** vs Metaloplastika | ARKUS Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Ajdovscina** vs Jeruzalem Ormoz | 1. NLB Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Ivancna Gorica** vs Slovan | 1. NLB Liga | 61.3 | **59.5** | **60.7%** | 54.9% | 5% | 40.1% | ❌ | — → ⚪D |
| 09-26 17:00 | **Ribnica** vs Krka | 1. NLB Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Skofljica** vs Trimo Trebnje | 1. NLB Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Slovenj Gradec** vs Loka | 1. NLB Liga | 60 | **59.5** | **54.4%** | 56.2% | 5% | 38.8% | ❌ | ⚪V → — |
| 09-26 17:00 | **Puente Genil** vs Torrelavega | Liga ASOBAL | 60.3 | **59.5** | **55.7%** | 43.1% | 5.1% | 51.8% | ✅ | 🟡VD → 🟡DV |
| 09-26 17:00 | **Villa de Aranda** vs CD Bidasoa Irun | Liga ASOBAL | 60.8 | **59.5** | **58.2%** | 44.7% | 5.1% | 50.2% | ✅ | 🔴ND → 🟢VV |
| 09-26 17:00 | **Benidorm** vs Eivissa | Division de Honor Plata | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **Zamora** vs Oviedo | Division de Honor Plata | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:00 | **North Macedonia W** vs Croatia W | Friendly International Women | 56.6 | **56.5** | **52.2%** | 59.6% | 5.1% | 35.3% | ❌ | ⚪V → ⚪N |
| 09-26 17:30 | **Aon Fivers** vs Handball Tirol | HLA | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 17:30 | **Huttenberg** vs Minden | 2. Bundesliga | 60.6 | **59.5** | **57.2%** | 39.7% | 5% | 55.3% | ✅ | 🔴DD → 🟢VV |
| 09-26 17:30 | **Povoa** vs Vitoria SC | Andebol 1 | 61.8 | **59.5** | **63.1%** | 50.6% | 5.1% | 44.3% | ⚠️ | ⚪D → 🟢VV |
| 09-26 17:30 | **Amenabar** vs Barcelona II | Division de Honor Plata | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:00 | **Hurry-Up (Ned)** vs Eupen (Bel) | Super Handball League | 60.1 | **59.5** | **55.1%** | 50.5% | 5.1% | 44.4% | ❌ | ⚪D → — |
| 09-26 18:00 | **Tachos (Ned)** vs Arnhem (Ned) | Super Handball League | 62.5 | **59.5** | **66.6%** | 57.3% | 4.9% | 37.8% | ❌ | — → ⚪D |
| 09-26 18:00 | **Rhein-Neckar** vs MT Melsungen | Bundesliga | 60.1 | **59.5** | **54.7%** | 47.5% | 5.2% | 47.3% | ✅ | 🔴DVVDD → 🟢VVDVV |
| 09-26 18:00 | **SC Magdeburg** vs Bietigheim-Metterzimmern | Bundesliga | 63.2 | **59.5** | **69.8%** | 70.3% | 4.2% | 25.5% | ✅ | 🟢VVVDV → 🔴DDDDD |
| 09-26 18:00 | **Pressano** vs Albatro | Serie A | 58.8 | **58.5** | **53.3%** | 52.3% | 5.2% | 42.5% | ⚠️ | ⚪V → 🟢VV |
| 09-26 18:00 | **Contazara Zaragoza** vs OAR Coruna | Division de Honor Plata | 61.1 | **59.5** | **60.1%** | 56.8% | 5% | 38.2% | ❌ | — → ⚪D |
| 09-26 18:00 | **France W** vs Sweden W | Friendly International Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:15 | **Apollon** vs Hubo Handbal 2 | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:15 | **Kraainem** vs Eynatten-Raeren | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:15 | **Lebbeke** vs Tournai | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:15 | **Bevo HC (Ned)** vs Izegem (Bel) | Super Handball League | 62.5 | **59.5** | **66.6%** | 57.3% | 4.9% | 37.8% | ❌ | ⚪V → — |
| 09-26 18:15 | **Bocholt (Bel)** vs Sprimont (Bel) | Super Handball League | 60.8 | **59.5** | **58.2%** | 57.4% | 5% | 37.6% | ❌ | — → ⚪D |
| 09-26 18:15 | **Diekirch** vs Esch | AXA League | 61 | **59.5** | **59.5%** | 54.9% | 5% | 40.1% | ❌ | — → ⚪D |
| 09-26 18:15 | **Differdange** vs Rumelange | AXA League | 60.8 | **59.5** | **58.6%** | 62.9% | 4.7% | 32.3% | ❌ | ⚪V → ⚪D |
| 09-26 18:15 | **Kaerjeng** vs Dudelange | AXA League | 60.9 | **59.5** | **58.8%** | 59.3% | 4.9% | 35.8% | ❌ | ⚪V → — |
| 09-26 18:15 | **Standard** vs Berchem | AXA League | 60.4 | **59.5** | **56.3%** | 58.1% | 5% | 37% | ❌ | — → ⚪D |
| 09-26 18:15 | **Legionowo** vs Kalisz | Superliga | 60.5 | **59.5** | **57%** | 54.9% | 5% | 40% | ❌ | — → ⚪D |
| 09-26 18:15 | **Anaitasuna** vs Cisne | Division de Honor Plata | 60.8 | **59.5** | **58.6%** | 59.3% | 4.9% | 35.8% | ❌ | ⚪V → ⚪D |
| 09-26 18:30 | **Dijon** vs Ivry | Proligue | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:30 | **Horneo Alicante** vs Granollers | Liga ASOBAL | 61.1 | **59.5** | **59.7%** | 49.2% | 5.1% | 45.7% | ✅ | 🟡VD → 🟢VV |
| 09-26 18:45 | **BFC** vs Artemis | Eredivisie | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:45 | **Quintus** vs Emmen | Eredivisie | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-26 18:50 | **Aalsmeer 2** vs KRAS/Volendam 2 | Eredivisie | 61.1 | **59.5** | **60.1%** | 59.3% | 4.9% | 35.9% | ❌ | ⚪V → — |
| 09-26 18:50 | **DWS** vs PSV Handbal | Eredivisie | 61.1 | **59.5** | **60.1%** | 59.3% | 4.9% | 35.9% | ❌ | — → ⚪D |
### 2026-09-27

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-27 03:00 | **China W** vs Vietnam W | Asian Games Women | 56.8 | **56.5** | **53%** | 63.4% | 4.9% | 31.7% | ✅ | 🟡VVDD → 🔴DDD |
| 09-27 03:00 | **Japan W** vs South Korea W | Asian Games Women | 59.3 | **59.5** | **50.5%** | 43% | 5.2% | 51.8% | ✅ | 🟢VVVV → 🟢VVVV |
| 09-27 03:00 | **Uzbekistan W** vs Hong Kong W | Asian Games Women | 57.4 | **56.5** | **56.5%** | 48.1% | 5.3% | 46.7% | ✅ | 🔴DDDV → 🔴DVDD |
| 09-27 08:00 | **Sydney University** vs Los Angeles | Club World Championship - 9th-10th places | 57.4 | **56.5** | **56.3%** | 41.4% | 5.2% | 53.4% | ✅ | 🔴DD → 🟡DV |
| 09-27 08:30 | **Plzen** vs Nove Veseli | Extraliga | 59.3 | **59.5** | **50.6%** | 56.2% | 5.1% | 38.7% | ❌ | ⚪V → — |
| 09-27 09:00 | **Zaglebie Lubin W** vs Swiebodzice W | I Liga Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 09:30 | **Spain W** vs Germany W | Friendly International Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 10:00 | **Atl. Valladolid** vs Puerto Sagunto | Liga ASOBAL | 60.5 | **59.5** | **56.7%** | 60.3% | 4.9% | 34.8% | ✅ | 🟢VV → 🟡VD |
| 09-27 10:15 | **Montada (Mar)** vs Pinheiros (Bra) | Club World Championship | 62.3 | **59.5** | **65.8%** | 45.5% | 5.1% | 49.5% | ❌ | ⚪D → ⚪D |
| 09-27 11:00 | **Dragunas Klaipeda (Ltu)** vs Cocks (Fin) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 11:00 | **Tapa (Est)** vs Pieno zvaigzdes (Ltu) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 11:00 | **Viljandi (Est)** vs Tenax Dobele (Lat) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 11:00 | **Jelenia Gora W** vs Kepno W | I Liga Women | 58.5 | **58.5** | **51.9%** | 55% | 5.1% | 39.9% | ❌ | ⚪V → — |
| 09-27 11:00 | **UMCS Lublin W** vs AZS AWF Warszawa W | I Liga Women | 59 | **58.5** | **54.5%** | 52.4% | 5.2% | 42.4% | ❌ | ⚪D → — |
| 09-27 11:00 | **Poland W** vs Norway B W | Friendly International Women | 61 | **59.5** | **59.2%** | 48.6% | 5.1% | 46.3% | ❌ | ⚪D → ⚪V |
| 09-27 11:30 | **Sviesa (Ltu)** vs Mistra (Est) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 12:00 | **AGF** vs Vendsyssel | 1. Division | 59.7 | **59.5** | **52.9%** | 48.6% | 5.2% | 46.3% | ❌ | ⚪D → ⚪V |
| 09-27 12:00 | **HK Ogre/Miandum (Lat)** vs Granitas-Karys (Ltu) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 12:00 | **KRAS/Volendam (Ned)** vs Sporting Pelt (Bel) | Super Handball League | 60.1 | **59.5** | **55.1%** | 58.1% | 5% | 36.9% | ❌ | ⚪V → — |
| 09-27 12:30 | **Barcelona (Esp)** vs El Zamalek (Egy) | Club World Championship | 62.3 | **59.5** | **65.8%** | 45.5% | 5.1% | 49.5% | ❌ | ⚪V → ⚪V |
| 09-27 13:00 | **Nordsjaelland** vs Skjern | Herre Handbold Ligaen | 61.8 | **59.5** | **63.6%** | 44.2% | 5.1% | 50.7% | ✅ | 🔴DD → 🟢VV |
| 09-27 13:00 | **Hannover-Burgdorf** vs Goppingen | Bundesliga | 59.6 | **59.5** | **52.5%** | 52.9% | 5.1% | 42% | ✅ | 🟡NVDVD → 🟢DDVVV |
| 09-27 13:00 | **Rotterdam Handbal** vs HV Unitas | Eredivisie | 60 | **59.5** | **54.4%** | 61.2% | 4.9% | 33.9% | ❌ | ⚪V → — |
| 09-27 13:00 | **Ostrow Wielkopolski** vs Kielce | Superliga | 60.8 | **59.5** | **58.5%** | 44.4% | 5.1% | 50.5% | ⚠️ | ⚪V → 🟢VVV |
| 09-27 13:00 | **Legnica** vs Aurum Gorzow | Central League | 60.8 | **59.5** | **58.2%** | 53.7% | 5.1% | 41.3% | ❌ | — → ⚪V |
| 09-27 13:00 | **Gwardia Opole II** vs Viret Zawiercie | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 13:00 | **Przeworsk** vs Ostrowiec Swietokrzyski | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 13:00 | **Koszalin W** vs KS Poznan W | I Liga Women | 60.5 | **59.5** | **56.7%** | 49.7% | 5.1% | 45.1% | ⚠️ | 🔴DD → — |
| 09-27 13:00 | **Lodz W** vs JKS Jaroslaw W | I Liga Women | 59 | **58.5** | **54.5%** | 47.3% | 5.2% | 47.5% | ❌ | — → ⚪V |
| 09-27 13:00 | **Huddinge** vs Lund | Allsvenskan | 59.3 | **59.5** | **50.9%** | 55.6% | 5.1% | 39.3% | ❌ | ⚪D → ⚪D |
| 09-27 13:00 | **Beykoz Bld.** vs Bursa Nilufer Belediyespor | Superlig | 60.5 | **59.5** | **56.7%** | 53.8% | 5.1% | 41.1% | ⚠️ | 🟡VD → — |
| 09-27 13:00 | **Czech Republic W** vs Slovenia W | Friendly International Women | 61 | **59.5** | **59.2%** | 48.6% | 5.1% | 46.3% | ❌ | ⚪D → ⚪V |
| 09-27 13:30 | **EIF** vs SIF | Aktialiiga | 61.2 | **59.5** | **60.6%** | 50.7% | 5.1% | 44.2% | ⚠️ | ⚪V → 🟡DV |
| 09-27 14:00 | **HOJ** vs Tonder | 1. Division | 57.3 | **56.5** | **56.1%** | 51.9% | 5.2% | 42.8% | ⚠️ | 🟡VD → ⚪V |
| 09-27 14:00 | **Polva Serviti (Est)** vs ASK/MSG (Lat) | Baltic League | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 14:00 | **Nordstrand** vs Tiller | 1. Division | 61.6 | **59.5** | **62.2%** | 68.7% | 4.4% | 26.9% | ❌ | ⚪V → ⚪D |
| 09-27 14:00 | **Rzeszow W** vs SMS ZPRP Lublin W | I Liga Women | 57.6 | **56.5** | **57.4%** | 63.3% | 4.9% | 31.9% | ❌ | ⚪V → ⚪D |
| 09-27 14:00 | **Porto** vs Maritimo | Andebol 1 | 62 | **59.5** | **64.2%** | 57.7% | 4.9% | 37.4% | ✅ | 🟢DVV → 🟢VV |
| 09-27 14:00 | **Kristianstad** vs Onnereds | Handbollsligan | 60.9 | **59.5** | **59.1%** | 49.2% | 5.1% | 45.7% | ⚠️ | 🔴DDV → ⚪D |
| 09-27 14:00 | **Alingsas W** vs Karlskrona W | Allsvenskan Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 14:30 | **Dukla Prague** vs Frydek-Mistek | Extraliga | 59.3 | **59.5** | **50.6%** | 56.2% | 5.1% | 38.7% | ❌ | — → ⚪D |
| 09-27 14:30 | **Gummersbach** vs Bergischer | Bundesliga | 60.9 | **59.5** | **58.9%** | 63.2% | 4.7% | 32.1% | ✅ | 🟡VNDVV → 🔴DDDDD |
| 09-27 14:30 | **Baekkelaget** vs Kragero IF | 1. Division | 62.2 | **59.5** | **65.2%** | 68% | 4.4% | 27.6% | ❌ | ⚪V → ⚪D |
| 09-27 14:45 | **Fuchse Berlin (Ger)** vs Veszprem (Hun) | Club World Championship | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 15:00 | **Gorica** vs Karlovac | Premijer liga | 60.6 | **59.5** | **57.3%** | 58.1% | 5% | 37% | ❌ | ⚪V → ⚪D |
| 09-27 15:00 | **Nantes** vs Toulouse | Starligue | 59.8 | **59.5** | **53.3%** | 64.4% | 4.7% | 30.9% | ✅ | 🟢VVVVV → 🔴DDD |
| 09-27 15:00 | **Emsdetten** vs Lubeck-Schwartau | 2. Bundesliga | 63.4 | **59.5** | **70.8%** | 57.1% | 4.9% | 38% | ✅ | 🟢VV → 🟡VD |
| 09-27 15:00 | **Essen** vs N-Lubbecke | 2. Bundesliga | 59.2 | **59.5** | **50.3%** | 53.7% | 5.1% | 41.2% | ❌ | ⚪D → ⚪D |
| 09-27 15:00 | **Leipzig** vs Dormagen | 2. Bundesliga | 61.9 | **59.5** | **63.7%** | 55.5% | 5% | 39.5% | ❌ | ⚪V → — |
| 09-27 15:00 | **Naerbo** vs Fjellhammer | Elkjop-ligaen | 60.2 | **59.5** | **55.6%** | 59.1% | 4.9% | 36% | ⚠️ | ⚪D → 🔴DD |
| 09-27 15:00 | **Runar** vs Viking TIF | Elkjop-ligaen | 59.5 | **59.5** | **51.7%** | 69.1% | 4.4% | 26.5% | ⚠️ | 🟢VV → ⚪D |
| 09-27 15:00 | **Asane** vs Bodo | 1. Division | 59 | **58.5** | **54.5%** | 52.4% | 5.2% | 42.4% | ❌ | — → ⚪V |
| 09-27 15:00 | **Buk** vs Swiebodzin | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 15:00 | **Grudziadz** vs SMS Kwidzyn | I Liga | 63.2 | **59.5** | **69.9%** | 59.7% | 4.8% | 35.5% | ❌ | ⚪V → — |
| 09-27 15:00 | **Jeziorak** vs Wejherowo | I Liga | 62.6 | **59.5** | **66.9%** | 60.4% | 4.8% | 34.8% | ❌ | ⚪V → ⚪D |
| 09-27 15:00 | **Sambor Tczew** vs Wybrzeze Gdansk II | I Liga | 61 | **59.5** | **59.5%** | 62.3% | 4.8% | 32.9% | ❌ | — → ⚪D |
| 09-27 15:00 | **AZS Poznan W** vs Sambor Tczew W | Central League Women | 60.9 | **59.5** | **58.8%** | 55.5% | 5% | 39.4% | ❌ | ⚪V → — |
| 09-27 15:00 | **Zory W** vs Pogon Szczecin W | Central League Women | 58.7 | **58.5** | **52.9%** | 63.8% | 4.8% | 31.4% | ❌ | ⚪V → ⚪D |
| 09-27 15:00 | **Pietrowice Wielkie W** vs Zabrze W | I Liga Women | 58.5 | **58.5** | **51.9%** | 53.7% | 5.2% | 41.1% | ❌ | ⚪D → — |
| 09-27 15:00 | **Suhr Aarau** vs Zurich | NLA | 62.3 | **59.5** | **65.6%** | 65.1% | 4.6% | 30.3% | ⚠️ | ⚪V → 🔴DD |
| 09-27 15:30 | **Molteno** vs Fasano | Serie A | 59.7 | **59.5** | **52.8%** | 50.5% | 5.2% | 44.4% | ⚠️ | 🔴DD → ⚪V |
| 09-27 15:30 | **Nove Zamky** vs Bojnice | Extraliga | 61.1 | **59.5** | **60.1%** | 61.7% | 4.8% | 33.5% | ❌ | ⚪V → — |
| 09-27 15:30 | **Celje** vs Gorenje | 1. NLB Liga | 60.6 | **59.5** | **57.6%** | 51.5% | 5.1% | 43.4% | ⚠️ | 🔴DDV → ⚪D |
| 09-27 16:00 | **Chardafon Gabrovo** vs Shumen | A RHG | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 16:00 | **Hamburg** vs HSG Wetzlar | Bundesliga | 62.8 | **59.5** | **67.9%** | 59.1% | 4.8% | 36% | ✅ | 🔴NDDDV → 🔴DNDDD |
| 09-27 16:00 | **Hagen** vs Ferndorf | 2. Bundesliga | 62.6 | **59.5** | **67.2%** | 56.7% | 4.9% | 38.4% | ⚠️ | 🟡DV → — |
| 09-27 16:00 | **Gyor** vs Ferencvaros | NB I | 61.4 | **59.5** | **61.3%** | 64.1% | 4.7% | 31.3% | ❌ | — → ⚪D |
| 09-27 16:00 | **Leno W** vs Mestrino W | Serie A Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 16:00 | **Tikvesh** vs Vardar 1961 | Superleague | 62 | **59.5** | **64.2%** | 48.9% | 5.1% | 46% | ✅ | 🟡VN → 🔴DDV |
| 09-27 16:00 | **Drammen** vs Arendal | Elkjop-ligaen | 60 | **59.5** | **54.2%** | 61.8% | 4.8% | 33.4% | ✅ | 🟢VV → 🔴DD |
| 09-27 16:00 | **Charlottenlund** vs Ryger Stavanger | 1. Division | 59 | **58.5** | **54.5%** | 52.4% | 5.2% | 42.4% | ❌ | ⚪D → — |
| 09-27 16:00 | **Haslum HK** vs Lillestrom | 1. Division | 61.5 | **59.5** | **61.7%** | 75.2% | 3.9% | 20.9% | ⚠️ | ⚪V → 🔴DD |
| 09-27 16:00 | **Melhus** vs Varhaug | 1. Division | 61.3 | **59.5** | **60.7%** | 58.6% | 4.9% | 36.5% | ❌ | — → ⚪D |
| 09-27 16:00 | **Slask Wroclaw** vs Gwardia Opole | Superliga | 59.8 | **59.5** | **53.2%** | 53.7% | 5.1% | 41.2% | ❌ | — → ⚪V |
| 09-27 16:30 | **Bregenz** vs Atzgersdorf | HLA | 60.9 | **59.5** | **58.8%** | 58% | 4.9% | 37% | ❌ | — → ⚪D |
| 09-27 16:30 | **Rudar** vs Vinkovci | Premijer liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 16:30 | **Zeleznicar Jug** vs Samot | ARKUS Liga | 60.3 | **59.5** | **55.7%** | 53.7% | 5.1% | 41.2% | ❌ | ⚪D → — |
| 09-27 17:00 | **Kumanovo** vs Multi Esens | Superleague | 60.3 | **59.5** | **55.7%** | 54.9% | 5.1% | 40% | ❌ | — → ⚪D |
| 09-27 17:00 | **Bergen** vs Sandefjord TIF | Elkjop-ligaen | 62 | **59.5** | **64.1%** | 55.1% | 5% | 39.9% | ⚠️ | 🟢VV → ⚪V |
| 09-27 17:00 | **Al Ahly (Egy)** vs Burgan (Kuw) | Club World Championship | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 17:30 | **Budvanska** vs Berane | Prva liga | 61.8 | **59.5** | **63.1%** | 43.6% | 5.1% | 51.4% | ❌ | ⚪D → — |
| 09-27 18:00 | **Jedinstvo** vs Buducnost | Prva liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-27 18:00 | **Sutjeska Niksic** vs Mornar | Prva liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
### 2026-09-28

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-28 15:00 | **Zubri W** vs Zlin W | Czech Cup Women | 59.6 | **59.5** | **52.5%** | 59.4% | 4.9% | 35.7% | ❌ | — → ⚪D |
| 09-28 16:00 | **Szeged** vs Gyongyosi | NB I | 62.6 | **59.5** | **67.2%** | 58.7% | 4.9% | 36.5% | ⚠️ | 🟡VD → — |
| 09-28 16:00 | **Lovcen** vs Brskovo | Prva liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-28 16:00 | **Stal Mielec** vs Wisla Plock | Superliga | 57.7 | **56.5** | **57.9%** | 53.7% | 5.2% | 41.1% | ⚠️ | ⚪D → 🟡DV |
| 09-28 16:00 | **Pancevo** vs Dubocica | ARKUS Liga | 60.7 | **59.5** | **57.9%** | 49.8% | 5.1% | 45% | ❌ | ⚪D → ⚪V |
| 09-28 16:30 | **Ribe-Esbjerg** vs GOG | Herre Handbold Ligaen | 62.7 | **59.5** | **67.6%** | 57.7% | 4.9% | 37.4% | ⚠️ | ⚪D → 🔴DVD |
| 09-28 17:00 | **Fredericia** vs Sonderjyske | Herre Handbold Ligaen | 62.7 | **59.5** | **67.5%** | 56.1% | 4.9% | 39% | ❌ | ⚪V → ⚪V |
| 09-28 17:00 | **Drott** vs Varberg | Allsvenskan | 58.9 | **58.5** | **53.8%** | 50.5% | 5.2% | 44.3% | ❌ | ⚪D → — |
| 09-28 17:30 | **Erlangen** vs Eisenach | Bundesliga | 60.7 | **59.5** | **58.1%** | 57.4% | 5% | 37.7% | ✅ | 🟡NDVVV → 🔴DNVDD |
| 09-28 18:00 | **Lugi** vs Skanela | Handbollsligan | 59.3 | **59.5** | **50.9%** | 51.8% | 5.2% | 43.1% | ❌ | ⚪V → ⚪V |
### 2026-09-29

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-29 10:15 | **El Zamalek (Egy)** vs Pinheiros (Bra) | Club World Championship | 62.3 | **59.5** | **65.8%** | 74.9% | 3.9% | 21.2% | ❌ | ⚪V → ⚪D |
| 09-29 12:30 | **Barcelona (Esp)** vs Montada (Mar) | Club World Championship | 62.3 | **59.5** | **65.8%** | 74.9% | 3.9% | 21.2% | ❌ | ⚪V → ⚪D |
| 09-29 14:45 | **Veszprem (Hun)** vs Burgan (Kuw) | Club World Championship | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-29 15:00 | **Togliatti W** vs Chernomorochka W | Superleague Women | 58.5 | **58.5** | **51.9%** | 46.7% | 5.2% | 48% | ⚠️ | ⚪V → 🟢VV |
| 09-29 16:00 | **Podravka W** vs Sinj W | 1. HRL Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-29 16:00 | **Budakalasz** vs Balatonfuredi | Hungarian Cup | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-29 16:00 | **Cegledi** vs Eger | Hungarian Cup | 60.5 | **59.5** | **57%** | 57.4% | 5% | 37.6% | ❌ | — → ⚪D |
| 09-29 16:00 | **DEAC** vs Vecses | Hungarian Cup | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-29 16:00 | **Krasnodar W** vs Izhevsk W | Superleague Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-29 16:30 | **Varpalotai** vs Budai Farkasok | Hungarian Cup | 59.9 | **59.5** | **53.8%** | 55.6% | 5.1% | 39.4% | ❌ | — → ⚪D |
| 09-29 16:30 | **Maccabi Le Zion** vs Bnei Herzliya | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-29 16:30 | **CSKA Moscow W** vs Zvenigorod W | Superleague Women | 59.7 | **59.5** | **52.6%** | 52.5% | 5.1% | 42.3% | ⚠️ | ⚪V → 🟡VD |
| 09-29 16:45 | **Buzau** vs Aguas Santas | European League | 60.2 | **59.5** | **55.2%** | 57.3% | 5% | 37.7% | ⚠️ | — → 🔴DD |
| 09-29 16:45 | **Gummersbach** vs Wybrzeze Gdansk | European League | 61.3 | **59.5** | **61.1%** | 57.3% | 5% | 37.7% | ⚠️ | 🟡VNDVV → — |
| 09-29 16:45 | **Izvidac** vs Chambery Savoie | European League | 61.4 | **59.5** | **61.4%** | 52.2% | 5.1% | 42.8% | ⚠️ | — → 🔴DDV |
| 09-29 16:45 | **Karvina** vs Holstebro | European League | 63.1 | **59.5** | **69.1%** | 55.4% | 4.9% | 39.6% | ❌ | ⚪V → ⚪V |
| 09-29 16:45 | **Savehof** vs Sesvete | European League | 60.7 | **59.5** | **57.8%** | 58.9% | 4.9% | 36.2% | ⚠️ | 🟢VV → ⚪D |
| 09-29 17:00 | **Fuchse Berlin (Ger)** vs Al Ahly (Egy) | Club World Championship | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-29 17:30 | **Bjelovar W** vs Split 2010 W | 1. HRL Women | 58.6 | **58.5** | **52.2%** | 60.7% | 4.9% | 34.4% | ❌ | ⚪V → ⚪D |
| 09-29 17:30 | **Kreuzlingen** vs Amicitia Zurich 2 | Schweizer Cup | 61 | **59.5** | **59.5%** | 47.3% | 5.1% | 47.6% | ❌ | — → ⚪V |
| 09-29 18:00 | **Skive** vs Skanderborg AGF | Danish Cup | 60.3 | **59.5** | **56.1%** | 64.2% | 4.7% | 31.1% | ⚠️ | — → 🔴DND |
| 09-29 18:00 | **Jomi Salerno W** vs HAC Nuoro W | Serie A Women | 59.8 | **59.5** | **53.2%** | 66% | 4.6% | 29.3% | ❌ | ⚪V → — |
| 09-29 18:00 | **Kwiek W** vs M.H.V. 81 W | Eredivisie Women | 61.8 | **59.5** | **63.1%** | 57.4% | 4.9% | 37.7% | ❌ | ⚪V → — |
| 09-29 18:45 | **Benfica** vs Torrelavega | European League | 59.4 | **59.5** | **51%** | 60.1% | 4.9% | 34.9% | ⚠️ | ⚪V → 🟡DV |
| 09-29 18:45 | **Elverum** vs Hammarby | European League | 58.8 | **58.5** | **53.5%** | 61.9% | 4.9% | 33.2% | ❌ | ⚪V → ⚪D |
| 09-29 18:45 | **Nexe** vs St. Raphael | European League | 61.1 | **59.5** | **59.9%** | 54.7% | 5% | 40.3% | ⚠️ | ⚪D → 🔴DVD |
| 09-29 18:45 | **Valur** vs Mors | European League | 59.9 | **59.5** | **53.6%** | 50.7% | 5.1% | 44.1% | ⚠️ | — → 🟢VV |
| 09-29 19:00 | **Lanzarote Zonzamas W** vs Guardes W | Division de Honor Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
### 2026-09-30

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-30 12:00 | **Giresunspor** vs Goztepe | Superlig | 61.8 | **59.5** | **63.1%** | 51.1% | 5.1% | 43.8% | ❌ | ⚪D → — |
| 09-30 13:00 | **Spor Toto** vs Istanbul Genclik Spor Kulubu | Superlig | 61.9 | **59.5** | **64%** | 52.4% | 5% | 42.6% | ❌ | ⚪V → ⚪V |
| 09-30 13:30 | **Dynamo Sungul** vs CSKA Moscow | Superleague | 57.7 | **56.5** | **58%** | 44.8% | 5.3% | 50% | ⚠️ | 🔴DD → ⚪V |
| 09-30 14:00 | **Ramnicu Valcea W** vs SCM Craiova W | Liga Nationala Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 15:00 | **Bohunice W** vs HK Hodonin W | Czech Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 15:00 | **Athinaikos** vs Ionikos | A1 | 60.3 | **59.5** | **55.7%** | 46% | 5.1% | 48.8% | ❌ | ⚪D → — |
| 09-30 15:00 | **Diomidis Argous** vs AEK Athens | A1 | 60.5 | **59.5** | **57%** | 49.8% | 5.1% | 45% | ❌ | — → ⚪V |
| 09-30 15:00 | **Drama** vs A.S.E. Douka | A1 | 60.1 | **59.5** | **54.8%** | 50.5% | 5.1% | 44.4% | ❌ | ⚪D → ⚪D |
| 09-30 15:00 | **Olympiacos SFP** vs Kilkis | A1 | 60.3 | **59.5** | **55.7%** | 62.4% | 4.8% | 32.8% | ❌ | ⚪V → — |
| 09-30 15:00 | **PAOK** vs XANTH | A1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 15:00 | **Zafeirakis** vs Aris | A1 | 60 | **59.5** | **54.4%** | 53.7% | 5.1% | 41.2% | ❌ | — → ⚪V |
| 09-30 15:00 | **Varhaug** vs Charlottenlund | 1. Division | 59.8 | **59.5** | **53.5%** | 51.8% | 5.1% | 43.1% | ❌ | ⚪D → ⚪D |
| 09-30 15:00 | **Zalau W** vs Bistrita W | Liga Nationala Women | 59.9 | **59.5** | **53.8%** | 53% | 5.1% | 41.8% | ❌ | — → ⚪V |
| 09-30 15:00 | **Zilant Kazan** vs Kaustik | Superleague | 61.2 | **59.5** | **60.4%** | 56.1% | 5% | 38.9% | ❌ | ⚪D → ⚪D |
| 09-30 15:30 | **Cocks** vs BK-46 | Aktialiiga | 60 | **59.5** | **54.4%** | 43.5% | 5.1% | 51.4% | ❌ | — → ⚪V |
| 09-30 15:30 | **Atlas 2 W** vs GRIFK W | Suomen Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 15:30 | **Stavanger W** vs Storhamar 2 W | 1. Division Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 15:30 | **Dinamo-Sinara W** vs Alisa Ufa W | Superleague Women | 59.2 | **59.5** | **50.2%** | 57.1% | 5% | 37.8% | ⚠️ | ⚪D → 🔴DD |
| 09-30 15:45 | **AIFK W** vs Dicken W | Suomen Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Dalmatinka W** vs Zrinski W | 1. HRL Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Ivanic W** vs Marina Kastela W | 1. HRL Women | 59 | **58.5** | **54.5%** | 60% | 4.9% | 35% | ❌ | ⚪V → — |
| 09-30 16:00 | **Plzen W** vs Pisek W | Czech Cup Women | 59.6 | **59.5** | **52.5%** | 46.6% | 5.2% | 48.2% | ❌ | ⚪D → — |
| 09-30 16:00 | **Besancon** vs Tremblay | Coupe de France | 62.9 | **59.5** | **68.5%** | 56.7% | 4.9% | 38.4% | ⚠️ | ⚪D → 🔴DDV |
| 09-30 16:00 | **Creteil** vs Chartres | Coupe de France | 61.1 | **59.5** | **60.1%** | 66.6% | 4.5% | 28.8% | ⚠️ | ⚪V → 🔴DVD |
| 09-30 16:00 | **Pau Billere** vs Istres | Coupe de France | 61.1 | **59.5** | **59.8%** | 47.9% | 5.1% | 46.9% | ❌ | ⚪V → ⚪V |
| 09-30 16:00 | **Pontault** vs Cesson Rennes-Metropole | Coupe de France | 60 | **59.5** | **54.5%** | 56% | 5% | 39% | ⚠️ | ⚪D → 🔴DDV |
| 09-30 16:00 | **Saran** vs Toulouse | Coupe de France | 58.3 | **58.5** | **50.8%** | 57.4% | 5.1% | 37.6% | ✅ | 🟢VVD → 🔴DDD |
| 09-30 16:00 | **Sarrebourg** vs Nimes | Coupe de France | 62 | **59.5** | **64.2%** | 55.1% | 5% | 39.9% | ⚠️ | — → 🟢VDV |
| 09-30 16:00 | **Valence** vs Dunkerque | Coupe de France | 59.3 | **59.5** | **50.9%** | 59.4% | 5% | 35.6% | ⚠️ | — → 🔴DDD |
| 09-30 16:00 | **Gyor** vs Ferencvaros | Hungarian Cup | 61.4 | **59.5** | **61.3%** | 64.1% | 4.7% | 31.3% | ❌ | — → ⚪D |
| 09-30 16:00 | **Komloi** vs Csurgoi | Hungarian Cup | 59.9 | **59.5** | **53.8%** | 53% | 5.1% | 41.8% | ❌ | — → ⚪V |
| 09-30 16:00 | **Oroshazi** vs Dabas | Hungarian Cup | 60.5 | **59.5** | **57%** | 51.1% | 5.1% | 43.8% | ❌ | — → ⚪V |
| 09-30 16:00 | **Budaors W** vs Vaci W | NB I Women | 61.6 | **59.5** | **62.5%** | 56.7% | 5% | 38.3% | ❌ | — → ⚪D |
| 09-30 16:00 | **Kisvardai KC W** vs Ferencvaros W | NB I Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Mosonmagyarovar W** vs Gyor W | NB I Women | 59.1 | **58.5** | **55.1%** | 47.9% | 5.2% | 46.9% | ❌ | — → ⚪V |
| 09-30 16:00 | **Gjerpen W** vs Fredrikstad W | Elkjop-ligaen Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Molde W** vs Utleira W | Elkjop-ligaen Women | 60.4 | **59.5** | **56.3%** | 61.8% | 4.8% | 33.4% | ❌ | — → ⚪D |
| 09-30 16:00 | **Sola W** vs Follo W | Elkjop-ligaen Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Kielce** vs Slask Wroclaw | Superliga | 60.7 | **59.5** | **58.1%** | 64.5% | 4.7% | 30.8% | ⚠️ | 🟢VVV → — |
| 09-30 16:00 | **Sambor Tczew W** vs SMS ZPRP Plock W | Central League Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Stavropol** vs UOR No.2 Moscow | Superleague | 59.7 | **59.5** | **52.7%** | 42.5% | 5.1% | 52.4% | ⚠️ | 🔴DD → ⚪V |
| 09-30 16:00 | **Adyif W** vs Astrahanochka W | Superleague Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Rostov-Don W** vs Luch W | Superleague Women | 59.6 | **59.5** | **52.5%** | 58.1% | 5% | 36.9% | ❌ | — → ⚪D |
| 09-30 16:00 | **Radnicki W** vs ZRK Temerin W | ARKUS Liga Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:00 | **Presov W** vs Michalovce W | Slovakia Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:15 | **Larvik W** vs Storhamar W | Elkjop-ligaen Women | 60.7 | **59.5** | **57.9%** | 63.6% | 4.7% | 31.7% | ❌ | ⚪V → ⚪D |
| 09-30 16:30 | **Jindrichuv Hradec W** vs Most W | Czech Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:30 | **Sokol Vrsovice W** vs Lazne Kynzvart W | Czech Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:30 | **NFH W** vs Nordvestjysk W | Kvindeligaen Women | 60 | **59.5** | **54.4%** | 57.5% | 5% | 37.5% | ❌ | ⚪V → — |
| 09-30 16:30 | **GRIFK 2 W** vs HIFK W | Suomen Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:30 | **Csomor** vs Ozdi | Hungarian Cup | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:30 | **Szigetszentmiklosi** vs NEKA | Hungarian Cup | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:30 | **Tertnes W** vs Byasen W | Elkjop-ligaen Women | 61.9 | **59.5** | **64%** | 64.6% | 4.6% | 30.8% | ❌ | ⚪V → ⚪D |
| 09-30 16:30 | **Nis W** vs Vojvodina W | ARKUS Liga Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:30 | **Hallby W** vs H 65 Hoor W | Handbollsligan Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:45 | **Bohumin W** vs Poruba W | Czech Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 16:45 | **Flensburg-H.** vs Granollers | European League | 63.3 | **59.5** | **70.2%** | 58.1% | 4.8% | 37% | ✅ | 🟢VVVVV → 🟢VV |
| 09-30 16:45 | **Kadetten Schaffhausen** vs CSM Bucuresti | European League | 60.8 | **59.5** | **58.2%** | 58.7% | 4.9% | 36.4% | ❌ | ⚪V → — |
| 09-30 16:45 | **Tatabanya** vs Slovan | European League | 61.3 | **59.5** | **60.7%** | 54.9% | 5% | 40.1% | ❌ | — → ⚪D |
| 09-30 16:45 | **HIFK 2 W** vs BK-46 W | Suomen Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:00 | **Horsens W** vs EH Aalborg W | Kvindeligaen Women | 59.6 | **59.5** | **52.2%** | 60.6% | 4.9% | 34.5% | ❌ | ⚪V → ⚪D |
| 09-30 17:00 | **Ringkobing W** vs Viborg W | Kvindeligaen Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:00 | **SC Magdeburg** vs Kiel | Bundesliga | 62.3 | **59.5** | **65.8%** | 54.1% | 5% | 40.9% | ✅ | 🟢VVVDV → 🟢VVVVV |
| 09-30 17:00 | **Thuringer W** vs Blomberg-Lippe W | DHB Pokal Women | 61 | **59.5** | **59.2%** | 58.7% | 4.9% | 36.4% | ❌ | ⚪V → ⚪D |
| 09-30 17:00 | **Albatro** vs Sassari | Serie A | 58.9 | **58.5** | **53.6%** | 58.9% | 5% | 36.1% | ⚠️ | 🟢VV → — |
| 09-30 17:00 | **ASK/MSG II** vs Jurmala II | Virsliga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:00 | **Kjelsas W** vs Volda W | 1. Division Women | 58.5 | **58.5** | **51.6%** | 58.8% | 5% | 36.2% | ❌ | ⚪V → ⚪D |
| 09-30 17:00 | **Koper W** vs Krim W | 1. SRL Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:00 | **Savehof W** vs Boden W | Handbollsligan Women | 60.8 | **59.5** | **58.2%** | 52.4% | 5.1% | 42.5% | ❌ | ⚪D → — |
| 09-30 17:00 | **Skara W** vs Helsingborg W | Handbollsligan Women | 60.8 | **59.5** | **58.2%** | 56.2% | 5% | 38.8% | ❌ | ⚪V → — |
| 09-30 17:00 | **Ystads W** vs Vasteras W | Handbollsligan Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:00 | **Aranas W** vs Kroppskultur Dam W | Allsvenskan Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:30 | **Hypo NO W** vs Atzgersdorf W | WHA Women | 60 | **59.5** | **54.4%** | 68.3% | 4.5% | 27.2% | ❌ | ⚪V → — |
| 09-30 17:30 | **Rudar Labin W** vs Zamet W | 1. HRL Women | 57.9 | **56.5** | **58.7%** | 62% | 4.9% | 33.1% | ❌ | ⚪V → ⚪D |
| 09-30 17:30 | **Ludwigshafen** vs Nordhorn-Lingen | 2. Bundesliga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:30 | **BVB Dortmund W** vs Halle-Neustadt W | DHB Pokal Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:30 | **Solingen W** vs Metzingen W | DHB Pokal Women | 61.4 | **59.5** | **61.3%** | 55.5% | 5% | 39.5% | ❌ | — → ⚪D |
| 09-30 17:30 | **Rakosmente** vs Gyongyosi | Hungarian Cup | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 17:30 | **Trieste** vs Meran | Serie A | 60.8 | **59.5** | **58.2%** | 54.9% | 5% | 40% | ❌ | — → ⚪D |
| 09-30 17:30 | **Handball Warszawa W** vs Kielce W | Central League Women | 59.3 | **59.5** | **50.9%** | 46.6% | 5.2% | 48.2% | ❌ | ⚪D → ⚪V |
| 09-30 17:30 | **Rotweiss Thun W** vs Zug W | SPL Women | 58.8 | **58.5** | **53.2%** | 49.8% | 5.2% | 45% | ❌ | ⚪D → — |
| 09-30 18:00 | **Osijek W** vs Koka W | 1. HRL Women | 59.8 | **59.5** | **53.2%** | 58.7% | 5% | 36.3% | ❌ | — → ⚪D |
| 09-30 18:00 | **Virovitica W** vs Lok. Zagreb W | 1. HRL Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 09-30 18:00 | **Odense W** vs Esbjerg W | Kvindeligaen Women | 59.9 | **59.5** | **53.8%** | 53% | 5.1% | 41.8% | ❌ | ⚪D → — |
| 09-30 18:00 | **Winterthur W** vs Amicitia Zurich W | SPL Women | 60.5 | **59.5** | **57%** | 63.6% | 4.7% | 31.7% | ❌ | ⚪V → — |
| 09-30 18:15 | **Naerbo** vs Kolstad | Elkjop-ligaen | 62.5 | **59.5** | **66.6%** | 59.7% | 4.8% | 35.5% | ⚠️ | ⚪D → 🟡DDVV |
| 09-30 18:45 | **CD Bidasoa Irun** vs FH Hafnarfjordur | European League | 61.9 | **59.5** | **63.8%** | 60.3% | 4.8% | 34.9% | ⚠️ | 🟢VV → ⚪D |
| 09-30 18:45 | **Eurofarm Pelister** vs La Rioja | European League | 62 | **59.5** | **64.4%** | 64% | 4.6% | 31.4% | ⚠️ | ⚪V → 🟡DV |
| 09-30 18:45 | **Limoges** vs Maritimo | European League | 61.8 | **59.5** | **63.5%** | 60.2% | 4.8% | 35% | ✅ | 🟢VDV → 🟢VV |
| 09-30 18:45 | **Presov** vs Bergischer | European League | 60 | **59.5** | **54.3%** | 60.3% | 4.9% | 34.8% | ⚠️ | — → 🔴DDDDD |
| 09-30 19:00 | **Porto** vs ABC Braga | Andebol 1 | 60.4 | **59.5** | **56.4%** | 55.8% | 5% | 39.2% | ✅ | 🟢DVV → 🟢VV |
### 2026-10-01

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10-01 14:00 | **Perm** vs St. Petersburg | Superleague | 60.7 | **59.5** | **57.9%** | 58.7% | 4.9% | 36.4% | ❌ | ⚪V → ⚪V |
| 10-01 15:00 | **Saratov** vs Dinamo Astrakhan | Superleague | 60.7 | **59.5** | **58.1%** | 40.4% | 5% | 54.5% | ⚠️ | ⚪D → 🟢VV |
| 10-01 16:00 | **Sosnica Gliwice W** vs Zaglebie W | Superliga Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-01 16:00 | **Chekhovskiye Medvedi** vs Krasnodar | Superleague | 58.4 | **58.5** | **51.1%** | 44.9% | 5.2% | 49.8% | ⚠️ | ⚪D → 🟢VV |
| 10-01 16:30 | **Hvezda Cheb W** vs Slavia Prague W | Czech Cup Women | 59.6 | **59.5** | **52.5%** | 46.6% | 5.2% | 48.2% | ❌ | — → ⚪V |
| 10-01 16:30 | **Nes Tziona** vs Hapoel Arad | Division 1 | 61.3 | **59.5** | **60.7%** | 59.9% | 4.9% | 35.3% | ❌ | — → ⚪D |
| 10-01 16:30 | **Kobierzyce II W** vs Zaglebie Lubin W | I Liga Women | 60 | **59.5** | **54.4%** | 48.6% | 5.2% | 46.3% | ❌ | ⚪D → — |
| 10-01 17:00 | **Eisenach** vs Stuttgart | Bundesliga | 60.9 | **59.5** | **59%** | 53.7% | 5.1% | 41.2% | ✅ | 🔴DNVDD → 🔴NDDVD |
| 10-01 17:00 | **Lemgo** vs Hamburg | Bundesliga | 62 | **59.5** | **64.4%** | 53.3% | 5% | 41.7% | ✅ | 🟡DVVDD → 🔴NDDDV |
| 10-01 17:00 | **Maccabi Avishai Motzkin** vs Hapoel Kiriyat | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-01 17:00 | **Aker W** vs Gjovik W | 1. Division Women | 58.3 | **58.5** | **50.9%** | 62% | 4.9% | 33.1% | ❌ | ⚪V → ⚪D |
| 10-01 17:00 | **Helsingborg** vs Skanela | Handbollsligan | 61.2 | **59.5** | **60.4%** | 51.1% | 5.1% | 43.8% | ❌ | ⚪N → ⚪V |
| 10-01 18:00 | **Saran** vs PSG | Starligue | 60 | **59.5** | **54.3%** | 48.6% | 5.2% | 46.3% | ✅ | 🟢VVD → 🟢VNVVV |
| 10-01 18:00 | **KA** vs IBV Vestmannaeyjar | Olis Deildin | 61.5 | **59.5** | **61.9%** | 54.9% | 5% | 40.1% | ❌ | — → ⚪D |
| 10-01 18:00 | **Fram W** vs Selfoss W | Olis Deild Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-01 19:00 | **Haukar** vs Vikingur | Olis Deildin | 61.5 | **59.5** | **61.9%** | 54.9% | 5% | 40.1% | ❌ | ⚪V → — |
| 10-01 20:30 | **Fram** vs Afturelding | Olis Deildin | 63.1 | **59.5** | **69.1%** | 44.3% | 5% | 50.7% | ❌ | ⚪D → ⚪V |
### 2026-10-02

| Date | Match | Ligue | E(total) | Ligne | P(Over ligne) | P(1) | P(X) | P(2) | Suivi | Forme (dom → ext) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10-02 09:00 | **Trabzon Ortahisar W** vs Goztepe W | Superlig Women | 60.8 | **59.5** | **58.2%** | 57.4% | 5% | 37.6% | ❌ | — → ⚪D |
| 10-02 12:00 | **Bnei Herzliya** vs Rehovot | Division 1 | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 12:00 | **MK Holon** vs Hapoel Ashdod | Division 1 | 60.3 | **59.5** | **55.7%** | 66% | 4.6% | 29.4% | ❌ | ⚪V → — |
| 10-02 12:00 | **Ramat Hasharon** vs MK Beer Sheva | Division 1 | 60.3 | **59.5** | **55.7%** | 66% | 4.6% | 29.4% | ❌ | — → ⚪D |
| 10-02 13:00 | **Hapoel Le Zion** vs Maccabi Le Zion | Division 1 | 61.3 | **59.5** | **60.7%** | 59.9% | 4.9% | 35.3% | ❌ | ⚪V → — |
| 10-02 15:00 | **NEKA W** vs Alba Fehervar W | NB I Women | 59.9 | **59.5** | **53.8%** | 56.8% | 5% | 38.1% | ❌ | ⚪V → — |
| 10-02 15:00 | **Timisoara** vs Din. Bucuresti | Liga Nationala | 58.4 | **58.5** | **51%** | 56.4% | 5.1% | 38.5% | ⚠️ | — → 🔴DN |
| 10-02 15:00 | **Avia Grade Constanta** vs Donbas Mariupol | Superleague | 61.9 | **59.5** | **63.7%** | 59.2% | 4.9% | 35.9% | ❌ | — → ⚪D |
| 10-02 15:00 | **Karpaty Uzhgorod** vs Motor Zaporozhye | Superleague | 66.3 | **59.5** | **81.6%** | 65.4% | 4.4% | 30.2% | ⚠️ | 🟢VV → — |
| 10-02 15:00 | **Khmelnitsky** vs Kharkiv | Superleague | 66.3 | **59.5** | **81.6%** | 65.4% | 4.4% | 30.2% | ⚠️ | — → 🔴DD |
| 10-02 15:00 | **Spartak Kyiv** vs Odesa | Superleague | 61.9 | **59.5** | **63.7%** | 59.2% | 4.9% | 35.9% | ❌ | ⚪V → — |
| 10-02 15:30 | **BK-46** vs SIF | Suomen Cup | 60.1 | **59.5** | **55%** | 59% | 4.9% | 36.1% | ⚠️ | ⚪V → 🟡DV |
| 10-02 16:00 | **Mavrommatis W (Cyp)** vs Garliava W (Ltu) | European Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 16:00 | **RK Bor W (Srb)** vs Krivaja W (Bih) | European Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 16:00 | **Samadrexha W (Kos)** vs Neistin W (Fai) | European Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 16:00 | **Ferencvaros** vs Szeged | NB I | 63.6 | **59.5** | **71.3%** | 39.9% | 4.9% | 55.2% | ⚠️ | ⚪D → 🟡VD |
| 10-02 16:00 | **Wybrzeze Gdansk** vs Piotrkowianin Piotrkow | Superliga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 16:00 | **Mazur Sierpc** vs SMS ZPRP Plock | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 16:00 | **Maritimo** vs Sporting | Andebol 1 | 64 | **59.5** | **73%** | 41.7% | 4.9% | 53.4% | ✅ | 🟢VV → 🟢VVV |
| 10-02 16:00 | **Crvena zvezda** vs Radnicki | ARKUS Liga | 60.4 | **59.5** | **56.3%** | 58.1% | 5% | 37% | ❌ | ⚪V → — |
| 10-02 16:00 | **Partizan** vs Jugovic | ARKUS Liga | 62 | **59.5** | **64.3%** | 54.2% | 5% | 40.8% | ⚠️ | 🔴DDV → ⚪D |
| 10-02 16:00 | **RK Ljubljana W** vs Olimpija W | 1. SRL Women | 59.3 | **59.5** | **50.6%** | 57.5% | 5% | 37.5% | ❌ | — → ⚪D |
| 10-02 16:15 | **Elverum** vs Runar | Elkjop-ligaen | 58.7 | **58.5** | **53%** | 46.5% | 5.2% | 48.3% | ⚠️ | ⚪V → 🟢VV |
| 10-02 16:30 | **Silkeborg-Voel W** vs Copenhagen W | Kvindeligaen Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 16:30 | **HIFK** vs AIFK | Suomen Cup | 62.6 | **59.5** | **67.2%** | 43% | 5% | 52% | ❌ | — → ⚪V |
| 10-02 16:30 | **Przeworsk** vs Zabrze II | I Liga | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 16:30 | **Kristianstad W** vs Onnereds W | Handbollsligan Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 17:00 | **Sonderjyske** vs Ringsted | Herre Handbold Ligaen | 63.1 | **59.5** | **69.5%** | 59.7% | 4.8% | 35.5% | ⚠️ | ⚪V → 🔴DD |
| 10-02 17:00 | **Koge** vs Aarhus Handbold | 1. Division | 58.8 | **58.5** | **53.5%** | 46.6% | 5.2% | 48.2% | ❌ | ⚪D → ⚪V |
| 10-02 17:00 | **Odder** vs Raekker Molle | 1. Division | 60.3 | **59.5** | **55.7%** | 56.2% | 5% | 38.8% | ❌ | — → ⚪D |
| 10-02 17:00 | **Brixen W (Ita)** vs Vardar SCJS W (Mkd) | European Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 17:00 | **HSG Wetzlar** vs Rhein-Neckar | Bundesliga | 61.5 | **59.5** | **62%** | 48.4% | 5.1% | 46.5% | ✅ | 🔴DNDDD → 🔴DVVDD |
| 10-02 17:00 | **N-Lubbecke** vs Coburg 2000 | 2. Bundesliga | 59.8 | **59.5** | **53.5%** | 56.8% | 5% | 38.1% | ❌ | ⚪D → ⚪D |
| 10-02 17:00 | **ZPRP Kielce** vs Zamosc | Central League | 60.8 | **59.5** | **58.2%** | 53.7% | 5.1% | 41.3% | ❌ | ⚪D → — |
| 10-02 17:00 | **Morrazo Cangas** vs Atl. Valladolid | Liga ASOBAL | 61.4 | **59.5** | **61.2%** | 46.7% | 5.1% | 48.2% | ✅ | 🔴DD → 🟢VV |
| 10-02 17:00 | **Karlskrona** vs Amo HK | Handbollsligan | 61.1 | **59.5** | **59.8%** | 50.5% | 5.1% | 44.4% | ❌ | ⚪D → ⚪N |
| 10-02 17:00 | **Savehof** vs Hammarby | Handbollsligan | 59.7 | **59.5** | **52.7%** | 59% | 5% | 36% | ⚠️ | 🟢VV → ⚪D |
| 10-02 17:00 | **Aranas** vs Redbergslids | Allsvenskan | 58.9 | **58.5** | **53.8%** | 50.5% | 5.2% | 44.3% | ❌ | — → ⚪V |
| 10-02 17:30 | **Skive** vs Ribe-Esbjerg | Herre Handbold Ligaen | 59.8 | **59.5** | **53.2%** | 56.2% | 5% | 38.7% | ❌ | — → ⚪D |
| 10-02 17:30 | **Lemvig** vs Stoholm | 1. Division | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 17:30 | **Tonder** vs Midtjylland | 1. Division | 59 | **58.5** | **54.5%** | 58.8% | 5% | 36.2% | ❌ | ⚪V → — |
| 10-02 17:30 | **DHG W** vs Hadsten W | 1. Division Women | 58.2 | **58.5** | **50.3%** | 52.4% | 5.2% | 42.4% | ❌ | ⚪V → ⚪V |
| 10-02 17:30 | **Essen** vs Leipzig | 2. Bundesliga | 61.4 | **59.5** | **61.6%** | 48.6% | 5.1% | 46.3% | ❌ | ⚪D → ⚪V |
| 10-02 17:30 | **Karra W** vs Kungalvs W | Allsvenskan Women | 59 | **58.5** | **54.5%** | 55% | 5.1% | 39.9% | ❌ | ⚪V → — |
| 10-02 18:00 | **Dudelange W (Lux)** vs H 71 W (Fai) | European Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 18:00 | **Valence** vs Besancon | Proligue | 61.6 | **59.5** | **62.5%** | 55.5% | 5% | 39.5% | ❌ | — → ⚪D |
| 10-02 18:00 | **HBW Balingen-Weilstetten** vs Bergischer | Bundesliga | 59.6 | **59.5** | **52.4%** | 64.6% | 4.7% | 30.7% | ✅ | 🟡VDDDV → 🔴DDDDD |
| 10-02 18:00 | **Ka Thor W** vs Valur W | Olis Deild Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 18:30 | **Differdange W (Lux)** vs Levalea 2010 W (Mne) | European Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 18:30 | **Sint-Truiden W (Bel)** vs Athinaikos W (Gre) | European Cup Women | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 18:30 | **Caen** vs St. Raphael | Starligue | 60.1 | **59.5** | **54.6%** | 53.5% | 5.1% | 41.4% | ✅ | 🟢VVD → 🔴DVD |
| 10-02 18:30 | **Tremblay** vs Selestat | Starligue | 61.6 | **59.5** | **62.5%** | 50.5% | 5.1% | 44.4% | ✅ | 🔴DDV → 🟢DVV |
| 10-02 18:30 | **Cherbourg** vs Istres | Proligue | 59.8 | **59.5** | **53.5%** | 47.9% | 5.2% | 46.9% | ❌ | ⚪V → ⚪V |
| 10-02 18:30 | **Dijon** vs Creteil | Proligue | 60.5 | **59.5** | **57%** | 51.1% | 5.1% | 43.8% | ❌ | — → ⚪V |
| 10-02 18:30 | **Draguignan Var** vs Saintes | Proligue | 59.6 | **59.5** | **52.2%** | 50.5% | 5.2% | 44.4% | ❌ | ⚪D → ⚪D |
| 10-02 18:30 | **Frontignan** vs Pau Billere | Proligue | 61.7 | **59.5** | **62.8%** | 49.8% | 5.1% | 45.1% | ❌ | ⚪D → ⚪V |
| 10-02 18:30 | **Ivry** vs Cournon d'Auvergne | Proligue | 60.1 | **59.5** | **55.1%** | 50.5% | 5.1% | 44.4% | ❌ | — → ⚪V |
| 10-02 18:30 | **Pontault** vs Val d'Oise | Proligue | 60.4 | **59.5** | **56.3%** | 53% | 5.1% | 41.9% | ❌ | ⚪D → — |
| 10-02 18:30 | **Valur** vs Thor Akureyri | Olis Deildin | 60.4 | **59.5** | **56.6%** | 54.3% | 5.1% | 40.6% | ❌ | — → — |
| 10-02 18:30 | **Stjarnan W** vs Haukar W | Olis Deild Women | 60.3 | **59.5** | **55.7%** | 57.5% | 5% | 37.6% | ❌ | ⚪V → — |
| 10-02 18:30 | **Caserio Ciudad Real** vs Ademar | Liga ASOBAL | 63 | **59.5** | **69%** | 59.1% | 4.8% | 36.1% | ✅ | 🟡NV → 🔴DD |
| 10-02 19:30 | **Grotta W** vs IR Reykjavik W | Olis Deild Women | 60.3 | **59.5** | **55.7%** | 51.1% | 5.1% | 43.8% | ❌ | ⚪D → — |

## 7. Force des équipes (toutes)

_n = matchs d'historique · WR = winrate · BP/m = λ attaque · BM/m = λ defense · Force = BP−BM (buts/match) · Forme = 5 derniers (V/D/N) · Couleur = 🟢 fort / 🟡 moyen / 🔴 faible / ⚪ inconnu._

| # | Équipe | n | V-N-D | WR | BP/m | BM/m | Force | Forme | Couleur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | South Korea W | 4 | 4-0-0 | 100% | 37.2 | 22.1 | +15.1 | VVVV | 🟢 fort |
| 2 | Japan W | 4 | 4-0-0 | 100% | 35 | 24.2 | +10.7 | VVVV | 🟢 fort |
| 3 | El Zamalek | 2 | 2-0-0 | 100% | 34.5 | 24.9 | +9.6 | VV | 🟢 fort |
| 4 | Nowa Sol | 1 | 1-0-0 | 100% | 34.9 | 26.7 | +8.3 | V | ⚪ inconnu |
| 5 | Veszprem | 4 | 4-0-0 | 100% | 35.5 | 27.5 | +8 | VVVV | 🟢 fort |
| 6 | Bahrain | 4 | 4-0-0 | 100% | 32.2 | 25.2 | +7 | VVVV | 🟢 fort |
| 7 | Barcelona | 5 | 5-0-0 | 100% | 36.1 | 29.7 | +6.4 | VVVVV | 🟢 fort |
| 8 | El Zamalek (Egy) | 1 | 1-0-0 | 100% | 33.2 | 26.9 | +6.3 | V | ⚪ inconnu |
| 9 | Qatar | 3 | 3-0-0 | 100% | 32.9 | 26.8 | +6.2 | VVV | 🟢 fort |
| 10 | Runar | 2 | 2-0-0 | 100% | 32.3 | 26.5 | +5.8 | VV | 🟢 fort |
| 11 | Hypo NO W | 1 | 1-0-0 | 100% | 32.7 | 26.9 | +5.8 | V | ⚪ inconnu |
| 12 | Sporting | 3 | 3-0-0 | 100% | 35.6 | 29.9 | +5.7 | VVV | 🟢 fort |
| 13 | Hlohovec | 1 | 1-0-0 | 100% | 33.7 | 28.2 | +5.5 | V | ⚪ inconnu |
| 14 | Achenheim Truchtersheim W | 1 | 1-0-0 | 100% | 32.7 | 27.4 | +5.3 | V | ⚪ inconnu |
| 15 | Karpaty Uzhgorod | 2 | 2-0-0 | 100% | 38.5 | 33.7 | +4.8 | VV | 🟢 fort |
| 16 | Jomi Salerno W | 1 | 1-0-0 | 100% | 31.9 | 27.2 | +4.8 | V | ⚪ inconnu |
| 17 | MK Holon | 1 | 1-0-0 | 100% | 32.4 | 27.7 | +4.8 | V | ⚪ inconnu |
| 18 | Benfica | 1 | 1-0-0 | 100% | 32.2 | 27.7 | +4.5 | V | ⚪ inconnu |
| 19 | AIFK | 1 | 1-0-0 | 100% | 34.7 | 30.2 | +4.5 | V | ⚪ inconnu |
| 20 | Kiel | 6 | 6-0-0 | 100% | 32.4 | 28.1 | +4.3 | VVVVV | 🟢 fort |
| 21 | SC Magdeburg | 8 | 7-0-1 | 87.5% | 34.2 | 30 | +4.3 | VVVDV | 🟢 fort |
| 22 | Haslum HK | 1 | 1-0-0 | 100% | 32.7 | 28.4 | +4.3 | V | ⚪ inconnu |
| 23 | Halden | 1 | 1-0-0 | 100% | 32.9 | 28.7 | +4.3 | V | ⚪ inconnu |
| 24 | BK-46 | 1 | 1-0-0 | 100% | 31.9 | 27.7 | +4.3 | V | ⚪ inconnu |
| 25 | Kielce | 3 | 3-0-0 | 100% | 32.6 | 28.4 | +4.2 | VVV | 🟢 fort |
| 26 | Lovosice | 1 | 1-0-0 | 100% | 32.9 | 29.2 | +3.8 | V | ⚪ inconnu |
| 27 | Sviesa | 1 | 1-0-0 | 100% | 31.4 | 27.7 | +3.8 | V | ⚪ inconnu |
| 28 | Anilana Lodz | 1 | 1-0-0 | 100% | 33.7 | 29.9 | +3.8 | V | ⚪ inconnu |
| 29 | Winterthur W | 1 | 1-0-0 | 100% | 32.2 | 28.4 | +3.8 | V | ⚪ inconnu |
| 30 | Japan | 3 | 2-0-1 | 66.7% | 32.3 | 28.6 | +3.7 | VVD | 🟢 fort |
| 31 | Krasnodar | 2 | 2-0-0 | 100% | 30.5 | 27.1 | +3.4 | VV | 🟢 fort |
| 32 | Nantes | 5 | 5-0-0 | 100% | 32.7 | 29.3 | +3.4 | VVVVV | 🟢 fort |
| 33 | Morag | 1 | 1-0-0 | 100% | 32.4 | 29.2 | +3.3 | V | ⚪ inconnu |
| 34 | Olympiacos SFP | 1 | 1-0-0 | 100% | 31.7 | 28.4 | +3.3 | V | ⚪ inconnu |
| 35 | Chernomorochka W | 2 | 2-0-0 | 100% | 30.3 | 27.1 | +3.2 | VV | 🟢 fort |
| 36 | Flensburg-H. | 6 | 6-0-0 | 100% | 34.4 | 31.4 | +3 | VVVVV | 🟢 fort |
| 37 | Dinamo Astrakhan | 2 | 2-0-0 | 100% | 31.3 | 28.3 | +3 | VV | 🟢 fort |
| 38 | Nove Zamky | 1 | 1-0-0 | 100% | 32.4 | 29.4 | +3 | V | ⚪ inconnu |
| 39 | Granitas-Karys | 1 | 1-0-0 | 100% | 30.4 | 27.4 | +3 | V | ⚪ inconnu |
| 40 | Tertnes W | 1 | 1-0-0 | 100% | 31.7 | 28.7 | +3 | V | ⚪ inconnu |
| 41 | Slavia Prague W | 1 | 1-0-0 | 100% | 30.9 | 27.9 | +3 | V | ⚪ inconnu |
| 42 | Westfriesland SEW W | 1 | 1-0-0 | 100% | 33.9 | 30.9 | +3 | V | ⚪ inconnu |
| 43 | Istres | 1 | 1-0-0 | 100% | 31.2 | 28.2 | +3 | V | ⚪ inconnu |
| 44 | Limoges | 3 | 2-0-1 | 66.7% | 32.1 | 29.1 | +3 | VDV | 🟢 fort |
| 45 | Kuwait | 4 | 2-0-2 | 50% | 29.7 | 26.8 | +2.9 | VDVD | 🟡 moyen |
| 46 | Aalborg | 4 | 3-1-0 | 75% | 32 | 29.1 | +2.9 | NVVV | 🟢 fort |
| 47 | Skjern | 2 | 2-0-0 | 100% | 32.3 | 29.5 | +2.8 | VV | 🟢 fort |
| 48 | Elverum | 1 | 1-0-0 | 100% | 30.7 | 27.9 | +2.8 | V | ⚪ inconnu |
| 49 | Montpellier | 5 | 3-0-2 | 60% | 31.8 | 29.1 | +2.8 | VVVDD | 🟢 fort |
| 50 | PSG | 5 | 4-1-0 | 80% | 31.8 | 29.1 | +2.8 | VNVVV | 🟢 fort |
| 51 | Zielona Gora W | 1 | 1-0-0 | 100% | 31.2 | 28.4 | +2.8 | V | ⚪ inconnu |
| 52 | Amicitia Zurich 2 | 1 | 1-0-0 | 100% | 32.2 | 29.4 | +2.8 | V | ⚪ inconnu |
| 53 | Metz W (Fra) | 1 | 1-0-0 | 100% | 31.4 | 28.7 | +2.8 | V | ⚪ inconnu |
| 54 | Besancon W | 1 | 1-0-0 | 100% | 32.7 | 29.9 | +2.8 | V | ⚪ inconnu |
| 55 | Rotterdam Handbal | 1 | 1-0-0 | 100% | 31.2 | 28.4 | +2.8 | V | ⚪ inconnu |
| 56 | JKS Jaroslaw W | 1 | 1-0-0 | 100% | 30.2 | 27.4 | +2.8 | V | ⚪ inconnu |
| 57 | Barcelona (Esp) | 1 | 1-0-0 | 100% | 33.7 | 30.9 | +2.8 | V | ⚪ inconnu |
| 58 | Suhr Aarau | 1 | 1-0-0 | 100% | 30.4 | 27.9 | +2.5 | V | ⚪ inconnu |
| 59 | Tapa | 1 | 1-0-0 | 100% | 31.2 | 28.7 | +2.5 | V | ⚪ inconnu |
| 60 | Bjerringbro/Silkeborg | 1 | 1-0-0 | 100% | 31.7 | 29.2 | +2.5 | V | ⚪ inconnu |
| 61 | Tulln W | 1 | 1-0-0 | 100% | 32.2 | 29.7 | +2.5 | V | ⚪ inconnu |
| 62 | Meshkov Brest | 1 | 1-0-0 | 100% | 32.4 | 29.9 | +2.5 | V | ⚪ inconnu |
| 63 | Gyor W | 1 | 1-0-0 | 100% | 30.2 | 27.7 | +2.5 | V | ⚪ inconnu |
| 64 | Gyor W (Hun) | 1 | 1-0-0 | 100% | 30.2 | 27.7 | +2.5 | V | ⚪ inconnu |
| 65 | Kielce W | 1 | 1-0-0 | 100% | 29.9 | 27.4 | +2.5 | V | ⚪ inconnu |
| 66 | Drammen | 2 | 2-0-0 | 100% | 29.9 | 27.5 | +2.4 | VV | 🟢 fort |
| 67 | SIF | 2 | 1-0-1 | 50% | 31.5 | 29.1 | +2.4 | DV | 🟡 moyen |
| 68 | Vardar 1961 | 3 | 1-0-2 | 33.3% | 32.9 | 30.6 | +2.3 | DDV | 🔴 faible |
| 69 | South Korea | 4 | 2-1-1 | 50% | 29.7 | 27.4 | +2.3 | VNDV | 🟡 moyen |
| 70 | Velenje W | 1 | 1-0-0 | 100% | 31.9 | 29.7 | +2.3 | V | ⚪ inconnu |
| 71 | Zubri | 1 | 1-0-0 | 100% | 29.7 | 27.4 | +2.3 | V | ⚪ inconnu |
| 72 | Ivanic W | 1 | 1-0-0 | 100% | 29.9 | 27.7 | +2.3 | V | ⚪ inconnu |
| 73 | Grudziadz | 1 | 1-0-0 | 100% | 34.2 | 31.9 | +2.3 | V | ⚪ inconnu |
| 74 | Zgoda Ruda Slaska W | 1 | 1-0-0 | 100% | 30.9 | 28.7 | +2.3 | V | ⚪ inconnu |
| 75 | Yellow/ Pfadi Espoirs | 1 | 1-0-0 | 100% | 31.7 | 29.4 | +2.3 | V | ⚪ inconnu |
| 76 | Bergischer W | 1 | 1-0-0 | 100% | 31.2 | 28.9 | +2.3 | V | ⚪ inconnu |
| 77 | Ohrid | 1 | 1-0-0 | 100% | 32.9 | 30.7 | +2.3 | V | ⚪ inconnu |
| 78 | Szczecin | 1 | 1-0-0 | 100% | 30.7 | 28.4 | +2.3 | V | ⚪ inconnu |
| 79 | Hapoel Le Zion | 1 | 1-0-0 | 100% | 32.2 | 29.9 | +2.3 | V | ⚪ inconnu |
| 80 | IFK Ystads | 1 | 1-0-0 | 100% | 30.7 | 28.4 | +2.3 | V | ⚪ inconnu |
| 81 | Zvenigorod W | 2 | 1-0-1 | 50% | 31.3 | 29.1 | +2.2 | VD | 🟡 moyen |
| 82 | CD Bidasoa Irun | 2 | 2-0-0 | 100% | 31.7 | 29.5 | +2.2 | VV | 🟢 fort |
| 83 | Torrelavega | 2 | 1-0-1 | 50% | 30.5 | 28.3 | +2.2 | DV | 🟡 moyen |
| 84 | Stjarnan | 1 | 1-0-0 | 100% | 31.9 | 29.9 | +2 | V | ⚪ inconnu |
| 85 | Afturelding | 1 | 1-0-0 | 100% | 33.2 | 31.2 | +2 | V | ⚪ inconnu |
| 86 | North Macedonia W | 1 | 1-0-0 | 100% | 29.9 | 27.9 | +2 | V | ⚪ inconnu |
| 87 | Fredericia | 1 | 1-0-0 | 100% | 32.2 | 30.2 | +2 | V | ⚪ inconnu |
| 88 | Porto | 3 | 2-0-1 | 66.7% | 31.8 | 29.8 | +2 | DVV | 🟢 fort |
| 89 | Perm | 1 | 1-0-0 | 100% | 32.2 | 30.2 | +2 | V | ⚪ inconnu |
| 90 | Norway B W | 1 | 1-0-0 | 100% | 32.2 | 30.2 | +2 | V | ⚪ inconnu |
| 91 | MT Melsungen | 8 | 5-1-2 | 62.5% | 31.3 | 29.3 | +2 | VVDVV | 🟢 fort |
| 92 | Fuchse Berlin | 7 | 5-0-2 | 71.4% | 33.3 | 31.3 | +2 | VVVDV | 🟢 fort |
| 93 | Atl. Valladolid | 2 | 2-0-0 | 100% | 30.5 | 28.5 | +2 | VV | 🟢 fort |
| 94 | Stockerau W | 1 | 1-0-0 | 100% | 30.9 | 28.9 | +2 | V | ⚪ inconnu |
| 95 | Sala W | 1 | 1-0-0 | 100% | 30.4 | 28.4 | +2 | V | ⚪ inconnu |
| 96 | Kaerjeng | 1 | 1-0-0 | 100% | 31.7 | 29.7 | +2 | V | ⚪ inconnu |
| 97 | Aalsmeer 2 | 1 | 1-0-0 | 100% | 31.9 | 29.9 | +2 | V | ⚪ inconnu |
| 98 | Eurofarm Pelister | 1 | 1-0-0 | 100% | 30.9 | 28.9 | +2 | V | ⚪ inconnu |
| 99 | Spartak Kyiv | 1 | 1-0-0 | 100% | 32.7 | 30.7 | +2 | V | ⚪ inconnu |
| 100 | Albatro | 2 | 2-0-0 | 100% | 29.5 | 27.7 | +1.8 | VV | 🟢 fort |
| 101 | Szeged | 2 | 1-0-1 | 50% | 33.3 | 31.5 | +1.8 | VD | 🟡 moyen |
| 102 | HBW Balingen-Weilstetten | 6 | 3-0-3 | 50% | 30.7 | 29 | +1.8 | VDDDV | 🟡 moyen |
| 103 | Alpla Hard | 1 | 1-0-0 | 100% | 31.2 | 29.4 | +1.8 | V | ⚪ inconnu |
| 104 | Potsdam | 1 | 1-0-0 | 100% | 30.7 | 28.9 | +1.8 | V | ⚪ inconnu |
| 105 | AEK Athens | 1 | 1-0-0 | 100% | 31.2 | 29.4 | +1.8 | V | ⚪ inconnu |
| 106 | Kadetten Schaffhausen | 1 | 1-0-0 | 100% | 31.4 | 29.7 | +1.8 | V | ⚪ inconnu |
| 107 | Zlin | 1 | 1-0-0 | 100% | 29.9 | 28.2 | +1.8 | V | ⚪ inconnu |
| 108 | Tonder | 1 | 1-0-0 | 100% | 29.7 | 27.9 | +1.8 | V | ⚪ inconnu |
| 109 | Kungalvs HK | 1 | 1-0-0 | 100% | 30.7 | 28.9 | +1.8 | V | ⚪ inconnu |
| 110 | MGA Handball W | 1 | 1-0-0 | 100% | 28.4 | 26.7 | +1.8 | V | ⚪ inconnu |
| 111 | Bjelovar W | 1 | 1-0-0 | 100% | 30.4 | 28.7 | +1.8 | V | ⚪ inconnu |
| 112 | Nordstrand | 1 | 1-0-0 | 100% | 31.9 | 30.2 | +1.8 | V | ⚪ inconnu |
| 113 | Aker W | 1 | 1-0-0 | 100% | 30.4 | 28.7 | +1.8 | V | ⚪ inconnu |
| 114 | Ol.Grodkow | 1 | 1-0-0 | 100% | 31.2 | 29.4 | +1.8 | V | ⚪ inconnu |
| 115 | SPONO Eagles W | 1 | 1-0-0 | 100% | 29.4 | 27.7 | +1.8 | V | ⚪ inconnu |
| 116 | Minden | 2 | 2-0-0 | 100% | 30.9 | 29.3 | +1.6 | VV | 🟢 fort |
| 117 | Savehof | 2 | 2-0-0 | 100% | 30.9 | 29.3 | +1.6 | VV | 🟢 fort |
| 118 | CSKA Moscow | 1 | 1-0-0 | 100% | 30.4 | 28.9 | +1.5 | V | ⚪ inconnu |
| 119 | CSKA Moscow W | 1 | 1-0-0 | 100% | 30.2 | 28.7 | +1.5 | V | ⚪ inconnu |
| 120 | Differdange | 1 | 1-0-0 | 100% | 30.9 | 29.4 | +1.5 | V | ⚪ inconnu |
| 121 | Alingsas | 1 | 1-0-0 | 100% | 31.2 | 29.7 | +1.5 | V | ⚪ inconnu |
| 122 | Redbergslids | 1 | 1-0-0 | 100% | 29.4 | 27.9 | +1.5 | V | ⚪ inconnu |
| 123 | Crvena zvezda | 1 | 1-0-0 | 100% | 30.9 | 29.4 | +1.5 | V | ⚪ inconnu |
| 124 | Baekkelaget W | 1 | 1-0-0 | 100% | 30.4 | 28.9 | +1.5 | V | ⚪ inconnu |
| 125 | Konskie | 1 | 1-0-0 | 100% | 29.9 | 28.4 | +1.5 | V | ⚪ inconnu |
| 126 | Amicitia Zurich II W | 1 | 1-0-0 | 100% | 30.7 | 29.2 | +1.5 | V | ⚪ inconnu |
| 127 | Linz | 1 | 1-0-0 | 100% | 31.4 | 29.9 | +1.5 | V | ⚪ inconnu |
| 128 | Esbjerg W (Den) | 1 | 1-0-0 | 100% | 31.9 | 30.4 | +1.5 | V | ⚪ inconnu |
| 129 | KRAS/Volendam (Ned) | 1 | 1-0-0 | 100% | 30.7 | 29.2 | +1.5 | V | ⚪ inconnu |
| 130 | JuRo Unirek W | 1 | 1-0-0 | 100% | 29.7 | 28.2 | +1.5 | V | ⚪ inconnu |
| 131 | Baekkelaget | 1 | 1-0-0 | 100% | 32.2 | 30.7 | +1.5 | V | ⚪ inconnu |
| 132 | Gossau | 1 | 1-0-0 | 100% | 31.4 | 29.9 | +1.5 | V | ⚪ inconnu |
| 133 | Bern 2 | 1 | 1-0-0 | 100% | 32.7 | 31.2 | +1.5 | V | ⚪ inconnu |
| 134 | Manisa BB W | 1 | 1-0-0 | 100% | 29.9 | 28.4 | +1.5 | V | ⚪ inconnu |
| 135 | Cournon d'Auvergne | 1 | 1-0-0 | 100% | 30.7 | 29.2 | +1.5 | V | ⚪ inconnu |
| 136 | Granollers | 2 | 2-0-0 | 100% | 31.1 | 29.7 | +1.4 | VV | 🟢 fort |
| 137 | Mors | 2 | 2-0-0 | 100% | 30.3 | 28.9 | +1.4 | VV | 🟢 fort |
| 138 | ABC Braga | 2 | 2-0-0 | 100% | 30.3 | 28.9 | +1.4 | VV | 🟢 fort |
| 139 | Vaslui | 1 | 1-0-0 | 100% | 30.7 | 29.4 | +1.3 | V | ⚪ inconnu |
| 140 | Dicken | 1 | 1-0-0 | 100% | 31.4 | 30.2 | +1.3 | V | ⚪ inconnu |
| 141 | Kwiek W | 1 | 1-0-0 | 100% | 32.2 | 30.9 | +1.3 | V | ⚪ inconnu |
| 142 | UOR No.2 Moscow | 1 | 1-0-0 | 100% | 30.7 | 29.4 | +1.3 | V | ⚪ inconnu |
| 143 | Topolcany | 1 | 1-0-0 | 100% | 31.7 | 30.4 | +1.3 | V | ⚪ inconnu |
| 144 | Skanela | 1 | 1-0-0 | 100% | 31.2 | 29.9 | +1.3 | V | ⚪ inconnu |
| 145 | RTV Basel | 1 | 1-0-0 | 100% | 30.7 | 29.4 | +1.3 | V | ⚪ inconnu |
| 146 | Istanbul Genclik Spor Kulubu | 1 | 1-0-0 | 100% | 32.2 | 30.9 | +1.3 | V | ⚪ inconnu |
| 147 | Sonderjyske | 1 | 1-0-0 | 100% | 32.2 | 30.9 | +1.3 | V | ⚪ inconnu |
| 148 | RK Medjimurje | 1 | 1-0-0 | 100% | 30.2 | 28.9 | +1.3 | V | ⚪ inconnu |
| 149 | NFH W | 1 | 1-0-0 | 100% | 30.4 | 29.2 | +1.3 | V | ⚪ inconnu |
| 150 | Brest Bretagne W | 1 | 1-0-0 | 100% | 29.4 | 28.2 | +1.3 | V | ⚪ inconnu |
| 151 | Aalsmeer | 1 | 1-0-0 | 100% | 31.2 | 29.9 | +1.3 | V | ⚪ inconnu |
| 152 | Brest Bretagne W (Fra) | 1 | 1-0-0 | 100% | 29.4 | 28.2 | +1.3 | V | ⚪ inconnu |
| 153 | Aalsmeer (Ned) | 1 | 1-0-0 | 100% | 31.2 | 29.9 | +1.3 | V | ⚪ inconnu |
| 154 | Dabas | 1 | 1-0-0 | 100% | 30.9 | 29.7 | +1.3 | V | ⚪ inconnu |
| 155 | Larvik W | 1 | 1-0-0 | 100% | 32.4 | 31.2 | +1.3 | V | ⚪ inconnu |
| 156 | Haslum W | 1 | 1-0-0 | 100% | 29.4 | 28.2 | +1.3 | V | ⚪ inconnu |
| 157 | Marcovia W | 1 | 1-0-0 | 100% | 31.9 | 30.7 | +1.3 | V | ⚪ inconnu |
| 158 | Altdorf | 1 | 1-0-0 | 100% | 29.7 | 28.4 | +1.3 | V | ⚪ inconnu |
| 159 | Metkovic | 1 | 1-0-0 | 100% | 30.7 | 29.4 | +1.3 | V | ⚪ inconnu |
| 160 | Bevo HC (Ned) | 1 | 1-0-0 | 100% | 32.9 | 31.7 | +1.3 | V | ⚪ inconnu |
| 161 | Bensheim-Auerbach W | 1 | 1-0-0 | 100% | 30.2 | 28.9 | +1.3 | V | ⚪ inconnu |
| 162 | Stjarnan W | 1 | 1-0-0 | 100% | 30.7 | 29.4 | +1.3 | V | ⚪ inconnu |
| 163 | Brixen W | 1 | 1-0-0 | 100% | 30.2 | 28.9 | +1.3 | V | ⚪ inconnu |
| 164 | Deurningen W | 1 | 1-0-0 | 100% | 29.7 | 28.4 | +1.3 | V | ⚪ inconnu |
| 165 | Alavarium W | 1 | 1-0-0 | 100% | 30.4 | 29.2 | +1.3 | V | ⚪ inconnu |
| 166 | ZRD Litija W | 1 | 1-0-0 | 100% | 29.7 | 28.4 | +1.3 | V | ⚪ inconnu |
| 167 | Uskudar W | 1 | 1-0-0 | 100% | 31.2 | 29.9 | +1.3 | V | ⚪ inconnu |
| 168 | Horsens W | 1 | 1-0-0 | 100% | 30.4 | 29.2 | +1.3 | V | ⚪ inconnu |
| 169 | Creteil | 1 | 1-0-0 | 100% | 30.9 | 29.7 | +1.3 | V | ⚪ inconnu |
| 170 | Zory W | 1 | 1-0-0 | 100% | 30.7 | 29.4 | +1.3 | V | ⚪ inconnu |
| 171 | Gummersbach | 6 | 3-1-2 | 50% | 31.7 | 30.5 | +1.2 | VNDVV | 🟡 moyen |
| 172 | Emsdetten | 2 | 2-0-0 | 100% | 32.7 | 31.5 | +1.2 | VV | 🟢 fort |
| 173 | Vitoria SC | 2 | 2-0-0 | 100% | 30.3 | 29.1 | +1.2 | VV | 🟢 fort |
| 174 | Ystads IF | 2 | 1-0-1 | 50% | 31.3 | 30.1 | +1.2 | DV | 🟡 moyen |
| 175 | Caserio Ciudad Real | 2 | 1-1-0 | 50% | 31.1 | 29.9 | +1.2 | NV | 🟡 moyen |
| 176 | China W | 4 | 2-0-2 | 50% | 29.4 | 28.4 | +1 | VVDD | 🟡 moyen |
| 177 | EIF | 1 | 1-0-0 | 100% | 31.4 | 30.4 | +1 | V | ⚪ inconnu |
| 178 | Hagen | 2 | 1-0-1 | 50% | 32.9 | 31.9 | +1 | DV | 🟡 moyen |
| 179 | Pressano | 1 | 1-0-0 | 100% | 30.7 | 29.7 | +1 | V | ⚪ inconnu |
| 180 | Cassano | 1 | 1-0-0 | 100% | 30.9 | 29.9 | +1 | V | ⚪ inconnu |
| 181 | Hadsten W | 1 | 1-0-0 | 100% | 28.7 | 27.7 | +1 | V | ⚪ inconnu |
| 182 | DVSC W | 1 | 1-0-0 | 100% | 31.9 | 30.9 | +1 | V | ⚪ inconnu |
| 183 | Toulon W | 1 | 1-0-0 | 100% | 32.4 | 31.4 | +1 | V | ⚪ inconnu |
| 184 | Bukowsko Dopiewski W | 1 | 1-0-0 | 100% | 29.7 | 28.7 | +1 | V | ⚪ inconnu |
| 185 | Antequera | 1 | 1-0-0 | 100% | 30.4 | 29.4 | +1 | V | ⚪ inconnu |
| 186 | Anaitasuna | 1 | 1-0-0 | 100% | 31.4 | 30.4 | +1 | V | ⚪ inconnu |
| 187 | NEKA W | 1 | 1-0-0 | 100% | 30.2 | 29.2 | +1 | V | ⚪ inconnu |
| 188 | Chambery Savoie | 3 | 1-0-2 | 33.3% | 31.6 | 30.8 | +0.8 | DDV | 🔴 faible |
| 189 | HOJ | 2 | 1-0-1 | 50% | 28.9 | 28.1 | +0.8 | VD | 🟡 moyen |
| 190 | Chiaravalle | 2 | 1-0-1 | 50% | 29.7 | 28.9 | +0.8 | DV | 🟡 moyen |
| 191 | Izola W | 1 | 1-0-0 | 100% | 30.4 | 29.7 | +0.8 | V | ⚪ inconnu |
| 192 | Bodo | 1 | 1-0-0 | 100% | 29.2 | 28.4 | +0.8 | V | ⚪ inconnu |
| 193 | Dunajska Streda | 1 | 1-0-0 | 100% | 28.7 | 27.9 | +0.8 | V | ⚪ inconnu |
| 194 | Plzen | 1 | 1-0-0 | 100% | 29.4 | 28.7 | +0.8 | V | ⚪ inconnu |
| 195 | Rzeszow W | 1 | 1-0-0 | 100% | 29.2 | 28.4 | +0.8 | V | ⚪ inconnu |
| 196 | Povazska Bystrica | 1 | 1-0-0 | 100% | 30.4 | 29.7 | +0.8 | V | ⚪ inconnu |
| 197 | Slovenj Gradec | 1 | 1-0-0 | 100% | 30.2 | 29.4 | +0.8 | V | ⚪ inconnu |
| 198 | Skara W | 1 | 1-0-0 | 100% | 30.9 | 30.2 | +0.8 | V | ⚪ inconnu |
| 199 | Dugo Selo | 1 | 1-0-0 | 100% | 29.9 | 29.2 | +0.8 | V | ⚪ inconnu |
| 200 | Rudar Labin W | 1 | 1-0-0 | 100% | 29.4 | 28.7 | +0.8 | V | ⚪ inconnu |
| 201 | Karvina | 1 | 1-0-0 | 100% | 31.4 | 30.7 | +0.8 | V | ⚪ inconnu |
| 202 | Ferencvaros W (Hun) | 1 | 1-0-0 | 100% | 29.7 | 28.9 | +0.8 | V | ⚪ inconnu |
| 203 | Fuchse Berlin W | 1 | 1-0-0 | 100% | 28.9 | 28.2 | +0.8 | V | ⚪ inconnu |
| 204 | Bevo HC 2 | 1 | 1-0-0 | 100% | 30.4 | 29.7 | +0.8 | V | ⚪ inconnu |
| 205 | E&O W | 1 | 1-0-0 | 100% | 33.2 | 32.4 | +0.8 | V | ⚪ inconnu |
| 206 | Seen Tigers | 1 | 1-0-0 | 100% | 30.2 | 29.4 | +0.8 | V | ⚪ inconnu |
| 207 | Espoirs | 1 | 1-0-0 | 100% | 30.4 | 29.7 | +0.8 | V | ⚪ inconnu |
| 208 | Aarhus Handbold | 1 | 1-0-0 | 100% | 30.4 | 29.7 | +0.8 | V | ⚪ inconnu |
| 209 | RK Zagreb | 3 | 2-0-1 | 66.7% | 31.1 | 30.4 | +0.7 | VDV | 🟢 fort |
| 210 | Bergen | 2 | 2-0-0 | 100% | 31.7 | 31.1 | +0.6 | VV | 🟢 fort |
| 211 | Maritimo | 2 | 2-0-0 | 100% | 31.5 | 30.9 | +0.6 | VV | 🟢 fort |
| 212 | China | 3 | 1-0-2 | 33.3% | 30.1 | 29.6 | +0.5 | DDV | 🔴 faible |
| 213 | Viljandi | 1 | 1-0-0 | 100% | 30.4 | 29.9 | +0.5 | V | ⚪ inconnu |
| 214 | Fasano | 1 | 1-0-0 | 100% | 29.9 | 29.4 | +0.5 | V | ⚪ inconnu |
| 215 | Spor Toto | 1 | 1-0-0 | 100% | 30.7 | 30.2 | +0.5 | V | ⚪ inconnu |
| 216 | Vendsyssel | 1 | 1-0-0 | 100% | 31.2 | 30.7 | +0.5 | V | ⚪ inconnu |
| 217 | Bistrita W | 1 | 1-0-0 | 100% | 29.9 | 29.4 | +0.5 | V | ⚪ inconnu |
| 218 | Potaissa Turda | 1 | 1-0-0 | 100% | 29.2 | 28.7 | +0.5 | V | ⚪ inconnu |
| 219 | Leipzig | 1 | 1-0-0 | 100% | 31.9 | 31.4 | +0.5 | V | ⚪ inconnu |
| 220 | Saran | 3 | 2-0-1 | 66.7% | 29.8 | 29.3 | +0.5 | VVD | 🟢 fort |
| 221 | Potaissa Turda (Rou) | 1 | 1-0-0 | 100% | 29.2 | 28.7 | +0.5 | V | ⚪ inconnu |
| 222 | Guif | 1 | 1-0-0 | 100% | 29.7 | 29.2 | +0.5 | V | ⚪ inconnu |
| 223 | SPONO II II W | 1 | 1-0-0 | 100% | 30.4 | 29.9 | +0.5 | V | ⚪ inconnu |
| 224 | Krems | 1 | 1-0-0 | 100% | 29.4 | 28.9 | +0.5 | V | ⚪ inconnu |
| 225 | Dubocica (Srb) | 1 | 1-0-0 | 100% | 31.2 | 30.7 | +0.5 | V | ⚪ inconnu |
| 226 | Kalisz (Pol) | 1 | 1-0-0 | 100% | 28.9 | 28.4 | +0.5 | V | ⚪ inconnu |
| 227 | Paris 92 W | 1 | 1-0-0 | 100% | 30.4 | 29.9 | +0.5 | V | ⚪ inconnu |
| 228 | Thuringer W | 1 | 1-0-0 | 100% | 31.4 | 30.9 | +0.5 | V | ⚪ inconnu |
| 229 | Csurgoi | 1 | 1-0-0 | 100% | 29.9 | 29.4 | +0.5 | V | ⚪ inconnu |
| 230 | Silvant Elblag | 1 | 1-0-0 | 100% | 31.4 | 30.9 | +0.5 | V | ⚪ inconnu |
| 231 | Komprachcice | 1 | 1-0-0 | 100% | 30.2 | 29.7 | +0.5 | V | ⚪ inconnu |
| 232 | ABC Braga W | 1 | 1-0-0 | 100% | 28.4 | 27.9 | +0.5 | V | ⚪ inconnu |
| 233 | Willisau | 1 | 1-0-0 | 100% | 31.9 | 31.4 | +0.5 | V | ⚪ inconnu |
| 234 | Pau Billere | 1 | 1-0-0 | 100% | 31.7 | 31.2 | +0.5 | V | ⚪ inconnu |
| 235 | Cherbourg | 1 | 1-0-0 | 100% | 30.4 | 29.9 | +0.5 | V | ⚪ inconnu |
| 236 | AZS Poznan W | 1 | 1-0-0 | 100% | 30.9 | 30.4 | +0.5 | V | ⚪ inconnu |
| 237 | Bozen | 2 | 2-0-0 | 100% | 30.3 | 29.9 | +0.4 | VV | 🟢 fort |
| 238 | Esch (Lux) | 2 | 1-0-1 | 50% | 30.5 | 30.1 | +0.4 | VD | 🟡 moyen |
| 239 | Kopavogur | 1 | 1-0-0 | 100% | 31.4 | 31.2 | +0.3 | V | ⚪ inconnu |
| 240 | Haukar | 1 | 1-0-0 | 100% | 31.4 | 31.2 | +0.3 | V | ⚪ inconnu |
| 241 | Koscian | 1 | 1-0-0 | 100% | 33.4 | 33.2 | +0.3 | V | ⚪ inconnu |
| 242 | Togliatti W | 1 | 1-0-0 | 100% | 29.9 | 29.7 | +0.3 | V | ⚪ inconnu |
| 243 | Kristiansand | 1 | 1-0-0 | 100% | 30.2 | 29.9 | +0.3 | V | ⚪ inconnu |
| 244 | Sandefjord TIF | 1 | 1-0-0 | 100% | 30.7 | 30.4 | +0.3 | V | ⚪ inconnu |
| 245 | Ostrow Wielkopolski | 1 | 1-0-0 | 100% | 30.4 | 30.2 | +0.3 | V | ⚪ inconnu |
| 246 | St. Petersburg | 1 | 1-0-0 | 100% | 29.7 | 29.4 | +0.3 | V | ⚪ inconnu |
| 247 | Dubocica | 1 | 1-0-0 | 100% | 30.2 | 29.9 | +0.3 | V | ⚪ inconnu |
| 248 | Lugi | 1 | 1-0-0 | 100% | 28.9 | 28.7 | +0.3 | V | ⚪ inconnu |
| 249 | Karra W | 1 | 1-0-0 | 100% | 28.9 | 28.7 | +0.3 | V | ⚪ inconnu |
| 250 | Slovenia W | 1 | 1-0-0 | 100% | 29.9 | 29.7 | +0.3 | V | ⚪ inconnu |
| 251 | Holstebro | 1 | 1-0-0 | 100% | 32.2 | 31.9 | +0.3 | V | ⚪ inconnu |
| 252 | Aris | 1 | 1-0-0 | 100% | 29.9 | 29.7 | +0.3 | V | ⚪ inconnu |
| 253 | Gwardia Opole | 1 | 1-0-0 | 100% | 29.7 | 29.4 | +0.3 | V | ⚪ inconnu |
| 254 | Werder Bremen W | 1 | 1-0-0 | 100% | 31.4 | 31.2 | +0.3 | V | ⚪ inconnu |
| 255 | Kjelsas W | 1 | 1-0-0 | 100% | 28.9 | 28.7 | +0.3 | V | ⚪ inconnu |
| 256 | Trondheim W | 1 | 1-0-0 | 100% | 28.9 | 28.7 | +0.3 | V | ⚪ inconnu |
| 257 | Gorica | 1 | 1-0-0 | 100% | 30.7 | 30.4 | +0.3 | V | ⚪ inconnu |
| 258 | DHG W | 1 | 1-0-0 | 100% | 30.2 | 29.9 | +0.3 | V | ⚪ inconnu |
| 259 | Montpellier W | 1 | 1-0-0 | 100% | 29.7 | 29.4 | +0.3 | V | ⚪ inconnu |
| 260 | Eurofarm Pelister 2 | 1 | 1-0-0 | 100% | 30.2 | 29.9 | +0.3 | V | ⚪ inconnu |
| 261 | Aurum Gorzow | 1 | 1-0-0 | 100% | 30.7 | 30.4 | +0.3 | V | ⚪ inconnu |
| 262 | Jeziorak | 1 | 1-0-0 | 100% | 29.7 | 29.4 | +0.3 | V | ⚪ inconnu |
| 263 | Jelenia Gora W | 1 | 1-0-0 | 100% | 28.4 | 28.2 | +0.3 | V | ⚪ inconnu |
| 264 | Krakow | 1 | 1-0-0 | 100% | 30.7 | 30.4 | +0.3 | V | ⚪ inconnu |
| 265 | Erlangen | 6 | 3-1-2 | 50% | 30.3 | 30.1 | +0.2 | NDVVV | 🟡 moyen |
| 266 | HK Kosice | 2 | 1-0-1 | 50% | 29.9 | 29.7 | +0.2 | DV | 🟡 moyen |
| 267 | Tikvesh | 2 | 1-1-0 | 50% | 30.3 | 30.1 | +0.2 | VN | 🟡 moyen |
| 268 | Cuenca | 2 | 1-0-1 | 50% | 30.3 | 30.1 | +0.2 | DV | 🟡 moyen |
| 269 | Croatia W | 1 | 0-1-0 | 0% | 27.7 | 27.7 | +0 | N | ⚪ inconnu |
| 270 | Montenegro W | 1 | 0-1-0 | 0% | 27.7 | 27.7 | +0 | N | ⚪ inconnu |
| 271 | Lubeck-Schwartau | 2 | 1-0-1 | 50% | 31.3 | 31.3 | +0 | VD | 🟡 moyen |
| 272 | Goppingen | 6 | 4-0-2 | 66.7% | 29.9 | 29.9 | +0 | DDVVV | 🟢 fort |
| 273 | Cologne | 2 | 1-0-1 | 50% | 29.5 | 29.5 | +0 | VD | 🟡 moyen |
| 274 | Prilep | 1 | 0-1-0 | 0% | 29.7 | 29.7 | +0 | N | ⚪ inconnu |
| 275 | Helsingborg | 1 | 0-1-0 | 0% | 30.7 | 30.7 | +0 | N | ⚪ inconnu |
| 276 | Amo HK | 1 | 0-1-0 | 0% | 30.7 | 30.7 | +0 | N | ⚪ inconnu |
| 277 | Wacker Thun | 1 | 0-1-0 | 0% | 30.2 | 30.2 | +0 | N | ⚪ inconnu |
| 278 | Bern | 1 | 0-1-0 | 0% | 30.2 | 30.2 | +0 | N | ⚪ inconnu |
| 279 | Selestat | 3 | 2-0-1 | 66.7% | 30.1 | 30.1 | +0 | DVV | 🟢 fort |
| 280 | Wisla Plock | 2 | 1-0-1 | 50% | 28.1 | 28.1 | +0 | DV | 🟡 moyen |
| 281 | Beykoz Bld. | 2 | 1-0-1 | 50% | 30.1 | 30.3 | -0.2 | VD | 🟡 moyen |
| 282 | IBV Vestmannaeyjar | 1 | 0-0-1 | 0% | 31.2 | 31.4 | -0.2 | D | ⚪ inconnu |
| 283 | FH Hafnarfjordur | 1 | 0-0-1 | 0% | 31.2 | 31.4 | -0.2 | D | ⚪ inconnu |
| 284 | Wolsztyn | 1 | 0-0-1 | 0% | 33.2 | 33.4 | -0.2 | D | ⚪ inconnu |
| 285 | Meran | 1 | 0-0-1 | 0% | 30.4 | 30.7 | -0.2 | D | ⚪ inconnu |
| 286 | Viking TIF | 1 | 0-0-1 | 0% | 29.9 | 30.2 | -0.2 | D | ⚪ inconnu |
| 287 | Kalisz | 1 | 0-0-1 | 0% | 30.2 | 30.4 | -0.2 | D | ⚪ inconnu |
| 288 | Povoa | 1 | 0-0-1 | 0% | 31.9 | 32.2 | -0.2 | D | ⚪ inconnu |
| 289 | Chekhovskiye Medvedi | 1 | 0-0-1 | 0% | 29.4 | 29.7 | -0.2 | D | ⚪ inconnu |
| 290 | Zeleznicar Jug | 1 | 0-0-1 | 0% | 29.9 | 30.2 | -0.2 | D | ⚪ inconnu |
| 291 | Hallby | 1 | 0-0-1 | 0% | 28.7 | 28.9 | -0.2 | D | ⚪ inconnu |
| 292 | Hammarby | 1 | 0-0-1 | 0% | 29.4 | 29.7 | -0.2 | D | ⚪ inconnu |
| 293 | Drott Halmstad W | 1 | 0-0-1 | 0% | 28.7 | 28.9 | -0.2 | D | ⚪ inconnu |
| 294 | Poland W | 1 | 0-0-1 | 0% | 29.7 | 29.9 | -0.2 | D | ⚪ inconnu |
| 295 | A.S.E. Douka | 1 | 0-0-1 | 0% | 29.7 | 29.9 | -0.2 | D | ⚪ inconnu |
| 296 | Stal Mielec | 1 | 0-0-1 | 0% | 29.4 | 29.7 | -0.2 | D | ⚪ inconnu |
| 297 | Esch | 1 | 0-0-1 | 0% | 30.7 | 30.9 | -0.2 | D | ⚪ inconnu |
| 298 | TuS Lintfort W | 1 | 0-0-1 | 0% | 31.2 | 31.4 | -0.2 | D | ⚪ inconnu |
| 299 | Asane W | 1 | 0-0-1 | 0% | 28.7 | 28.9 | -0.2 | D | ⚪ inconnu |
| 300 | Byasen 2 W | 1 | 0-0-1 | 0% | 28.7 | 28.9 | -0.2 | D | ⚪ inconnu |
| 301 | Slovan | 1 | 0-0-1 | 0% | 30.9 | 31.2 | -0.2 | D | ⚪ inconnu |
| 302 | Guneysu | 1 | 0-0-1 | 0% | 29.9 | 30.2 | -0.2 | D | ⚪ inconnu |
| 303 | Sesvete | 1 | 0-0-1 | 0% | 30.4 | 30.7 | -0.2 | D | ⚪ inconnu |
| 304 | Bjerringbro W | 1 | 0-0-1 | 0% | 29.9 | 30.2 | -0.2 | D | ⚪ inconnu |
| 305 | Beglais W | 1 | 0-0-1 | 0% | 29.4 | 29.7 | -0.2 | D | ⚪ inconnu |
| 306 | Multi Esens | 1 | 0-0-1 | 0% | 29.9 | 30.2 | -0.2 | D | ⚪ inconnu |
| 307 | Biala Podlaska | 1 | 0-0-1 | 0% | 30.4 | 30.7 | -0.2 | D | ⚪ inconnu |
| 308 | Czersk | 1 | 0-0-1 | 0% | 29.4 | 29.7 | -0.2 | D | ⚪ inconnu |
| 309 | Pietrowice Wielkie W | 1 | 0-0-1 | 0% | 28.2 | 28.4 | -0.2 | D | ⚪ inconnu |
| 310 | ZPRP Kielce | 1 | 0-0-1 | 0% | 30.4 | 30.7 | -0.2 | D | ⚪ inconnu |
| 311 | Nimes | 3 | 2-0-1 | 66.7% | 31.6 | 31.9 | -0.3 | VDV | 🟢 fort |
| 312 | Tikvesh (Mkd) | 2 | 1-0-1 | 50% | 30.1 | 30.5 | -0.4 | DV | 🟡 moyen |
| 313 | PSV Handbal W | 2 | 1-0-1 | 50% | 30.5 | 30.9 | -0.4 | VD | 🟡 moyen |
| 314 | Puerto Sagunto | 2 | 1-0-1 | 50% | 30.7 | 31.1 | -0.4 | VD | 🟡 moyen |
| 315 | Kehra | 1 | 0-0-1 | 0% | 29.9 | 30.4 | -0.5 | D | ⚪ inconnu |
| 316 | Conversano | 1 | 0-0-1 | 0% | 29.4 | 29.9 | -0.5 | D | ⚪ inconnu |
| 317 | Naerbo | 1 | 0-0-1 | 0% | 31.7 | 32.2 | -0.5 | D | ⚪ inconnu |
| 318 | Sydhavsoerne | 1 | 0-0-1 | 0% | 30.7 | 31.2 | -0.5 | D | ⚪ inconnu |
| 319 | Odense W | 1 | 0-0-1 | 0% | 29.4 | 29.9 | -0.5 | D | ⚪ inconnu |
| 320 | Konjuh Zivinice | 1 | 0-0-1 | 0% | 28.7 | 29.2 | -0.5 | D | ⚪ inconnu |
| 321 | Konjuh Zivinice (Bih) | 1 | 0-0-1 | 0% | 28.7 | 29.2 | -0.5 | D | ⚪ inconnu |
| 322 | Tumba | 1 | 0-0-1 | 0% | 29.2 | 29.7 | -0.5 | D | ⚪ inconnu |
| 323 | Geneve W | 1 | 0-0-1 | 0% | 29.9 | 30.4 | -0.5 | D | ⚪ inconnu |
| 324 | Fuchse | 1 | 0-0-1 | 0% | 28.9 | 29.4 | -0.5 | D | ⚪ inconnu |
| 325 | Alpla Hard (Aut) | 1 | 0-0-1 | 0% | 30.7 | 31.2 | -0.5 | D | ⚪ inconnu |
| 326 | Brno (Cze) | 1 | 0-0-1 | 0% | 28.4 | 28.9 | -0.5 | D | ⚪ inconnu |
| 327 | Nimes W | 1 | 0-0-1 | 0% | 29.9 | 30.4 | -0.5 | D | ⚪ inconnu |
| 328 | Metzingen W | 1 | 0-0-1 | 0% | 30.9 | 31.4 | -0.5 | D | ⚪ inconnu |
| 329 | Budai Farkasok | 1 | 0-0-1 | 0% | 29.4 | 29.9 | -0.5 | D | ⚪ inconnu |
| 330 | Bydgoszcz | 1 | 0-0-1 | 0% | 30.9 | 31.4 | -0.5 | D | ⚪ inconnu |
| 331 | Ruda Slaska | 1 | 0-0-1 | 0% | 29.7 | 30.2 | -0.5 | D | ⚪ inconnu |
| 332 | Juvelis W | 1 | 0-0-1 | 0% | 27.9 | 28.4 | -0.5 | D | ⚪ inconnu |
| 333 | Besancon | 1 | 0-0-1 | 0% | 31.2 | 31.7 | -0.5 | D | ⚪ inconnu |
| 334 | Pontault | 1 | 0-0-1 | 0% | 29.9 | 30.4 | -0.5 | D | ⚪ inconnu |
| 335 | Handball Warszawa W | 1 | 0-0-1 | 0% | 30.4 | 30.9 | -0.5 | D | ⚪ inconnu |
| 336 | Hannover-Burgdorf | 6 | 3-1-2 | 50% | 29.5 | 30.1 | -0.6 | NVDVD | 🟡 moyen |
| 337 | Arendal | 2 | 0-0-2 | 0% | 30.9 | 31.5 | -0.6 | DD | 🔴 faible |
| 338 | Elbflorenz | 2 | 0-0-2 | 0% | 31.1 | 31.7 | -0.6 | DD | 🔴 faible |
| 339 | Horneo Alicante | 2 | 1-0-1 | 50% | 30.3 | 30.9 | -0.6 | VD | 🟡 moyen |
| 340 | Rhein-Neckar | 6 | 2-0-4 | 33.3% | 29.4 | 30.1 | -0.7 | DVVDD | 🔴 faible |
| 341 | Toulouse | 3 | 0-0-3 | 0% | 28.4 | 29.1 | -0.7 | DDD | 🔴 faible |
| 342 | Aklimat Ptuj W | 1 | 0-0-1 | 0% | 29.7 | 30.4 | -0.7 | D | ⚪ inconnu |
| 343 | Ribe-Esbjerg | 1 | 0-0-1 | 0% | 29.2 | 29.9 | -0.7 | D | ⚪ inconnu |
| 344 | Charlottenlund | 1 | 0-0-1 | 0% | 28.4 | 29.2 | -0.7 | D | ⚪ inconnu |
| 345 | SKP Bratislava | 1 | 0-0-1 | 0% | 27.9 | 28.7 | -0.7 | D | ⚪ inconnu |
| 346 | Frydek-Mistek | 1 | 0-0-1 | 0% | 28.7 | 29.4 | -0.7 | D | ⚪ inconnu |
| 347 | UMCS Lublin W | 1 | 0-0-1 | 0% | 28.4 | 29.2 | -0.7 | D | ⚪ inconnu |
| 348 | Gorenje | 1 | 0-0-1 | 0% | 29.4 | 30.2 | -0.7 | D | ⚪ inconnu |
| 349 | Savehof W | 1 | 0-0-1 | 0% | 30.2 | 30.9 | -0.7 | D | ⚪ inconnu |
| 350 | Ardiaei | 1 | 0-0-1 | 0% | 29.2 | 29.9 | -0.7 | D | ⚪ inconnu |
| 351 | Split 2010 W | 1 | 0-0-1 | 0% | 28.7 | 29.4 | -0.7 | D | ⚪ inconnu |
| 352 | Sola W (Nor) | 1 | 0-0-1 | 0% | 28.9 | 29.7 | -0.7 | D | ⚪ inconnu |
| 353 | Waiblingen W | 1 | 0-0-1 | 0% | 28.2 | 28.9 | -0.7 | D | ⚪ inconnu |
| 354 | Houten | 1 | 0-0-1 | 0% | 29.7 | 30.4 | -0.7 | D | ⚪ inconnu |
| 355 | VOC Amsterdam W | 1 | 0-0-1 | 0% | 32.4 | 33.2 | -0.7 | D | ⚪ inconnu |
| 356 | Westlandia W | 1 | 0-0-1 | 0% | 29.2 | 29.9 | -0.7 | D | ⚪ inconnu |
| 357 | West | 1 | 0-0-1 | 0% | 29.4 | 30.2 | -0.7 | D | ⚪ inconnu |
| 358 | Muotathal | 1 | 0-0-1 | 0% | 29.7 | 30.4 | -0.7 | D | ⚪ inconnu |
| 359 | Raekker Molle | 1 | 0-0-1 | 0% | 29.7 | 30.4 | -0.7 | D | ⚪ inconnu |
| 360 | Stuttgart | 6 | 2-1-3 | 33.3% | 30 | 30.7 | -0.8 | NDDVD | 🔴 faible |
| 361 | Din. Bucuresti | 2 | 0-1-1 | 0% | 27.7 | 28.5 | -0.8 | DN | 🔴 faible |
| 362 | Ademar | 2 | 0-0-2 | 0% | 32.1 | 32.9 | -0.8 | DD | 🔴 faible |
| 363 | Ringsted | 2 | 0-0-2 | 0% | 31.1 | 32.1 | -1 | DD | 🔴 faible |
| 364 | Atlas | 1 | 0-0-1 | 0% | 30.4 | 31.4 | -1 | D | ⚪ inconnu |
| 365 | Eisenach | 6 | 1-1-4 | 16.7% | 30.1 | 31.1 | -1 | DNVDD | 🔴 faible |
| 366 | Molteno | 2 | 0-0-2 | 0% | 29.5 | 30.5 | -1 | DD | 🔴 faible |
| 367 | Fyllingen | 1 | 0-0-1 | 0% | 28.9 | 29.9 | -1 | D | ⚪ inconnu |
| 368 | Trebisov | 1 | 0-0-1 | 0% | 29.4 | 30.4 | -1 | D | ⚪ inconnu |
| 369 | Onnereds | 1 | 0-0-1 | 0% | 29.2 | 30.2 | -1 | D | ⚪ inconnu |
| 370 | Hamburg | 6 | 1-1-4 | 16.7% | 30.5 | 31.5 | -1 | NDDDV | 🔴 faible |
| 371 | Rodovre W | 1 | 0-0-1 | 0% | 27.7 | 28.7 | -1 | D | ⚪ inconnu |
| 372 | Morrazo Cangas | 2 | 0-0-2 | 0% | 31.3 | 32.3 | -1 | DD | 🔴 faible |
| 373 | Vaci W | 1 | 0-0-1 | 0% | 30.9 | 31.9 | -1 | D | ⚪ inconnu |
| 374 | Rennes W | 1 | 0-0-1 | 0% | 31.4 | 32.4 | -1 | D | ⚪ inconnu |
| 375 | Cisne | 1 | 0-0-1 | 0% | 29.4 | 30.4 | -1 | D | ⚪ inconnu |
| 376 | OAR Coruna | 1 | 0-0-1 | 0% | 30.4 | 31.4 | -1 | D | ⚪ inconnu |
| 377 | Eszterhazy W | 1 | 0-0-1 | 0% | 29.2 | 30.2 | -1 | D | ⚪ inconnu |
| 378 | Cesson Rennes-Metropole | 3 | 1-0-2 | 33.3% | 29.3 | 30.4 | -1.2 | DDV | 🔴 faible |
| 379 | Nordsjaelland | 2 | 0-0-2 | 0% | 30.3 | 31.5 | -1.2 | DD | 🔴 faible |
| 380 | Aguas Santas | 2 | 0-0-2 | 0% | 29.3 | 30.5 | -1.2 | DD | 🔴 faible |
| 381 | Steaua Bucuresti | 1 | 0-0-1 | 0% | 29.4 | 30.7 | -1.2 | D | ⚪ inconnu |
| 382 | Akilles | 1 | 0-0-1 | 0% | 30.2 | 31.4 | -1.2 | D | ⚪ inconnu |
| 383 | Zilant Kazan | 1 | 0-0-1 | 0% | 29.4 | 30.7 | -1.2 | D | ⚪ inconnu |
| 384 | Modra | 1 | 0-0-1 | 0% | 30.4 | 31.7 | -1.2 | D | ⚪ inconnu |
| 385 | Malmo | 1 | 0-0-1 | 0% | 29.9 | 31.2 | -1.2 | D | ⚪ inconnu |
| 386 | St. Gallen | 1 | 0-0-1 | 0% | 29.4 | 30.7 | -1.2 | D | ⚪ inconnu |
| 387 | Giresunspor | 1 | 0-0-1 | 0% | 30.9 | 32.2 | -1.2 | D | ⚪ inconnu |
| 388 | Osijek | 1 | 0-0-1 | 0% | 28.9 | 30.2 | -1.2 | D | ⚪ inconnu |
| 389 | Blomberg-Lippe W | 1 | 0-0-1 | 0% | 29.2 | 30.4 | -1.2 | D | ⚪ inconnu |
| 390 | Buducnost W | 1 | 0-0-1 | 0% | 28.2 | 29.4 | -1.2 | D | ⚪ inconnu |
| 391 | Sprimont | 1 | 0-0-1 | 0% | 29.9 | 31.2 | -1.2 | D | ⚪ inconnu |
| 392 | Buducnost W (Mne) | 1 | 0-0-1 | 0% | 28.2 | 29.4 | -1.2 | D | ⚪ inconnu |
| 393 | Sprimont (Bel) | 1 | 0-0-1 | 0% | 29.9 | 31.2 | -1.2 | D | ⚪ inconnu |
| 394 | Eger | 1 | 0-0-1 | 0% | 29.7 | 30.9 | -1.2 | D | ⚪ inconnu |
| 395 | Byasen W | 1 | 0-0-1 | 0% | 31.2 | 32.4 | -1.2 | D | ⚪ inconnu |
| 396 | Gjovik W | 1 | 0-0-1 | 0% | 28.2 | 29.4 | -1.2 | D | ⚪ inconnu |
| 397 | Servette | 1 | 0-0-1 | 0% | 28.4 | 29.7 | -1.2 | D | ⚪ inconnu |
| 398 | Karlovac | 1 | 0-0-1 | 0% | 29.4 | 30.7 | -1.2 | D | ⚪ inconnu |
| 399 | Arnhem (Ned) | 1 | 0-0-1 | 0% | 31.7 | 32.9 | -1.2 | D | ⚪ inconnu |
| 400 | Buxtehuder SV W | 1 | 0-0-1 | 0% | 28.9 | 30.2 | -1.2 | D | ⚪ inconnu |
| 401 | Grotta W | 1 | 0-0-1 | 0% | 29.4 | 30.7 | -1.2 | D | ⚪ inconnu |
| 402 | Ferrara W | 1 | 0-0-1 | 0% | 28.9 | 30.2 | -1.2 | D | ⚪ inconnu |
| 403 | KRAS/Volendam W | 1 | 0-0-1 | 0% | 28.4 | 29.7 | -1.2 | D | ⚪ inconnu |
| 404 | Feirense W | 1 | 0-0-1 | 0% | 29.2 | 30.4 | -1.2 | D | ⚪ inconnu |
| 405 | Olimpija W | 1 | 0-0-1 | 0% | 28.4 | 29.7 | -1.2 | D | ⚪ inconnu |
| 406 | Goztepe W | 1 | 0-0-1 | 0% | 29.9 | 31.2 | -1.2 | D | ⚪ inconnu |
| 407 | EH Aalborg W | 1 | 0-0-1 | 0% | 29.2 | 30.4 | -1.2 | D | ⚪ inconnu |
| 408 | Frontignan | 1 | 0-0-1 | 0% | 29.7 | 30.9 | -1.2 | D | ⚪ inconnu |
| 409 | Olkusz W | 1 | 0-0-1 | 0% | 29.4 | 30.7 | -1.2 | D | ⚪ inconnu |
| 410 | HC Kriens | 4 | 1-0-3 | 25% | 32.2 | 33.5 | -1.3 | DDDV | 🔴 faible |
| 411 | Lemgo | 5 | 2-0-3 | 40% | 30.3 | 31.7 | -1.4 | DVVDD | 🟡 moyen |
| 412 | Proin Sevilla | 2 | 0-0-2 | 0% | 29.5 | 30.9 | -1.4 | DD | 🔴 faible |
| 413 | Partizan | 3 | 1-0-2 | 33.3% | 31.1 | 32.6 | -1.5 | DDV | 🔴 faible |
| 414 | Luch W | 1 | 0-0-1 | 0% | 28.7 | 30.2 | -1.5 | D | ⚪ inconnu |
| 415 | Cingoli | 1 | 0-0-1 | 0% | 29.4 | 30.9 | -1.5 | D | ⚪ inconnu |
| 416 | Berchem | 1 | 0-0-1 | 0% | 29.4 | 30.9 | -1.5 | D | ⚪ inconnu |
| 417 | Karlskrona | 1 | 0-0-1 | 0% | 29.7 | 31.2 | -1.5 | D | ⚪ inconnu |
| 418 | Drott | 1 | 0-0-1 | 0% | 27.9 | 29.4 | -1.5 | D | ⚪ inconnu |
| 419 | Pancevo | 1 | 0-0-1 | 0% | 29.9 | 31.4 | -1.5 | D | ⚪ inconnu |
| 420 | Jugovic | 1 | 0-0-1 | 0% | 29.4 | 30.9 | -1.5 | D | ⚪ inconnu |
| 421 | Nexe | 1 | 0-0-1 | 0% | 29.9 | 31.4 | -1.5 | D | ⚪ inconnu |
| 422 | N-Lubbecke | 1 | 0-0-1 | 0% | 28.7 | 30.2 | -1.5 | D | ⚪ inconnu |
| 423 | Provence Aix | 3 | 1-0-2 | 33.3% | 30.1 | 31.6 | -1.5 | VDD | 🔴 faible |
| 424 | Volda W | 1 | 0-0-1 | 0% | 28.9 | 30.4 | -1.5 | D | ⚪ inconnu |
| 425 | Pabianice | 1 | 0-0-1 | 0% | 28.4 | 29.9 | -1.5 | D | ⚪ inconnu |
| 426 | Seetal W | 1 | 0-0-1 | 0% | 29.2 | 30.7 | -1.5 | D | ⚪ inconnu |
| 427 | Atzgersdorf | 1 | 0-0-1 | 0% | 29.9 | 31.4 | -1.5 | D | ⚪ inconnu |
| 428 | Krim W (Slo) | 1 | 0-0-1 | 0% | 30.4 | 31.9 | -1.5 | D | ⚪ inconnu |
| 429 | Hurry-Up (Ned) | 1 | 0-0-1 | 0% | 29.2 | 30.7 | -1.5 | D | ⚪ inconnu |
| 430 | Quintus W | 1 | 0-0-1 | 0% | 28.2 | 29.7 | -1.5 | D | ⚪ inconnu |
| 431 | Muri | 1 | 0-0-1 | 0% | 29.9 | 31.4 | -1.5 | D | ⚪ inconnu |
| 432 | Odunpazari W | 1 | 0-0-1 | 0% | 28.4 | 29.9 | -1.5 | D | ⚪ inconnu |
| 433 | Saintes | 1 | 0-0-1 | 0% | 29.2 | 30.7 | -1.5 | D | ⚪ inconnu |
| 434 | Tremblay | 3 | 1-0-2 | 33.3% | 30.8 | 32.3 | -1.5 | DDV | 🔴 faible |
| 435 | Iran | 4 | 1-1-2 | 25% | 27 | 28.5 | -1.6 | DDNV | 🔴 faible |
| 436 | Santo Tirso | 2 | 0-0-2 | 0% | 28.9 | 30.5 | -1.6 | DD | 🔴 faible |
| 437 | Villa de Aranda | 2 | 0-1-1 | 0% | 29.3 | 30.9 | -1.6 | ND | 🔴 faible |
| 438 | St. Raphael | 3 | 1-0-2 | 33.3% | 29.6 | 31.3 | -1.7 | DVD | 🔴 faible |
| 439 | Voslauer | 1 | 0-0-1 | 0% | 29.4 | 31.2 | -1.7 | D | ⚪ inconnu |
| 440 | Essen | 1 | 0-0-1 | 0% | 28.9 | 30.7 | -1.7 | D | ⚪ inconnu |
| 441 | Drama | 1 | 0-0-1 | 0% | 29.4 | 31.2 | -1.7 | D | ⚪ inconnu |
| 442 | Pfadi Winterthur | 1 | 0-0-1 | 0% | 29.7 | 31.4 | -1.7 | D | ⚪ inconnu |
| 443 | Koprivnice | 1 | 0-0-1 | 0% | 28.2 | 29.9 | -1.7 | D | ⚪ inconnu |
| 444 | AGF | 1 | 0-0-1 | 0% | 27.9 | 29.7 | -1.7 | D | ⚪ inconnu |
| 445 | Huddinge | 1 | 0-0-1 | 0% | 28.9 | 30.7 | -1.7 | D | ⚪ inconnu |
| 446 | St. Polten W | 1 | 0-0-1 | 0% | 26.7 | 28.4 | -1.7 | D | ⚪ inconnu |
| 447 | Koka W | 1 | 0-0-1 | 0% | 28.7 | 30.4 | -1.7 | D | ⚪ inconnu |
| 448 | Varhaug | 1 | 0-0-1 | 0% | 30.2 | 31.9 | -1.7 | D | ⚪ inconnu |
| 449 | Fyllingen W | 1 | 0-0-1 | 0% | 28.7 | 30.4 | -1.7 | D | ⚪ inconnu |
| 450 | Gryfino | 1 | 0-0-1 | 0% | 29.4 | 31.2 | -1.7 | D | ⚪ inconnu |
| 451 | Rotweiss Thun W | 1 | 0-0-1 | 0% | 27.7 | 29.4 | -1.7 | D | ⚪ inconnu |
| 452 | Koszalin W | 2 | 0-0-2 | 0% | 29.3 | 31.1 | -1.8 | DD | 🔴 faible |
| 453 | Celje | 3 | 1-0-2 | 33.3% | 29.9 | 31.8 | -1.8 | DDV | 🔴 faible |
| 454 | La Rioja | 2 | 1-0-1 | 50% | 31.1 | 33.1 | -2 | DV | 🟡 moyen |
| 455 | Fram | 1 | 0-0-1 | 0% | 29.9 | 31.9 | -2 | D | ⚪ inconnu |
| 456 | Selfoss | 1 | 0-0-1 | 0% | 31.2 | 33.2 | -2 | D | ⚪ inconnu |
| 457 | Serbia W | 1 | 0-0-1 | 0% | 27.9 | 29.9 | -2 | D | ⚪ inconnu |
| 458 | Grindsted | 1 | 0-0-1 | 0% | 30.2 | 32.2 | -2 | D | ⚪ inconnu |
| 459 | Longericher | 1 | 0-0-1 | 0% | 30.7 | 32.7 | -2 | D | ⚪ inconnu |
| 460 | Kaustik | 1 | 0-0-1 | 0% | 30.2 | 32.2 | -2 | D | ⚪ inconnu |
| 461 | Zurich | 2 | 0-0-2 | 0% | 32.1 | 34.1 | -2 | DD | 🔴 faible |
| 462 | Czech Republic W | 1 | 0-0-1 | 0% | 30.2 | 32.2 | -2 | D | ⚪ inconnu |
| 463 | Caen | 3 | 2-0-1 | 66.7% | 28.6 | 30.6 | -2 | VVD | 🟢 fort |
| 464 | Dunkerque | 3 | 0-0-3 | 0% | 28.1 | 30.1 | -2 | DDD | 🔴 faible |
| 465 | Sandnes | 1 | 0-0-1 | 0% | 28.2 | 30.2 | -2 | D | ⚪ inconnu |
| 466 | Feldkirch W | 1 | 0-0-1 | 0% | 28.9 | 30.9 | -2 | D | ⚪ inconnu |
| 467 | Zlin W | 1 | 0-0-1 | 0% | 28.4 | 30.4 | -2 | D | ⚪ inconnu |
| 468 | Rumelange | 1 | 0-0-1 | 0% | 29.7 | 31.7 | -2 | D | ⚪ inconnu |
| 469 | PSV Handbal | 1 | 0-0-1 | 0% | 29.9 | 31.9 | -2 | D | ⚪ inconnu |
| 470 | Struga | 1 | 0-0-1 | 0% | 28.9 | 30.9 | -2 | D | ⚪ inconnu |
| 471 | Donbas Mariupol | 1 | 0-0-1 | 0% | 30.7 | 32.7 | -2 | D | ⚪ inconnu |
| 472 | GOG | 3 | 1-0-2 | 33.3% | 32.1 | 34.3 | -2.2 | DVD | 🔴 faible |
| 473 | Dynamo Sungul | 2 | 0-0-2 | 0% | 26.9 | 29.1 | -2.2 | DD | 🔴 faible |
| 474 | Haenna | 2 | 0-0-2 | 0% | 27.7 | 29.9 | -2.2 | DD | 🔴 faible |
| 475 | Puente Genil | 2 | 1-0-1 | 50% | 29.7 | 31.9 | -2.2 | VD | 🟡 moyen |
| 476 | Celje W | 1 | 0-0-1 | 0% | 29.7 | 31.9 | -2.2 | D | ⚪ inconnu |
| 477 | Brno | 1 | 0-0-1 | 0% | 27.4 | 29.7 | -2.2 | D | ⚪ inconnu |
| 478 | Zamet W | 1 | 0-0-1 | 0% | 27.7 | 29.9 | -2.2 | D | ⚪ inconnu |
| 479 | Wejherowo | 1 | 0-0-1 | 0% | 31.9 | 34.2 | -2.2 | D | ⚪ inconnu |
| 480 | Kobierzyce II W | 1 | 0-0-1 | 0% | 28.7 | 30.9 | -2.2 | D | ⚪ inconnu |
| 481 | Visp | 1 | 0-0-1 | 0% | 29.4 | 31.7 | -2.2 | D | ⚪ inconnu |
| 482 | Rostocker W | 1 | 0-0-1 | 0% | 28.9 | 31.2 | -2.2 | D | ⚪ inconnu |
| 483 | Butel Skopje | 1 | 0-0-1 | 0% | 30.7 | 32.9 | -2.2 | D | ⚪ inconnu |
| 484 | Gwardia Koszalin | 1 | 0-0-1 | 0% | 28.4 | 30.7 | -2.2 | D | ⚪ inconnu |
| 485 | Koge | 1 | 0-0-1 | 0% | 27.7 | 29.9 | -2.2 | D | ⚪ inconnu |
| 486 | Hapoel Arad | 1 | 0-0-1 | 0% | 29.9 | 32.2 | -2.2 | D | ⚪ inconnu |
| 487 | Lund | 1 | 0-0-1 | 0% | 28.4 | 30.7 | -2.2 | D | ⚪ inconnu |
| 488 | Bergischer | 5 | 0-0-5 | 0% | 28.6 | 31 | -2.4 | DDDDD | 🔴 faible |
| 489 | Los Angeles | 2 | 1-0-1 | 50% | 27.1 | 29.5 | -2.4 | DV | 🟡 moyen |
| 490 | Follo | 2 | 0-0-2 | 0% | 28.9 | 31.3 | -2.4 | DD | 🔴 faible |
| 491 | Fjellhammer | 2 | 0-0-2 | 0% | 27.1 | 29.5 | -2.4 | DD | 🔴 faible |
| 492 | Vietnam W | 3 | 0-0-3 | 0% | 26.6 | 29.1 | -2.5 | DDD | 🔴 faible |
| 493 | Saratov | 1 | 0-0-1 | 0% | 29.7 | 32.2 | -2.5 | D | ⚪ inconnu |
| 494 | Dessauer | 1 | 0-0-1 | 0% | 29.7 | 32.2 | -2.5 | D | ⚪ inconnu |
| 495 | Coburg 2000 | 1 | 0-0-1 | 0% | 29.2 | 31.7 | -2.5 | D | ⚪ inconnu |
| 496 | Skovde | 1 | 0-0-1 | 0% | 29.2 | 31.7 | -2.5 | D | ⚪ inconnu |
| 497 | Handball Stafa | 1 | 0-0-1 | 0% | 27.9 | 30.4 | -2.5 | D | ⚪ inconnu |
| 498 | Viimsi/Alexela | 1 | 0-0-1 | 0% | 28.7 | 31.2 | -2.5 | D | ⚪ inconnu |
| 499 | Kolding | 1 | 0-0-1 | 0% | 29.2 | 31.7 | -2.5 | D | ⚪ inconnu |
| 500 | Krems-Langenlois W | 1 | 0-0-1 | 0% | 29.7 | 32.2 | -2.5 | D | ⚪ inconnu |
| 501 | BGUFK-SKA | 1 | 0-0-1 | 0% | 29.9 | 32.4 | -2.5 | D | ⚪ inconnu |
| 502 | Storhamar W | 1 | 0-0-1 | 0% | 27.7 | 30.2 | -2.5 | D | ⚪ inconnu |
| 503 | Storhamar W (Nor) | 1 | 0-0-1 | 0% | 27.7 | 30.2 | -2.5 | D | ⚪ inconnu |
| 504 | Pogon Szczecin W | 1 | 0-0-1 | 0% | 27.4 | 29.9 | -2.5 | D | ⚪ inconnu |
| 505 | Dinamo-Sinara W | 1 | 0-0-1 | 0% | 28.4 | 30.9 | -2.5 | D | ⚪ inconnu |
| 506 | Bietigheim-Metterzimmern | 6 | 1-0-5 | 16.7% | 29.9 | 32.4 | -2.6 | DDDDD | 🔴 faible |
| 507 | Kolstad | 4 | 2-0-2 | 50% | 29.2 | 32 | -2.7 | DDVV | 🟡 moyen |
| 508 | Pinheiros | 1 | 0-0-1 | 0% | 30.9 | 33.7 | -2.7 | D | ⚪ inconnu |
| 509 | Wabrzezno W | 1 | 0-0-1 | 0% | 28.4 | 31.2 | -2.7 | D | ⚪ inconnu |
| 510 | Geneve | 1 | 0-0-1 | 0% | 29.4 | 32.2 | -2.7 | D | ⚪ inconnu |
| 511 | Podravka W (Cro) | 1 | 0-0-1 | 0% | 28.7 | 31.4 | -2.7 | D | ⚪ inconnu |
| 512 | Stella St. Maur W | 1 | 0-0-1 | 0% | 29.9 | 32.7 | -2.7 | D | ⚪ inconnu |
| 513 | Dynamico | 1 | 0-0-1 | 0% | 28.4 | 31.2 | -2.7 | D | ⚪ inconnu |
| 514 | SMS ZPRP Lublin W | 1 | 0-0-1 | 0% | 27.4 | 30.2 | -2.7 | D | ⚪ inconnu |
| 515 | Pinheiros (Bra) | 1 | 0-0-1 | 0% | 30.9 | 33.7 | -2.7 | D | ⚪ inconnu |
| 516 | HSG Wetzlar | 6 | 0-1-5 | 0% | 30.3 | 33.3 | -3 | DNDDD | 🔴 faible |
| 517 | Zahoraci | 1 | 0-0-1 | 0% | 29.4 | 32.4 | -3 | D | ⚪ inconnu |
| 518 | Omonoia | 1 | 0-0-1 | 0% | 27.4 | 30.4 | -3 | D | ⚪ inconnu |
| 519 | Utleira W | 1 | 0-0-1 | 0% | 28.7 | 31.7 | -3 | D | ⚪ inconnu |
| 520 | Plzen W | 1 | 0-0-1 | 0% | 27.9 | 30.9 | -3 | D | ⚪ inconnu |
| 521 | Venlo W | 1 | 0-0-1 | 0% | 30.9 | 33.9 | -3 | D | ⚪ inconnu |
| 522 | Draguignan Var | 1 | 0-0-1 | 0% | 28.2 | 31.2 | -3 | D | ⚪ inconnu |
| 523 | Kristianstad | 3 | 1-0-2 | 33.3% | 29.8 | 32.8 | -3 | DDV | 🔴 faible |
| 524 | Wybrzeze Gdansk II | 1 | 0-0-1 | 0% | 29.2 | 32.4 | -3.2 | D | ⚪ inconnu |
| 525 | Athinaikos | 1 | 0-0-1 | 0% | 28.4 | 31.7 | -3.2 | D | ⚪ inconnu |
| 526 | Stavropol | 2 | 0-0-2 | 0% | 27.9 | 31.3 | -3.4 | DD | 🔴 faible |
| 527 | Strakonice | 2 | 0-0-2 | 0% | 29.7 | 33.3 | -3.6 | DD | 🔴 faible |
| 528 | Alisa Ufa W | 2 | 0-0-2 | 0% | 27.7 | 31.3 | -3.6 | DD | 🔴 faible |
| 529 | Varenos | 1 | 0-0-1 | 0% | 27.7 | 31.4 | -3.7 | D | ⚪ inconnu |
| 530 | Strzalkowo | 1 | 0-0-1 | 0% | 29.9 | 33.7 | -3.7 | D | ⚪ inconnu |
| 531 | Aargau Ost W | 1 | 0-0-1 | 0% | 28.4 | 32.2 | -3.7 | D | ⚪ inconnu |
| 532 | Avanca | 2 | 0-0-2 | 0% | 27.3 | 31.1 | -3.8 | DD | 🔴 faible |
| 533 | Chartres | 3 | 1-0-2 | 33.3% | 28.9 | 32.8 | -3.8 | DVD | 🔴 faible |
| 534 | Skanderborg AGF | 3 | 0-1-2 | 0% | 28.1 | 32.1 | -4 | DND | 🔴 faible |
| 535 | Belenenses | 1 | 0-0-1 | 0% | 29.4 | 33.4 | -4 | D | ⚪ inconnu |
| 536 | Carvalhos | 1 | 0-0-1 | 0% | 28.7 | 32.7 | -4 | D | ⚪ inconnu |
| 537 | Ferencvaros | 1 | 0-0-1 | 0% | 29.2 | 33.2 | -4 | D | ⚪ inconnu |
| 538 | Huttenberg | 2 | 0-0-2 | 0% | 28.3 | 32.5 | -4.2 | DD | 🔴 faible |
| 539 | Budvanska | 1 | 0-0-1 | 0% | 29.4 | 33.7 | -4.2 | D | ⚪ inconnu |
| 540 | MMTS Kwidzyn | 1 | 0-0-1 | 0% | 28.2 | 32.4 | -4.2 | D | ⚪ inconnu |
| 541 | Tiller | 1 | 0-0-1 | 0% | 28.4 | 32.7 | -4.2 | D | ⚪ inconnu |
| 542 | Kragero IF | 1 | 0-0-1 | 0% | 28.7 | 32.9 | -4.2 | D | ⚪ inconnu |
| 543 | Dicken Akademi | 1 | 0-0-1 | 0% | 30.2 | 34.7 | -4.5 | D | ⚪ inconnu |
| 544 | Kazakhstan W | 5 | 2-0-3 | 40% | 27.5 | 32.2 | -4.7 | DDVVD | 🔴 faible |
| 545 | Casalgrande Padana W | 1 | 0-0-1 | 0% | 27.2 | 31.9 | -4.7 | D | ⚪ inconnu |
| 546 | MK Beer Sheva | 1 | 0-0-1 | 0% | 27.7 | 32.4 | -4.7 | D | ⚪ inconnu |
| 547 | Nava | 2 | 0-0-2 | 0% | 26.9 | 31.7 | -4.8 | DD | 🔴 faible |
| 548 | Lillestrom | 2 | 0-0-2 | 0% | 28.5 | 33.3 | -4.8 | DD | 🔴 faible |
| 549 | Kharkiv | 2 | 0-0-2 | 0% | 33.7 | 38.5 | -4.8 | DD | 🔴 faible |
| 550 | Stade Pessacais W | 1 | 0-0-1 | 0% | 27.4 | 32.7 | -5.2 | D | ⚪ inconnu |
| 551 | Vajnory | 1 | 0-0-1 | 0% | 28.2 | 33.7 | -5.5 | D | ⚪ inconnu |
| 552 | Eggenburg W | 1 | 0-0-1 | 0% | 26.9 | 32.7 | -5.7 | D | ⚪ inconnu |
| 553 | Montada | 1 | 0-0-1 | 0% | 26.9 | 33.2 | -6.2 | D | ⚪ inconnu |
| 554 | Montada (Mar) | 1 | 0-0-1 | 0% | 26.9 | 33.2 | -6.2 | D | ⚪ inconnu |
| 555 | Cocks 2 | 1 | 0-0-1 | 0% | 27.2 | 34.4 | -7.2 | D | ⚪ inconnu |
| 556 | Sydney University | 2 | 0-0-2 | 0% | 25.3 | 32.7 | -7.4 | DD | 🔴 faible |
| 557 | Orlik Brzeg | 1 | 0-0-1 | 0% | 26.7 | 34.9 | -8.2 | D | ⚪ inconnu |
| 558 | Hong Kong W | 4 | 1-0-3 | 25% | 25.1 | 33.5 | -8.4 | DVDD | 🔴 faible |
| 559 | Hong Kong | 3 | 0-0-3 | 0% | 25.1 | 35.4 | -10.3 | DDD | 🔴 faible |
| 560 | Kazakhstan | 4 | 0-0-4 | 0% | 25 | 35.5 | -10.6 | DDDD | 🔴 faible |
| 561 | Uzbekistan W | 4 | 1-0-3 | 25% | 22.7 | 33.5 | -10.9 | DDDV | 🔴 faible |

## 8. Meilleurs buteurs — P(au moins 2 / 3 / 4 / 5 buts)

_Seuil de retenue : P(≥N) ≥ 55 % (colonne Pick = plus grand N qui passe). λ joueur = buts/match de la source, ajusté au rythme attendu du match (λ équipe / moyenne mondiale 30.2, facteur borné 0.75–1.35). Queue de Poisson. Couverture : snapshots HBL (Allemagne) + StarLigue (France) uniquement._

| Date | Match | Équipe | Meilleur buteur | Buts/m (src) | λ ajusté | P(≥2) | P(≥3) | P(≥4) | P(≥5) | Pick ≥55 % | Suivi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 09-25 17:30 | Barnbach/K. vs Fuchse | **Fuchse** | Mathias Gidsel | 8.6 (n=5) | 8.22 | **99.8%** | **98.8%** | **96.4%** | **91.2%** | **5+ (91.2%)** | ❌ |
| 09-25 17:30 | St. Raphael vs Saran | **Saran** | SIMONNET Alban | 4.67 (n=3) | 4.61 | **94.4%** | **83.9%** | **67.6%** | 48.9% | **4+ (67.6%)** | ✅ |
| 09-25 17:30 | St. Raphael vs Saran | **St. Raphael** | MOHAMED Antonin | 5.67 (n=3) | 5.65 | **97.7%** | **92%** | **81.5%** | **66.5%** | **5+ (66.5%)** | ✅ |
| 09-25 17:45 | Burgan (Kuw) vs Fuchse Berlin (Ger) | **Fuchse Berlin (Ger)** | Mathias Gidsel | 8.6 (n=5) | 8.41 | **99.8%** | **99%** | **96.8%** | **92.1%** | **5+ (92.1%)** | ❌ |
| 09-25 18:00 | Chambery Savoie vs Tremblay | **Tremblay** | AVELANGE DEMOUGE Théo | 7.67 (n=3) | 7.64 | **99.6%** | **98.2%** | **94.6%** | **87.8%** | **5+ (87.8%)** | ✅ |
| 09-25 18:00 | Chartres vs Cesson Rennes-Metropole | **Cesson Rennes-Metropole** | MORAN Alex | 5.67 (n=3) | 5.69 | **97.7%** | **92.3%** | **81.9%** | **67.2%** | **5+ (67.2%)** | ✅ |
| 09-25 18:00 | Nimes vs Dunkerque | **Dunkerque** | MINOTSKYI Taras | 7.67 (n=3) | 7.45 | **99.5%** | **97.9%** | **93.9%** | **86.4%** | **5+ (86.4%)** | ✅ |
| 09-25 18:00 | Provence Aix vs Caen | **Caen** | GNAGO Adam | 5.33 (n=3) | 5.19 | **96.6%** | **89%** | **76.1%** | **59.2%** | **5+ (59.2%)** | ✅ |
| 09-25 18:00 | Chambery Savoie vs Tremblay | **Chambery Savoie** | ZAMMIT Elio | 8.33 (n=3) | 8.98 | **99.9%** | **99.4%** | **97.8%** | **94.4%** | **5+ (94.4%)** | ✅ |
| 09-25 18:00 | Chartres vs Cesson Rennes-Metropole | **Chartres** | GARCIAS JOSé Andre | 5 (n=3) | 5.02 | **96%** | **87.7%** | **73.8%** | **56.3%** | **5+ (56.3%)** | ✅ |
| 09-25 18:00 | Nimes vs Dunkerque | **Nimes** | KAMTCHOP BARIL Hugo | 7 (n=3) | 7.3 | **99.4%** | **97.6%** | **93.3%** | **85.3%** | **5+ (85.3%)** | ✅ |
| 09-25 18:00 | Provence Aix vs Caen | **Provence Aix** | BROUZET Hugo | 4.33 (n=3) | 4.44 | **93.6%** | **82%** | **64.8%** | 45.7% | **4+ (64.8%)** | ✅ |
| 09-25 18:30 | Selestat vs Montpellier | **Montpellier** | MONTE Bryan | 5.67 (n=3) | 5.68 | **97.7%** | **92.2%** | **81.8%** | **67%** | **5+ (67%)** | ✅ |
| 09-25 18:30 | Selestat vs Montpellier | **Selestat** | MENDY Tony | 5.33 (n=3) | 5.34 | **96.9%** | **90.1%** | **77.9%** | **61.6%** | **5+ (61.6%)** | ✅ |
| 09-26 14:00 | Dessauer vs Potsdam | **Potsdam** | Tim Niclas Schröder | 6.5 (n=2) | 6.61 | **99%** | **96%** | **89.5%** | **78.8%** | **5+ (78.8%)** | ❌ |
| 09-26 16:00 | Kiel vs Flensburg-H. | **Flensburg-H.** | Emil Jakobsen | 7 (n=5) | 7.08 | **99.3%** | **97.2%** | **92.2%** | **83.4%** | **5+ (83.4%)** | ✅ |
| 09-26 16:00 | Hamm-Westfalen vs Elbflorenz | **Elbflorenz** | Timo Löser | 5 (n=2) | 4.96 | **95.8%** | **87.2%** | **73%** | **55.3%** | **5+ (55.3%)** | ✅ |
| 09-26 16:00 | Kiel vs Flensburg-H. | **Kiel** | Lukas Zerbe | 5.4 (n=5) | 5.82 | **98%** | **92.9%** | **83.2%** | **68.9%** | **5+ (68.9%)** | ✅ |
| 09-26 16:00 | Hamm-Westfalen vs Elbflorenz | **Hamm-Westfalen** | Lucas Firnhaber | 7 (n=1) | 7.33 | **99.5%** | **97.7%** | **93.4%** | **85.5%** | **5+ (85.5%)** | ❌ |
| 09-26 17:00 | Limoges vs PSG | **PSG** | SYPRZAK Kamil | 3.67 (n=3) | 3.62 | **87.6%** | **70%** | 48.8% | 29.7% | **3+ (70%)** | ✅ |
| 09-26 17:00 | Fuchse Berlin vs HBW Balingen-Weilstetten | **HBW Balingen-Weilstetten** | Sascha Pfattheicher | 4.6 (n=5) | 4.61 | **94.4%** | **83.9%** | **67.7%** | 48.9% | **4+ (67.7%)** | ✅ |
| 09-26 17:00 | Limoges vs PSG | **Limoges** | LIGNIèRES Jules | 4.33 (n=3) | 4.48 | **93.8%** | **82.4%** | **65.4%** | 46.4% | **4+ (65.4%)** | ✅ |
| 09-26 17:00 | Fuchse Berlin vs HBW Balingen-Weilstetten | **Fuchse Berlin** | Mathias Gidsel | 8.6 (n=5) | 9.04 | **99.9%** | **99.4%** | **97.9%** | **94.6%** | **5+ (94.6%)** | ✅ |
| 09-26 17:30 | Huttenberg vs Minden | **Minden** | Ian Weber | 4.5 (n=2) | 4.62 | **94.5%** | **84%** | **67.8%** | 49.1% | **4+ (67.8%)** | ✅ |
| 09-26 17:30 | Huttenberg vs Minden | **Huttenberg** | David Kuntscher | 7.5 (n=2) | 7.32 | **99.4%** | **97.7%** | **93.4%** | **85.4%** | **5+ (85.4%)** | ✅ |
| 09-26 18:00 | Rhein-Neckar vs MT Melsungen | **MT Melsungen** | Aaron  Mensing | 5.6 (n=5) | 5.56 | **97.5%** | **91.5%** | **80.5%** | **65.2%** | **5+ (65.2%)** | ✅ |
| 09-26 18:00 | Rhein-Neckar vs MT Melsungen | **Rhein-Neckar** | Dani Baijens | 4.4 (n=5) | 4.37 | **93.2%** | **81.2%** | **63.6%** | 44.3% | **4+ (63.6%)** | ✅ |
| 09-26 18:00 | SC Magdeburg vs Bietigheim-Metterzimmern | **SC Magdeburg** | Felix Claar | 7.4 (n=5) | 8.31 | **99.8%** | **98.9%** | **96.6%** | **91.7%** | **5+ (91.7%)** | ✅ |
| 09-27 13:00 | Hannover-Burgdorf vs Goppingen | **Goppingen** | Elias Newel | 4.8 (n=5) | 4.65 | **94.6%** | **84.3%** | **68.2%** | 49.6% | **4+ (68.2%)** | ✅ |
| 09-27 14:30 | Gummersbach vs Bergischer | **Bergischer** | Fynn Hangstein | 7.2 (n=5) | 6.88 | **99.2%** | **96.8%** | **91.2%** | **81.6%** | **5+ (81.6%)** | ✅ |
| 09-27 14:30 | Gummersbach vs Bergischer | **Gummersbach** | Nikola Roganovic | 7.6 (n=5) | 8.05 | **99.7%** | **98.7%** | **95.9%** | **90.3%** | **5+ (90.3%)** | ✅ |
| 09-27 14:45 | Fuchse Berlin (Ger) vs Veszprem (Hun) | **Fuchse Berlin (Ger)** | Mathias Gidsel | 8.6 (n=5) | 8.79 | **99.9%** | **99.3%** | **97.5%** | **93.7%** | **5+ (93.7%)** | ❌ |
| 09-27 15:00 | Nantes vs Toulouse | **Toulouse** | ILIC Nemanja | 5.67 (n=3) | 5.29 | **96.8%** | **89.8%** | **77.4%** | **60.9%** | **5+ (60.9%)** | ✅ |
| 09-27 15:00 | Emsdetten vs Lubeck-Schwartau | **Lubeck-Schwartau** | Ole Hagedorn | 8.5 (n=2) | 8.65 | **99.8%** | **99.2%** | **97.3%** | **93.2%** | **5+ (93.2%)** | ✅ |
| 09-27 15:00 | Essen vs N-Lubbecke | **N-Lubbecke** | Thies Bergemann | 6 (n=1) | 5.76 | **97.9%** | **92.6%** | **82.6%** | **68.1%** | **5+ (68.1%)** | ❌ |
| 09-27 15:00 | Leipzig vs Dormagen | **Dormagen** | Krischa Leis | 4 (n=1) | 3.99 | **90.8%** | **76%** | **56.4%** | 36.9% | **4+ (56.4%)** | ❌ |
| 09-27 15:00 | Nantes vs Toulouse | **Nantes** | LEOPOLD Noam | 5.67 (n=3) | 5.92 | **98.1%** | **93.4%** | **84.2%** | **70.4%** | **5+ (70.4%)** | ✅ |
| 09-27 15:00 | Emsdetten vs Lubeck-Schwartau | **Emsdetten** | Yannick Terhaer | 5 (n=2) | 5.41 | **97.1%** | **90.6%** | **78.7%** | **62.8%** | **5+ (62.8%)** | ✅ |
| 09-27 15:00 | Essen vs N-Lubbecke | **Essen** | Finley Werschkull | 7 (n=2) | 7 | **99.3%** | **97%** | **91.8%** | **82.7%** | **5+ (82.7%)** | ❌ |
| 09-27 15:00 | Leipzig vs Dormagen | **Leipzig** | Franz Semper | 7 (n=1) | 7.35 | **99.5%** | **97.7%** | **93.5%** | **85.6%** | **5+ (85.6%)** | ❌ |
| 09-27 16:00 | Hamburg vs HSG Wetzlar | **HSG Wetzlar** | Niklas Theiss | 4 (n=5) | 4 | **90.8%** | **76.2%** | **56.6%** | 37.1% | **4+ (56.6%)** | ✅ |
| 09-27 16:00 | Hagen vs Ferndorf | **Ferndorf** | Tom Jansen | 8 (n=1) | 8.04 | **99.7%** | **98.7%** | **95.9%** | **90.3%** | **5+ (90.3%)** | ❌ |
| 09-27 16:00 | Hamburg vs HSG Wetzlar | **Hamburg** | Oliver Norlyk | 3.4 (n=5) | 3.66 | **88%** | **70.8%** | 49.8% | 30.5% | **3+ (70.8%)** | ✅ |
| 09-27 16:00 | Hagen vs Ferndorf | **Hagen** | Pierre Busch | 8 (n=2) | 8.53 | **99.8%** | **99.1%** | **97.1%** | **92.7%** | **5+ (92.7%)** | ✅ |
| 09-28 17:30 | Erlangen vs Eisenach | **Eisenach** | Felix Aellen | 7.6 (n=5) | 7.39 | **99.5%** | **97.8%** | **93.6%** | **86%** | **5+ (86%)** | ✅ |
| 09-28 17:30 | Erlangen vs Eisenach | **Erlangen** | Marek Nissen | 6.6 (n=5) | 6.84 | **99.2%** | **96.7%** | **91%** | **81.2%** | **5+ (81.2%)** | ✅ |
| 09-29 16:45 | Izvidac vs Chambery Savoie | **Chambery Savoie** | ZAMMIT Elio | 8.33 (n=3) | 8.33 | **99.8%** | **98.9%** | **96.6%** | **91.8%** | **5+ (91.8%)** | ✅ |
| 09-29 16:45 | Gummersbach vs Wybrzeze Gdansk | **Gummersbach** | Nikola Roganovic | 7.6 (n=5) | 7.95 | **99.7%** | **98.6%** | **95.6%** | **89.8%** | **5+ (89.8%)** | ✅ |
| 09-29 17:00 | Fuchse Berlin (Ger) vs Al Ahly (Egy) | **Fuchse Berlin (Ger)** | Mathias Gidsel | 8.6 (n=5) | 8.79 | **99.9%** | **99.3%** | **97.5%** | **93.7%** | **5+ (93.7%)** | ❌ |
| 09-29 18:45 | Nexe vs St. Raphael | **St. Raphael** | MOHAMED Antonin | 5.67 (n=3) | 5.6 | **97.6%** | **91.7%** | **80.9%** | **65.7%** | **5+ (65.7%)** | ✅ |
| 09-30 16:00 | Besancon vs Tremblay | **Tremblay** | AVELANGE DEMOUGE Théo | 7.67 (n=3) | 7.75 | **99.6%** | **98.3%** | **95%** | **88.5%** | **5+ (88.5%)** | ✅ |
| 09-30 16:00 | Creteil vs Chartres | **Chartres** | GARCIAS JOSé Andre | 5 (n=3) | 4.74 | **95%** | **85.1%** | **69.6%** | 51.2% | **4+ (69.6%)** | ✅ |
| 09-30 16:00 | Pontault vs Cesson Rennes-Metropole | **Cesson Rennes-Metropole** | MORAN Alex | 5.67 (n=3) | 5.47 | **97.3%** | **91%** | **79.5%** | **63.8%** | **5+ (63.8%)** | ✅ |
| 09-30 16:00 | Saran vs Toulouse | **Toulouse** | ILIC Nemanja | 5.67 (n=3) | 5.29 | **96.8%** | **89.8%** | **77.3%** | **60.9%** | **5+ (60.9%)** | ✅ |
| 09-30 16:00 | Sarrebourg vs Nimes | **Nimes** | KAMTCHOP BARIL Hugo | 7 (n=3) | 7 | **99.3%** | **97%** | **91.8%** | **82.7%** | **5+ (82.7%)** | ✅ |
| 09-30 16:00 | Valence vs Dunkerque | **Dunkerque** | MINOTSKYI Taras | 7.67 (n=3) | 7.23 | **99.4%** | **97.5%** | **93%** | **84.7%** | **5+ (84.7%)** | ✅ |
| 09-30 16:00 | Saran vs Toulouse | **Saran** | SIMONNET Alban | 4.67 (n=3) | 4.65 | **94.6%** | **84.3%** | **68.3%** | 49.7% | **4+ (68.3%)** | ✅ |
| 09-30 16:45 | Flensburg-H. vs Granollers | **Flensburg-H.** | Emil Jakobsen | 7 (n=5) | 7.58 | **99.6%** | **98.1%** | **94.4%** | **87.3%** | **5+ (87.3%)** | ✅ |
| 09-30 17:00 | SC Magdeburg vs Kiel | **Kiel** | Lukas Zerbe | 5.4 (n=5) | 5.45 | **97.2%** | **90.8%** | **79.2%** | **63.4%** | **5+ (63.4%)** | ✅ |
| 09-30 17:00 | SC Magdeburg vs Kiel | **SC Magdeburg** | Felix Claar | 7.4 (n=5) | 7.79 | **99.6%** | **98.4%** | **95.1%** | **88.8%** | **5+ (88.8%)** | ✅ |
| 09-30 17:30 | Ludwigshafen vs Nordhorn-Lingen | **Nordhorn-Lingen** | Tarek Marschall | 10 (n=1) | 9.78 | **99.9%** | **99.7%** | **98.8%** | **96.6%** | **5+ (96.6%)** | ❌ |
| 09-30 17:30 | Ludwigshafen vs Nordhorn-Lingen | **Ludwigshafen** | Friedrich Schmitt | 7 (n=1) | 7.15 | **99.4%** | **97.4%** | **92.6%** | **84.1%** | **5+ (84.1%)** | ❌ |
| 09-30 18:45 | Presov vs Bergischer | **Bergischer** | Fynn Hangstein | 7.2 (n=5) | 6.84 | **99.2%** | **96.7%** | **91%** | **81.2%** | **5+ (81.2%)** | ✅ |
| 09-30 18:45 | Limoges vs Maritimo | **Limoges** | LIGNIèRES Jules | 4.33 (n=3) | 4.61 | **94.4%** | **83.8%** | **67.6%** | 48.8% | **4+ (67.6%)** | ✅ |
| 10-01 17:00 | Eisenach vs Stuttgart | **Stuttgart** | Kai Häfner | 8.2 (n=5) | 8.09 | **99.7%** | **98.7%** | **96%** | **90.6%** | **5+ (90.6%)** | ✅ |
| 10-01 17:00 | Lemgo vs Hamburg | **Hamburg** | Oliver Norlyk | 3.4 (n=5) | 3.42 | **85.6%** | **66.5%** | 44.7% | 26% | **3+ (66.5%)** | ✅ |
| 10-01 17:00 | Eisenach vs Stuttgart | **Eisenach** | Felix Aellen | 7.6 (n=5) | 7.81 | **99.6%** | **98.4%** | **95.2%** | **88.9%** | **5+ (88.9%)** | ✅ |
| 10-01 17:00 | Lemgo vs Hamburg | **Lemgo** | Samuel Zehnder | 4.4 (n=5) | 4.6 | **94.4%** | **83.7%** | **67.4%** | 48.6% | **4+ (67.4%)** | ✅ |
| 10-01 18:00 | Saran vs PSG | **PSG** | SYPRZAK Kamil | 3.67 (n=3) | 3.63 | **87.7%** | **70.2%** | 49.1% | 29.9% | **3+ (70.2%)** | ✅ |
| 10-01 18:00 | Saran vs PSG | **Saran** | SIMONNET Alban | 4.67 (n=3) | 4.65 | **94.6%** | **84.3%** | **68.2%** | 49.6% | **4+ (68.2%)** | ✅ |
| 10-02 17:00 | HSG Wetzlar vs Rhein-Neckar | **Rhein-Neckar** | Dani Baijens | 4.4 (n=5) | 4.46 | **93.7%** | **82.2%** | **65.1%** | 46.1% | **4+ (65.1%)** | ✅ |
| 10-02 17:00 | HSG Wetzlar vs Rhein-Neckar | **HSG Wetzlar** | Niklas Theiss | 4 (n=5) | 4.08 | **91.4%** | **77.4%** | **58.2%** | 38.7% | **4+ (58.2%)** | ✅ |
| 10-02 17:00 | N-Lubbecke vs Coburg 2000 | **N-Lubbecke** | Thies Bergemann | 6 (n=1) | 6.12 | **98.4%** | **94.3%** | **85.9%** | **73.1%** | **5+ (73.1%)** | ❌ |
| 10-02 17:30 | Essen vs Leipzig | **Leipzig** | Franz Semper | 7 (n=1) | 7.09 | **99.3%** | **97.2%** | **92.3%** | **83.5%** | **5+ (83.5%)** | ❌ |
| 10-02 17:30 | Essen vs Leipzig | **Essen** | Finley Werschkull | 7 (n=2) | 7.14 | **99.4%** | **97.3%** | **92.5%** | **83.9%** | **5+ (83.9%)** | ❌ |
| 10-02 18:00 | HBW Balingen-Weilstetten vs Bergischer | **Bergischer** | Fynn Hangstein | 7.2 (n=5) | 6.69 | **99%** | **96.3%** | **90.1%** | **79.7%** | **5+ (79.7%)** | ✅ |
| 10-02 18:00 | HBW Balingen-Weilstetten vs Bergischer | **HBW Balingen-Weilstetten** | Sascha Pfattheicher | 4.6 (n=5) | 4.79 | **95.2%** | **85.7%** | **70.5%** | 52.3% | **4+ (70.5%)** | ✅ |
| 10-02 18:30 | Caen vs St. Raphael | **St. Raphael** | MOHAMED Antonin | 5.67 (n=3) | 5.52 | **97.4%** | **91.3%** | **80.1%** | **64.6%** | **5+ (64.6%)** | ✅ |
| 10-02 18:30 | Tremblay vs Selestat | **Selestat** | MENDY Tony | 5.33 (n=3) | 5.38 | **97.1%** | **90.4%** | **78.4%** | **62.3%** | **5+ (62.3%)** | ✅ |
| 10-02 18:30 | Caen vs St. Raphael | **Caen** | GNAGO Adam | 5.33 (n=3) | 5.4 | **97.1%** | **90.5%** | **78.6%** | **62.6%** | **5+ (62.6%)** | ✅ |
| 10-02 18:30 | Tremblay vs Selestat | **Tremblay** | AVELANGE DEMOUGE Théo | 7.67 (n=3) | 7.89 | **99.7%** | **98.5%** | **95.4%** | **89.4%** | **5+ (89.4%)** | ✅ |

---
_Script : `scripts/analyze-handball-over60.mjs` — régénérable via `bun scripts/analyze-handball-over60.mjs`._