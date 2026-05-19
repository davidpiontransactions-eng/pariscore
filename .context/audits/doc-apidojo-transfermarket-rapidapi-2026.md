# apidojo « TransferMarket » (RapidAPI) — Documentation

*2026-05-19 · Source : RapidAPI apidojo/transfermarket · context7 NON applicable (couvre libs code, pas les API RapidAPI tierces) · Pages RapidAPI/apidojo 100 % JS → extraction partielle, champs `⚠ à confirmer` en console RapidAPI*

## 1. Présentation

API tierce managée répliquant transfermarkt.com : **transfer news, rumeurs, derniers/records transferts, valeur marchande, profils joueurs/clubs/compétitions**. Éditeur : `apidojo` (établi sur RapidAPI). Usage PariScore visé : **rumeurs transferts** (orphelin felipeall, issue `dj1`).

## 2. Accès / Auth

- Host : `transfermarket.p.rapidapi.com`
- Protocole : REST JSON, `GET`.
- Headers requis :
  - `X-RapidAPI-Key: <clé RapidAPI>`
  - `X-RapidAPI-Host: transfermarket.p.rapidapi.com`
- Zéro-dep Node : `https.get` natif + 2 headers → compatible ADN PariScore (aucune lib npm).

## 3. Paramètre `domain` (langue / portail TM)

Plusieurs endpoints acceptent `domain` : `com | de | be | es | it | nl | pl | pt | com.tr | world`. PariScore (FR) → privilégier `com` ou `world` (rumeurs internationales).

## 4. Tarification (⚠ à vérifier manuellement)

Pages pricing RapidAPI rendues en JS → **quota/prix exacts non extractibles automatiquement**. Modèle apidojo typique RapidAPI :
- **BASIC (gratuit)** : quota mensuel bas (~500 req/mois ordre de grandeur), hard-limit.
- **PRO/ULTRA/MEGA** : payants (~10–50 $/mo selon volume).
- Vérif obligatoire : https://rapidapi.com/apidojo/api/transfermarket/pricing

## 5. Intégration PariScore (reco)

- Brancher UNIQUEMENT le flux **rumeurs** (le reste = felipeall self-host déjà en place, gratuit).
- **Cache agressif 12 h** (rumeurs peu volatiles intra-journée) pour tenir le quota free.
- Clé en `process.env.RAPIDAPI_KEY` (jamais committée — déjà convention projet, cf. `FREE_FOOTBALL_RAPIDAPI_KEY`).
- Helper type : `httpsGet('https://transfermarket.p.rapidapi.com/<path>', {'X-RapidAPI-Key':..., 'X-RapidAPI-Host':'transfermarket.p.rapidapi.com'})`.
- Échec/quota épuisé → dégradation gracieuse (rumeurs masquées UI), jamais de crash.

## 6. Limites / incertitudes

1. Quota free réel + prix paliers : **non lus** (JS) → console RapidAPI manuelle.
2. Endpoint rumeurs : marketing confirme « rumors » ; chemin exact (`/transfers/list-rumors` ou via `/news`) **à confirmer** en playground RapidAPI.
3. Stabilité : API tierce non officielle Transfermarkt → dépend uptime apidojo.

## Sources
- https://rapidapi.com/apidojo/api/transfermarket
- https://rapidapi.com/apidojo/api/transfermarket/pricing
- https://apidojo.net/documentations/transfermarkt
- https://rapidapi.com/apidojo/api/transfermarket/discussions/36616
