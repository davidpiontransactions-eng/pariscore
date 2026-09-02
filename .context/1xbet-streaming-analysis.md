# Analyse Streaming 1xBet — Rapport & Décision (PariScore)

**Date** : 2026-09-01
**Scope demandé** : analyser le streaming 1xBet, scraper les liens vidéo, intégrer un module vidéo dans les cards prematch & live PariScore.
**Décision** : ❌ **NO-GO** sur le scraping/ré-intégration des flux 1xBet (disqualifiant légalement et techniquement). ✅ **Alternatives légales** recommandées, alignées sur des patterns déjà présents dans le codebase.
**Boucle ingénierie** : arrêtée à l'étape 1 du workflow Scraping Pipeline (`verify: robots.txt + ToS analysés` → **échec ToS**).

---

## 1. Comment un bookmaker streame les matchs (architecture type, cas 1xBet)

### 1.1 Droits de diffusion

Les bookmakers n'achètent pas des droits TV classiques. Ils acquièrent des
**sous-licences "betting media rights"** (souvent via des agrégateurs type
Sportradar, Stats Perform, ou en direct auprès de certaines ligues/ayants-droits),
avec des contraintes contractuelles strictes :

- Résolution volontairement basse (~360–480p, bitrate faible)
- Délai volontaire (plusieurs secondes à dizaines de secondes derrière le direct TV)
- Géo-restriction stricte aux territoires où les droits sont détenus
- **Interdiction absolue de redistribution, réintégration ou retransmission** hors de la plateforme du bookmaker
- Accès conditionné à un compte utilisateur (souvent : compte alimenté ou pari actif en cours)

### 1.2 Pipeline de diffusion

```
Signal TV/feed officiel
  → encodage temps réel (H.264/AAC, bas bitrate, multi-quality ladder)
  → packaging HLS (master playlist .m3u8 → variant playlists → segments .ts/.mp4 de 2–6 s)
  → tokenisation des URLs (signature + expiration + session)
  → CDN edge
  → player propriétaire (web/app) + WebSocket de synchro live
```

- **HLS** est le standard : playlists `.m3u8`, segments courts, parfois chiffrement
  AES-128 / SAMPLE-AES avec rotation de clés.
- **URLs tokenisées** : chaque playlist/segment est servi avec des paramètres
  signés du type `?auth=<jwt>&expires=<ts>&session=<id>`. TTL court
  (quelques minutes), parfois **bindé à l'IP et à la session** qui a négocié le flux.
- **Contrôle d'accès** : le flux n'est négocié que pour un utilisateur logué
  (et souvent : solde > 0 ou pari en cours). Le token est délivré par un appel
  API authentifié côté client, pas public.
- **Player** : player custom (pas d'embed standard), vérifications
  Referer/Origin, CORS fermé, parfois DRM (Widevine) sur app mobile.

### 1.3 Protections anti-scraping / anti-embed

| Couche | Mécanisme | Effet sur un scraper |
|---|---|---|
| WAF | Challenge type Cloudflare, fingerprinting TLS | Bloc IP datacenter (vécu projet : OddAlerts, contourné via FlareSolverr) |
| Auth | Compte logué + fonds/pari actif requis | Pas de flux sans session négociée |
| Tokens | URLs signées, TTL minutes, rotation, bind IP/session | Lien copié = lien mort chez tout autre visiteur |
| HTTP | CORS fermé, contrôle Referer/Origin | `<video>` tiers refusé par le CDN |
| Contrat | CGU interdisant scraping/copie/redistribution | Base légale du refus (section 3) |

> À noter : PariScore consomme déjà des **données 1xBet de cotes**
> (`live-odds-panel` : « Cotes live P1/P2 (1xBet, repli BSD) »). Les cotes sont
> des données factuelles à faible protection ; **la vidéo est un contenu protégé
> soumis à licence** — ce n'est pas du tout le même régime.

---

## 2. Pourquoi le scraping des liens vidéo est une impasse technique

1. **URLs éphémères** — TTL de l'ordre de la minute, rotation continue. Un
   `<video src="…">` scrapé meurt quasi immédiatement. Il faudrait re-scraper
   en continu, par match, par visiteur.
2. **Bind IP/session** — un token négocié par la session 1xBet du scraper ne
   fonctionne pas depuis l'IP d'un visiteur de pariscore.fr. Un lien « partagé »
   est inutilisable par définition.
3. **Authentification obligatoire** — pas de flux sans compte alimenté/pari
   actif. Automatiser cela = gérer des comptes bookmaker à grande échelle.
4. **WAF + anti-bot** — scraping massif → blocages, course aux armements
   permanente (FlareSolverr etc.), coût de maintenance élevé pour une valeur
   instable.
5. **Qualité dégradée par design** — 360–480p, délai volontaire : même en
   « réussissant », l'expérience serait médiocre vs un diffuseur officiel.

**Conclusion technique** : l'intégration serait cassée en permanence. Ce n'est
pas un problème d'implémentation, c'est le design même du système cible qui
rend la réutilisation impossible.

---

## 3. Analyse légale — disqualifiante

1. **Droit d'auteur / droits voisins des diffuseurs** — les retransmissions
   sportives sont des contenus protégés (Code de la propriété intellectuelle).
   Les retransmettre sans autorisation des ayants-droit = contrefaçon,
   indépendamment des CGU de 1xBet.
2. **CGU 1xBet** — interdisent explicitement le scraping, la copie et la
   redistribution des flux. Étape 1 du workflow Scraping Pipeline PariScore
   (`verify: ToS analysés`) → **échec**, la boucle s'arrête ici par convention projet.
3. **1xBet n'est pas agréé ANJ en France** — opérateur illégal sur le marché
   français (l'ANJ lutte activement contre ces offres ; le site a fait l'objet
   de blocages). L'intégrer/promouvoir son service depuis un site français
   (`pariscore.fr`) ajoute un risque réglementaire propre.
4. **Loi anti-piratage sportif 2021-1359 + ARCOM** — blocage dynamique des
   retransmissions sportives non autorisées ; responsabilité civile et pénale
   du site qui rediffuse, avec procédures accélérées contre les sites vitrines.
5. **Convention projet** (AGENTS.md) — le piège « données sous licence » est
   listé noir sur blanc dans le preset Scraping Pipeline.

**Risque** : mises en demeure ARCOM/ayants-droit, blocage du domaine,
responsabilité pénale, perte SEO/marque. Asymétrie totale risque/valeur.

---

## 4. Ce qui existe déjà dans PariScore (patterns légaux à réutiliser)

| Composant (réel, cf. COMPONENTS.md) | Rôle | Réutilisable |
|---|---|---|
| `french-broadcaster-badge` (`src/components/tennis/`) | Badge « Diffusé en France sur … » — mapping tournoi → chaîne | ✅ Pattern à décliner football : compétition → chaîne |
| `last-match-highlights-widget` / `previous-match-highlights-widget` (`tennis/`) | Mini-lecteurs YouTube (highlights officiels TennisTV) | ✅ Embed YouTube officiel = conforme aux conditions YouTube |
| `last-match-highlight` (`tennis/`) | Chip lien YouTube highlight | ✅ |
| `live-odds-panel` (`tennis/`) | Cotes live 1xBet (données factuelles, pas de vidéo) | ℹ️ Preuve que la donnée cotes 1xBet est déjà intégrée légalement |
| Tennis : `match-card`, `match-card-header`, `match-card-detail`, `match-card-footer` | Cards tennis | Points d'insertion |
| Football : `football-tab-content`, `flashscore-football-list`, `MatchPredictiveCard`, `live-stats-breakdown` | Cards/listes football | Points d'insertion prematch & live |

---

## 5. Alternatives légales recommandées (module vidéo « propre »)

| # | Option | Légalité | Effort | Valeur perçue |
|---|---|---|---|---|
| **A** | **Module « Où regarder le match »** — badge diffuseur officiel par compétition (Canal+, beIN Sports, DAZN, Ligue 1+, Prime Video, L'Équipe TV, Eurosport…) sur cards prematch & live, avec lien sortant vers le diffuseur | ✅ | Faible — mapping compétition → chaîne (données curatées, comme `french-broadcaster-badge` le fait déjà en tennis) | **Élevée** — feature standard chez Flashscore/OneFootball |
| **B** | **Highlights officiels via embed YouTube** (chaînes officielles ligues/clubs) en post-match sur la card détail | ✅ (embed API YouTube = conforme CGU YouTube) | Moyen — réplique des widgets tennis existants | Moyenne |
| **C** | Lien sortant « Regarder légalement » vers la page du diffuseur officiel | ✅ | Très faible | Faible-moyenne |
| **D** | Fournisseur de données vidéo sous licence (packages highlights payants) | ✅ (licence) | Coût récurrent | Élevée |

**Recommandation** : **Option A** immédiatement (déclinaison football de
`french-broadcaster-badge` sur les cards prematch & live), puis **Option B**
en phase 2 (réplique des widgets YouTube tennis pour le football).

### Points d'intégration concrets (si validé)

- Nouveau composant `src/components/football/broadcaster-badge.tsx` (pattern `french-broadcaster-badge`)
- Mapping `competition_id → { chaîne, url diffuseur, clair/payant }` en JSON statique ou table Prisma
- Insertion dans le header des cards football prematch + badge pulsant sur les cards live
- Mise à jour de `COMPONENTS.md` dans le même commit (règle projet)

---

## 6. Décision finale

| Item demandé | Statut | Raison |
|---|---|---|
| Ouvrir/analyser 1xBet | ⚠️ Fait de façon documentaire (architecture type bookmaker, section 1) | La reconnaissance active est inutile (flux derrière auth + tokens éphémères) et l'objectif visé est interdit (section 3) |
| Rapport détaillé .md | ✅ Ce document | `.context/1xbet-streaming-analysis.md` |
| Scraper les liens streaming vidéo | ❌ **Refusé** | Contenus protégés sous licence, CGU violées, opérateur non agréé ANJ, loi 2021-1359/ARCOM ; techniquement non viable (tokens éphémères, bind IP/session) |
| Module vidéo dans cards prematch & live | ❌ Refusé tel quel → ✅ **Reformulé en alternatives légales (A/B)** | En attente de validation utilisateur |

**Trace boucle ingénierie** : `[Research] verify: robots.txt + ToS analysés` →
**FAIL ToS + licence** → arrêt de la branche scraping, escalade décision
utilisateur. Aucune donnée scrapée, aucun flux extrait, aucun compte bookmaker créé.
