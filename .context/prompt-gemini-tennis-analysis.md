# Spécification — Prompt Gemini pour l'encart d'analyse Tennis (cards live + prematch)

**Bead** : `ParisScorebis-ceus` — P2, feature.
**Livrable de cette spec** : UN fichier .md. Aucun code de production ici (types/zod = spécification, à recopier tels quels par l'implémenteur).
**Destinataire** : l'implémenteur de la route API + de l'encart. Il validera d'abord le prompt avec l'utilisateur avant câblage.

---

## 0. Rappel produit

Dans les cards Tennis **LIVE** et **PREMATCH** (desktop `src/components/tennis/match-card.tsx`, mobile `src/components/tennis/match-card-broadcast.tsx`), afficher le résultat d'un appel Gemini :

1. **Analyse des 2 joueurs** : forme du moment **sur la surface du tournoi**, motivation/enjeu pour ce tournoi, H2H, comportement/attitude actuel (notamment en live).
2. **3 bets prédictifs** — `"prematch"` si le match n'a pas commencé, ou `"live"` évolutifs selon l'évolution du match (score, élan, breaks).

Contraintes transverses : affichage court (encart desktop **et** mobile), zéro donnée inventée, fallback gracieux (pas d'IA = encart masqué, jamais d'erreur), coût/latence bornés (cache).

---

## 1. Intégration existante (appels Gemini du repo)

### 1.1 Inventaire

| Fichier | Rôle | Modèle | JSON mode | Cache | Remarques |
|---|---|---|---|---|---|
| `src/lib/llm.ts` | **Client LLM unifié** (6 providers, fallback) — POINT D'ENTRÉE de tout appel | `GEMINI_MODEL` ou défaut `gemini-3.6-flash` (llm.ts:107) | `json: true` → `generationConfig.responseMimeType: "application/json"` (llm.ts:253) | — | Transport REST `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, header `x-goog-api-key`, `systemInstruction` pour le system prompt. Extraction **multi-parts** via `extractGeminiText()` (exclut `thought: true`) — piège corrigé 2026-09-25 : lire `parts[0]` seulement tronquait les réponses. Log `finishReason === "MAX_TOKENS"`. |
| **`src/lib/handball-ai-analysis.ts`** | **Le meilleur modèle à suivre** : analyse de match handball en prod | via `generateText` | non (markdown) | **fichier** `DATA_DIR/handball-ai-cache.json`, TTL **24 h**, purge à chaque écriture | Prompt **côté serveur uniquement** (jamais exposé client), données réelles injectées pour empêcher toute statistique inventée. Cache key = équipes normalisées + date + ligue. **Déduplication inflight** (`Map<key, Promise>` : N requêtes concurrentes = 1 appel). Échec → **rien n'est mis en cache** (retry libre au prochain accès). `temperature: 0.4`, `maxOutputTokens: 8192`, `timeoutMs: 90_000`. |
| `src/app/api/ai/gemini-insight/route.ts` | Insight JSON de match (tennis/football/hockey) — **2e modèle utile pour le JSON mode** | via `generateText` | **`json: true`** | `src/lib/gemini-cache.ts` : mémoire, TTL **12 h**, clé `gemini-insight:{sport}:{matchId}:{YYYY-MM-DD}` | Nettoyage des fences markdown ```` ```json ```` avant `JSON.parse`, validation champ-par-champ + clamp (`factors.slice(0,4)`, `confidence 1-5`), rate-limit **10 req / 5 min / IP**, `matchData` max **10 KB**, prompt inline (à ne PAS copier : notre prompt sera dans un fichier dédié). |
| `src/app/api/ai/gemini-cron/route.ts` | Pré-génération des insights par cron (cache hit ensuite) | via `generateText` | `json: true` | même cache 12 h | Modèle de préchauffage : on peut prégénérer les cards prematch en cron. |
| `src/app/api/ai/football-match-report/route.ts`, `.../compare/route.ts`, `.../football-nl-filter/route.ts` | Rapports/comparatifs/ filtrage JSON | via `generateText` | `json: true` | cache dédié | Références de structure (typed payload → zod-like validation manuelle). |
| `src/lib/match-editorial-service.ts` | Traduction EN→FR de previews | via `generateText` | non | fichier 24 h + mémo | **Ne jette jamais** : toute erreur → `{status:"absent"}` et l'UI masque. Bon pattern de fallback. `timeoutMs: 20_000`. |
| `src/app/api/mma/analysis/route.ts` | Appel REST direct, modèle **figé en dur** `gemini-2.0-flash` | hardcodé | non | — | **À ne pas copier** : contourne `llm.ts` et fige le modèle. |
| `src/lib/youtube-analysis.ts` | Appel REST direct (transcription) | `GEMINI_MODEL` | non | — | Idem, transport direct à éviter ici. |

### 1.2 Config recommandée POUR CE CAS

Appel via `generateText()` de `src/lib/llm.ts` (jamais de fetch direct, jamais de clé dans le client) :

| Paramètre | Valeur | Justification |
|---|---|---|
| `provider` | `"gemini"` | Cohérent handball/insight ; fallback OpenRouter/Local si `LLM_FALLBACK_ENABLED=true`. |
| modèle | `GEMINI_MODEL` (défaut `gemini-3.6-flash`) | Flash = latence + coût ; c'est le défaut du repo. |
| `json` | `true` | `responseMimeType: "application/json"` — JSON strict sans fence markdown. |
| `temperature` | `0.3` | Output factuel + structuré ; 0.4 suffirait mais 0.3 réduit la dérive de format. |
| `maxOutputTokens` | **4096** | Piège : sur gemini-3.x les tokens de **raisonnement sont déduits de ce budget** (cf. handball : 2048 → `MAX_TOKENS` + réponse tronquée à 300 car.). Notre JSON fait ~700-900 tokens, prévoir la marge de raisonnement. |
| `timeoutMs` | `45_000` | Entre insight (défaut 30 s) et handball (90 s). |
| `system` + `prompt` | séparés | `systemInstruction` = rôle/règles (§3), `prompt` = payload + template (§4). |
| prompt | **fichier serveur dédié** (ex. `src/lib/tennis-ai-analysis.ts`) | Jamais côté client, jamais dans un composant. |

Règles d'or reprises du pipeline handball :
- le prompt n'existe **que** côté serveur ;
- on injecte **uniquement** des données calculées par le repo (le modèle ne « connaît » rien d'autre) ;
- une erreur (quota, réseau, JSON invalide) **n'est jamais mise en cache** ;
- la clé `GEMINI_API_KEY` n'est jamais loguée ni exposée.

---

## 2. Payload d'entrée (données réellement injectées)

### 2.1 Sources de données inventoriées

| Bloc | Source exacte | Champs exploitables |
|---|---|---|
| Match prematch | `TennisMatch` (`src/lib/tennis-data.ts:60`) via `/api/tennis/prematch` | `id`, `tournament`, `round`, `scheduledAt`, `tournamentCategory`, `tournamentPriority`, `stats.surface` (`"Dur" \| "Terre battue" \| "Gazon"`), `stats.form`, `stats.h2h`, `stats.eloGap`, `stats.ic`, `stats.confidence`, `probA/probB`, `model`, `modelUpdatedAt`, `synthetic`, `insufficientData` |
| Joueurs | `Player` (`src/lib/tennis-data.ts:7`) + enrichi | `name`, `shortName`, `rank`, `atpRank`/`wtaRank`, `elo`, `eloKnown`, `surfaceElo`, `dbEloSurface`, `surfaceEloRank`, `sps`, `spsRank`, `spsConfidence`, `form` (`"W"\|"L"[]`, 5 derniers), `momentumScore`, `country` |
| Stats joueurs DB | `PlayerStats` (`src/lib/tennis-stats/types.ts:10`) via `/api/tennis/player-stats` (`usePlayerStats(names, surface)`) | `elo`, `eloSurface`, `surfaceEloRank`, `sps`, `spsRank`, `spsConfidence`, `spsMatches`, `drMoyen5m`, `servePtsWonPct`, `returnPtsWonPct`, `acesPct`, `dfPct`, `l10Surface` (`L10SurfaceScoreResult` : `score`, `wins`, `losses`, `matches`, `performance` `"under"\|"average"\|"over"`, `details[]` : `date`, `opponentName`, `result`, `score`, `eloDiff`) |
| Power score | `tennisPowerScore()` (`src/lib/power-score.ts:90`) — `TennisPowerInput` : `surfaceElo`, `eloKnown`, `form`, `holdPct`, `returnPct`, `sps`, `fatigueLoad` | `PowerScore { score 0-100, metrics[], coverage 0-1 }` par joueur (metrics : élo surface 30, service 20, forme 15, retour 15, SPS 10, fraîcheur 10) |
| H2H | BSD `TennisH2H` (`src/lib/api/bzzoiro-client.ts:164`) via `/api/tennis/bsd/matches/[id]/h2h` + `H2HMatch[]` (`tennis-data.ts:43`, champ `match.h2hHistory`) + rendu `h2h-advanced.tsx` | `total {wonA, wonB}` (ou `h2h {total_matches, player1_wins, player2_wins}`), `bySurface[{surface, wonA, wonB}]`, `recentMatches[{date, tournament, surface, score, winner}]`, dernier bilan H2H `stats.h2h` |
| Cotes | `TennisMatch.odds` (`{bookmaker, decimalA, decimalB}`), `allOdds: BookmakerOdd[]` (comparateur), live `LiveMatchState.oddsA/oddsB` (BSD `odds_player1/2`), `TennisOdds` BSD | Cotes 1X2 prematch + cotes live ; **uniquement le marché vainqueur du match est coté en clair** |
| Modèles prédictifs | `match.totalGamesPredictions` (`over18_5`, `over19_5`, `over21_5`, `lambda`, `recommendedBet{threshold, direction, prob, source}`), `match.mostAcesPredictions` (`probAWinsMarket`, `over9_5/12_5/15_5`, `recommendedBet{market, direction, prob}`), `match.momentumSignals` | Probabilités maison par marché |
| **Marchés 1xbet** | `useTennisMarkets()` (`src/hooks/use-tennis-markets.ts`) + registry `TENNIS_MARKETS` (`src/lib/prediction/tennis-market-map.ts`, **57 marchés**) | Par marché : `{ id, label, category, probA, probB, edge?, kelly?, recommended }` — blend bayésien modèle Markov/Poisson × probas implicites marché (poll 8 s) |
| Live état | `LiveMatchState` (`src/lib/live-state-builder.ts:29`) | `currentSet`, `scoreA/scoreB {sets: number[], games, points}`, `server: "A"\|"B"`, `liveProbA/liveProbB`, `oddsA/oddsB`, `isLive` |
| Stats live | `ServiceStats` (`src/hooks/use-tennis-live-stats.ts:30`, source BSD via SSE) | `p1/p2_aces`, `p1/p2_df`, `p1/p2_first_pct`, `p1/p2_first_won`, `p1/p2_second_won`, `p1/p2_bp_saved`, `p1/p2_ret_won`, `p1/p2_total_pts` |
| Métriques live | `CalculatedLiveMetrics` (`src/lib/tennis-live-metrics.ts:64`) | `dr {drA, drB, levelA/B, labelA/B}`, `secondServeAlert{player, pct, level}`, `bpExposure{p1SavePct, p2SavePct}`, `holdProbA/B`, `fatigueAlert{level, player, message}`, `pressureIndex 0-100` |
| Presse / consensus | `getPressReview()` (`src/lib/tennis-press-review-service.ts:143`) → `PressReviewResult` | `consensus {playerAPct, playerBPct, totalSources, favoredPlayer}`, `sources[]`, `predictions[]` — **optionnel** (null si indisponible) |

### 2.2 Schéma JSON d'entrée (à sérialiser dans le prompt user)

```ts
// Spécification — payload injecté côté serveur (aucun champ n'est requis au
// sens strict : toute donnée absente est transmise `null`, jamais omise).
export type TennisAiPayload = {
  contexte: "prematch" | "live";
  version: 1;                        // version du payload (bump si schéma change)
  genereLe: string;                  // ISO — horodatage de construction
  match: {
    id: string;
    tournoi: string | null;          // {{tournoi}}
    categorie: string | null;        // "Grand Slam" | "ATP Masters 1000" | ...
    tour: string | null;             // {{tour}}
    surface: string | null;          // "Dur" | "Terre battue" | "Gazon"
    dateISO: string | null;
    ordreJour: number | null;        // tournamentPriority (0 = plus prestigieux)
  };
  joueurs: [JoueurAi, JoueurAi];     // [0] = A (favori), [1] = B
  h2h: {
    totalA: number | null;           // victoires A
    totalB: number | null;
    parSurface: Array<{ surface: string; wonA: number; wonB: number }> | null;
    derniers: Array<{                // ≤ 5, plus récent d'abord
      date: string; tournoi: string; surface: string;
      score: string; gagnant: "A" | "B" | null;
    }> | null;
  } | null;
  modele: {
    probA: number | null;            // % victoire match (prematch)
    probB: number | null;
    ic: [number, number] | null;     // intervalle de confiance %
    confiance: number | null;        // 0-1
    totalJeux: {                     // totalGamesPredictions
      over18_5: number | null; over19_5: number | null; over21_5: number | null;
      lambda: number | null;
      pariRecommande: { seuil: number; sens: "over" | "under"; prob: number } | null;
      source: string | null;
    } | null;
    aces: {                          // mostAcesPredictions
      probAMieux: number | null; probBMieux: number | null;
      over9_5: number | null; over12_5: number | null;
      pariRecommande: { marche: string; sens: string; prob: number } | null;
    } | null;
    signalsMomentum: { source: string; poids: Record<string, number> } | null;
  } | null;
  cotes: {
    bookmaker: string | null;
    decimalA: number | null;
    decimalB: number | null;
    multi: Array<{ bookmaker: string; a: number; b: number }> | null;
  } | null;
  marcheVainqueur: {                 // probas du registre pour le marché vainqueur
    probA: number | null; probB: number | null;
    edge: number | null; kelly: number | null;
  } | null;
  marcheMarches: Array<{             // ≤ 60 marchés du registre 1xbet (cf. §2.3)
    id: string;                      // id EXACT de TENNIS_MARKETS
    label: string;
    probA: number | null;            // % côté A / direction 1
    probB: number | null;            // % côté B / direction 2
    edge: number | null;
    kelly: number | null;
    recommande: boolean;
  }>;
  presse: {                          // optionnel — null si service indisponible
    consensusA: number | null; consensusB: number | null;
    nbSources: number | null; favori: string | null;
  } | null;
  // présent uniquement si contexte = "live"
  live: {
    setEnCours: number;
    setsA: number[]; setsB: number[];   // scores de set par manche
    jeuxA: number; jeuxB: number;       // jeux du set en cours
    pointsA: string; pointsB: string;   // "0"/"15"/"30"/"40"/"A"
    service: "A" | "B" | null;
    probA: number | null; probB: number | null;   // probas live
    coteA: number | null; coteB: number | null;
    progression: number | null;         // 0-1 (avancement match)
    stats: {                            // ServiceStats BSD
      acesA: number | null; acesB: number | null;
      dfA: number | null; dfB: number | null;
      firstPctA: number | null; firstPctB: number | null;
      firstWonA: number | null; firstWonB: number | null;
      secondWonA: number | null; secondWonB: number | null;
      bpSavedA: number | null; bpSavedB: number | null;
      retWonA: number | null; retWonB: number | null;
      totalPtsA: number | null; totalPtsB: number | null;
    } | null;
    metriques: {                       // CalculatedLiveMetrics
      drA: number | null; drB: number | null;
      niveauA: string | null; niveauB: string | null;   // "Dominant"…"Dominé"
      holdProbA: number | null; holdProbB: number | null;
      pression: number | null;            // pressureIndex 0-100
      alerteService: { joueur: string | null; pct: number; niveau: string } | null;
      alerteFatigue: { niveau: string; joueur: string | null; message: string } | null;
      bpExposure: { saveA: number | null; saveB: number | null } | null;
    } | null;
    elan: string | null;               // résumé calculé du momentum (breaks encaissés, jeu consécutif…) OU null
  } | null;
};

export type JoueurAi = {
  nom: string;
  court: string | null;
  rangAtp: number | null;
  rangWta: number | null;
  elo: number | null;
  eloConnu: boolean;                  // false → 1500 sentinelle, NE PAS afficher
  eloSurface: number | null;
  rangEloSurface: number | null;
  sps: number | null;                 // Surface PowerScore 0-100
  rangSps: number | null;
  spsConfiance: number | null;        // 1 = sample suffisant
  forme: Array<"W" | "L"> | null;     // 5 derniers
  l10Surface: {                       // L10SurfaceScoreResult compacté
    score: number | null; wins: number | null; losses: number | null;
    matches: number | null; performance: "under" | "average" | "over" | null;
    derniers: Array<{ adversaire: string; resultat: "W" | "L"; score: string; eloDiff: number | null }> | null;
  } | null;
  servePtsWonPct: number | null;
  returnPtsWonPct: number | null;
  acesPct: number | null;
  dfPct: number | null;
  drMoyen5m: number | null;
  momentumScore: number | null;       // 0-100
  powerScore: { score: number; coverage: number } | null;
  fatigueLoad: number | null;         // matchs 3 sets / 7 j (0 = frais)
  pays: string | null;
};
```

### 2.3 Placeholders (résolution par l'implémenteur)

| Placeholder | Source | Rendu attendu |
|---|---|---|
| `{{contexte}}` | route (`"prematch"` si avant 1er point, sinon `"live"`) | literal |
| `{{matchId}}` | `TennisMatch.id` / `LiveMatchState.matchId` | ex. `bsd-123456` |
| `{{tournoi}}` | `match.tournament` (live : `tournamentName`) | ex. `Roland-Garros` |
| `{{categorie}}` | `match.tournamentCategory` | ex. `Grand Slam` |
| `{{tour}}` | `match.round` (live : `roundName`) | ex. `Demi-finale` |
| `{{surface}}` | `match.stats.surface` | `Terre battue` |
| `{{date}}` | `match.scheduledAt` | ISO ou date FR |
| `{{joueurA}}` / `{{joueurB}}` | `playerA.name` / `playerB.name` | noms complets |
| `{{formeA}}` / `{{formeB}}` | `player.form` → `"V-D"` | ex. `4-1` |
| `{{l10A}}` / `{{l10B}}` | `PlayerStats.l10Surface` | ex. `18 pts, 7V-2D (over)` |
| `{{eloSurfaceA}}` / `{{eloSurfaceB}}` | `PlayerStats.eloSurface` | entier ou `null` |
| `{{spsA}}` / `{{spsB}}` | `PlayerStats.sps` + `spsConfidence` | entier + `(confiant)`/`(faible sample)` |
| `{{h2h}}` | `match.stats.h2h` + `h2h.total` | ex. `3-1 (A 3, B 1)` |
| `{{h2hDerniers}}` | `h2h.recentMatches` | ≤ 5 lignes `2026-05-14 Rome terre 6-4 3-6 A` |
| `{{probA}}` / `{{probB}}` | `match.probA/probB` (live : `liveProbA/B`) | entier % |
| `{{coteA}}` / `{{coteB}}` | `match.odds.decimalA/B` (live : `oddsA/oddsB`) | décimal ou `null` |
| `{{marches}}` | `useTennisMarkets()` → `marcheMarches[]` | JSON compact ≤ 60 entrées |
| `{{totalJeux}}` | `match.totalGamesPredictions` | JSON compact |
| `{{aces}}` | `match.mostAcesPredictions` | JSON compact |
| `{{presse}}` | `getPressReview().consensus` | JSON ou `null` |
| `{{liveScore}}` | `LiveMatchState` | ex. `sets 6-4 3-2, jeu 30-15, service B` |
| `{{liveStats}}` | `ServiceStats` | JSON compact |
| `{{liveMetriques}}` | `CalculatedLiveMetrics` | JSON compact |
| `{{powerA}}` / `{{powerB}}` | `tennisPowerScore(...)` | `{score, coverage}` |

**Règles de préparation du payload (côté serveur, AVANT l'appel)** :
- Toute donnée absente → `null` **explicite** (jamais `""`, `"N/A"`, `"?"`, 0 par défaut, 1500 sentinelle).
- `eloKnown === false` → `elo: null` **et** `eloConnu: false` (le modèle ne doit jamais citer un Élo placeholder).
- `match.synthetic === true` ou `insufficientData === true` → **ne pas appeler Gemini** (encart masqué directement).
- Ne jamais envoyer de champs bruts non listés (évite d'alimenter le modèle avec du bruit et gonfler les tokens).
- Payload total ≤ **10 Ko** (garde-fou repris de `gemini-insight`).

### 2.4 Marchés autorisés pour les 3 paris

Les 3 `marche` doivent être des **ids exacts de `TENNIS_MARKETS`** (`src/lib/prediction/tennis-market-map.ts`) :

- **PREMATCH** : tous marchés sauf `liveOnly` (`live-match-winner`, `live-set-winner`, `live-next-game` interdits). `prematchOnly` (`set-handicap-2.5`, `set-handicap+2.5`) autorisés.
- **LIVE** : marchés du registre calculés en live **+** les 3 `liveOnly`. `prematchOnly` interdits.
- **Unicité** : 3 ids **distincts**.
- **Direction** : `pick` doit désigner l'une des deux directions du marché (`probA`/`probB` fourni, ou `over`/`under`, ou `A`/`B` pour les marchés comparatifs).

Registre complet (57 ids) : `match-winner`, `correct-score-2-0|2-1|0-2|1-2`, `set-handicap-1.5|+1.5|-2.5|+2.5`, `game-handicap-2.5|+2.5|-4.5|+4.5`, `total-over|under-{18.5,19.5,20.5,21.5,22.5}`, `player-a-over-12.5`, `player-b-over-12.5`, `set-over|under-{6.5,7.5,8.5,9.5,10.5}`, `aces-over|under-{9.5,12.5,15.5}`, `most-aces-a`, `most-aces-b`, `tiebreak-yes|no`, `first-set-tiebreak`, `first-set-winner-a|b`, `first-set-over|under-9.5`, `double-a-a`, `double-b-b`, `double-a-b`, `double-b-a`, `live-match-winner`, `live-set-winner`, `live-next-game`.

---

## 3. SYSTEM PROMPT (verbatim FR — à copier tel quel)

```text
Tu es un analyste tennis betting pour PariScore, un site français de paris sportifs. Tu es spécialisé dans l'analyse de matchs ATP/WTA et la sélection de paris sur les marchés 1xBet.

TON
- Décisionnel, concis, honnête. Phrases courtes, français naturel, aucun jargon non expliqué, aucun emoji, aucun markdown dans les champs texte.
- Tu parles de faits, pas de certitudes : « favori sur la surface », « trend sur 3 matchs », jamais « garanti », « sûr », « value énorme ».
- Tu assumes l'incertitude : pas de donnée = pas d'affirmation.

RÈGLES ANTI-HALLUCINATION — STRICTES, SANS EXCEPTION
1. Tu n'utilises QUE les données présentes dans le message utilisateur (payload JSON). Tu as une mémoire de formation : tu ne t'en sers JAMAIS comme source de fait sur ce match.
2. Tu n'inventes JAMAIS : statistiques, cotes, classements, Élo, bilans, blessures, déclarations de presse, météo, historique de surface, durée de match. Si une information n'est pas dans le payload, elle n'existe pas pour toi.
3. Chaque affirmation factuelle du champ `verbatim` doit être directement appuyée par une valeur du payload. Si tu ne peux pas l'appuyer, tu omets l'affirmation — tu ne la formules pas.
4. Champ obligatoirement null : pour `joueurs[].forme_surface`, `motivation`, `h2h`, `comportement`, mets `null` (et NON une phrase vague) quand la donnée correspondante est absente ou `null` dans le payload. Un texte sans donnée derrière est une faute, pire que `null`.
5. `motivation` et `comportement` : tu peux les inférer UNIQUEMENT des éléments concrets du payload (round/tournoi/catégorie/enjeu déduit du niveau de compétition, score live, DR, alertes de pression/fatigue, press fournie). Tu ne jamais inventer d'état psychologique, de blessure, de conflit, de motivation de joueur.
6. Les probabilités et cotes que tu cites doivent être exactement celles du payload (arrondies au point près). Tu ne recalcules rien.
7. Les 3 paris doivent porter des `marche` dont l'id figure EXACTEMENT dans la liste des marchés fournis, avec la direction cohérente (`A`/`B`/`over`/`under`). Tout id absent de cette liste est interdit.
8. Si `marches` est vide ou absent : tu produis quand même les 3 paris sur les ids les plus standards du registre fourni dans les instructions, mais `confiance` ne dépasse jamais 55 et `rationale` mentionne en 1 bloc « probas marché indisponibles ».
9. Tu ne recommandes jamais un pari dont la donnée de base est `null` (pas de « sur le service, … » si `servePtsWonPct` est null pour les deux).

CONTEXTE D'AFFICHAGE
- L'encart est court : le champ `verbatim` fait 3 à 4 phrases MAXIMUM (environ 450 caractères maximum), même si tu as beaucoup à dire.
- `verbatim` ne contient que l'analyse des deux joueurs (forme sur la surface, enjeu/motivation, H2H, comportement actuel). Les paris ne s'y retrouvent pas : ils ont leurs champs dédiés.
- Ton public : parieur français lambda qui consulte une carte match sur mobile. Aller droit au fait.

DISCLAIMER
- Chaque analyse est une aide à la décision, pas un conseil de pari. Le disclaimer exact est fourni dans `meta.disclaimer` : tu ne le rédiges pas, tu le reprends tel quel.
- Tu n'encourages jamais au jeu excessif ni aux paris douteux ; tu n'inventes aucune cote attractive.

SORTIE
- Tu réponds UNIQUEMENT par un objet JSON valide, sans texte avant/après, sans balises de code, sans commentaires.
- Le JSON respecte exactement le schéma demandé : `verbatim` (string), `joueurs` (tableau de 2), `paris` (EXACTEMENT 3), `meta`.
- Toutes les valeurs numériques sont des nombres (pas de chaînes), les pourcentages sont des entiers 0-100.
```

---

## 4. USER TEMPLATE (verbatim, avec placeholders)

```text
# ANALYSE TENNIS — {{contexte}}

## Données du match (payload — source unique de vérité)
{{payload_json}}

## Marchés 1xBet disponibles (ids EXACTS à utiliser dans paris[].marche)
{{marches_ids_compacts}}

## Consignes de sortie
Réponds UNIQUEMENT avec le JSON suivant (aucun texte autour) :

{
  "verbatim": "<3-4 phrases max : forme SUR LA SURFACE du tournoi pour chaque joueur, enjeu/motivation pour ce tournoi, H2H, comportement/attitude actuel (en live : élan, pression, service) — uniquement des faits du payload>",
  "joueurs": [
    { "nom": "<nom exact du payload>", "forme_surface": "<ou null>", "motivation": "<ou null>", "h2h": "<ou null>", "comportement": "<ou null>" },
    { "nom": "<nom exact du payload>", "forme_surface": "<ou null>", "motivation": "<ou null>", "h2h": "<ou null>", "comportement": "<ou null>" }
  ],
  "paris": [
    { "marche": "<id exact>", "pick": "<direction>", "confiance": <0-100>, "rationale": "<≤2 phrases, faits du payload uniquement>", "timing": "{{contexte}}" },
    { "marche": "<id exact>", "pick": "<direction>", "confiance": <0-100>, "rationale": "<≤2 phrases>", "timing": "{{contexte}}" },
    { "marche": "<id exact>", "pick": "<direction>", "confiance": <0-100>, "rationale": "<≤2 phrases>", "timing": "{{contexte}}" }
  ],
  "meta": { "version": 1, "disclaimer": "Analyse générée par IA — aide à la décision, pas un conseil de pari. Jouez responsablement.", "contexte": "{{contexte}}" }
}

Rappels :
- `timing` vaut strictement "{{contexte}}" pour les 3 paris.
- `confiance` = probabilité la plus basse entre modèle et marché pour ce pick, arrondie à l'entier ; plafonnée à 90.
- `paris` : 3 ids DISTINCTS, cohérents avec le contexte (prematch → pas de marchés live ; live → marchés live autorisés).
- Chaque champ `joueurs[]` sans donnée dans le payload = null (jamais de phrase vide).
```

**Notes d'implémentation du template** :
- `{{payload_json}}` = `JSON.stringify(payload)` (compact, pas d'indentation : économise ~30 % de tokens).
- `{{marches_ids_compacts}}` = une ligne par marché `id | label | probA% | probB%`, ou `"(aucune probabilité de marché fournie)"` si vide.
- Few-shot (§7) insérés **après** les consignes, dans le même message user, sous la forme `### Exemple attendu (calibrage)`.

---

## 5. Schéma de sortie JSON STRICT

### 5.1 TypeScript

```ts
export type TennisAiContexte = "prematch" | "live";

export type TennisAiJoueur = {
  nom: string;
  forme_surface: string | null;
  motivation: string | null;
  h2h: string | null;
  comportement: string | null;
};

export type TennisAiPari = {
  /** id EXACT de TENNIS_MARKETS (src/lib/prediction/tennis-market-map.ts). */
  marche: string;
  pick: string;
  /** 0-100 entier. */
  confiance: number;
  rationale: string;
  timing: TennisAiContexte;
};

export type TennisAiMeta = {
  version: 1;
  disclaimer: string;
  contexte: TennisAiContexte;
};

export type TennisAiAnalysis = {
  verbatim: string;
  joueurs: [TennisAiJoueur, TennisAiJoueur];
  paris: [TennisAiPari, TennisAiPari, TennisAiPari];
  meta: TennisAiMeta;
};
```

### 5.2 Validation zod-compatible

```ts
import { z } from "zod";

// Ids issus du registre — injectés à la validation (source unique : TENNIS_MARKETS)
export function tennisAiAnalysisSchema(marcheIdsAutorises: string[]) {
  const joueur = z.object({
    nom: z.string().min(1),
    forme_surface: z.string().max(160).nullable(),
    motivation: z.string().max(160).nullable(),
    h2h: z.string().max(160).nullable(),
    comportement: z.string().max(160).nullable(),
  });

  const pari = z.object({
    marche: z.string().refine((id) => marcheIdsAutorises.includes(id), {
      message: "marche inconnu du registre 1xbet",
    }),
    pick: z.string().min(1).max(60),
    confiance: z.number().int().min(0).max(100),
    rationale: z.string().min(1).max(220),
    timing: z.enum(["prematch", "live"]),
  });

  return z.object({
    verbatim: z.string().min(1).max(480),
    joueurs: z.tuple([joueur, joueur]),
    paris: z.tuple([pari, pari, pari]),
    meta: z.object({
      version: z.literal(1),
      disclaimer: z.string().min(1),
      contexte: z.enum(["prematch", "live"]),
    }),
  }).superRefine((val, ctx) => {
    // Règles croisées (pas exprimables en zod natif)
    const ids = val.paris.map((p) => p.marche);
    if (new Set(ids).size !== 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paris"], message: "3 marchés distincts requis" });
    }
    for (const p of val.paris) {
      if (p.timing !== val.meta.contexte) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paris", ids.indexOf(p.marche), "timing"], message: "timing doit égaler meta.contexte" });
      }
    }
  });
}
```

**Sanitisation post-validation** (comme `gemini-insight`) : tronquer `verbatim` à 480 car., `rationale` à 220 car., forcer `confiance` dans 0-100, remplacer le `disclaimer` par la constante maison même si le modèle l'a réécrit.

---

## 6. Paramètres génération, cache, coût, fallback

| Paramètre | Valeur | Détail |
|---|---|---|
| `temperature` | `0.3` | Factuel + format stable |
| `maxOutputTokens` | `4096` | Tokens de raisonnement gemini-3.x inclus dans ce budget (cf. §1.2) |
| `json` | `true` | → `responseMimeType: "application/json"` |
| `timeoutMs` | `45_000` | `LlmError` → fallback UI |
| Retry | **1 seul retry** | Relance avec le même payload **+ message d'erreur** : « Ta réponse précédente était invalide : `{erreurs zod}`. Renvoie UNIQUEMENT le JSON corrigé, sans commentaire. » |
| Après ce retry | **encart masqué** | Ne jamais afficher de JSON cassé ni d'erreur brute |
| Rate-limit (route) | 10 req / 5 min / IP | Repris de `gemini-insight` |
| Dédup inflight | `Map<clé, Promise>` | N cards ouvertes = 1 appel (pattern handball) |

### Cache

| Contexte | Clé | TTL | Raison |
|---|---|---|---|
| prematch | `tennis-ai:{matchId}:{AAAA-MM-JJ}` | **12 h** | Aligné `gemini-cache.ts` : les données prematch bougent peu ; régénérer 2×/jour suffit |
| live | `tennis-ai:live:{matchId}:{sets}-{jeux}-{service}` | **5 min** + purge dès que la signature change | L'analyse doit évoluer avec score/breaks, sans re-appeler à chaque point |
| erreur | — | **jamais cachée** | Erreur ≠ donnée (règle handball) |

Stockage : réutiliser `src/lib/gemini-cache.ts` (mémoire + prune) **ou** fichier `DATA_DIR/tennis-ai-cache.json` comme handball si persistance pm2 requise. Préférer le fichier si l'encart doit survivre aux restarts.

### Coût estimé (ordre de grandeur, à revalider au pricing en vigueur)

- Input : system ~1 100 tokens + payload ~1 800-2 500 tokens + template ~450 + few-shot ~700 ⇒ **≈ 4 000-4 800 tokens**.
- Output : JSON ~800 tokens (+ raisonnement gemini-3.x, non facturé en output mais déduit du budget).
- Au tarif Flash-type (≈ 0,30 $/M input, 2,50 $/M output) : **≈ 0,003-0,004 $ par appel (~0,3 c€)**.
- Avec cache 12 h prematch + 5 min live : sur une journée de 200 cards live suivies toutes les 5 min, le cache live plafonne à ~12 appels/match/h soit ≈ 10-30 $/jour au pire → **le TTL live 5 min + signature score est un garde-fou coût obligatoire, pas un détail**. À surveiller via compteur d'appels (log `[tennis-ai]` à chaque appel non caché).

### Fallback UI (jamais d'erreur visible)

```
1. Payload synthétique / insufficientData / prematch sans données  → encart masqué (0 appel)
2. Appel OK + zod OK                                               → encart affiché
3. JSON invalide → 1 retry avec message d'erreur
4. Échec retry / timeout / LlmError / 429                          → encart masqué (+ log)
```

---

## 7. Few-shot (2 exemples calibrent le ton — insérés dans le template)

### Exemple 1 — PREMATCH

```text
### Exemple attendu (calibrage — prematch)
Contexte : Roland-Garros, quarts, terre battue. Joueur A : forme 4-1, l10Surface 18 pts (over), eloSurface 2085, SPS 82 confiant, H2H 3-1 dont 2 sur terre. Joueur B : forme 2-3, l10Surface 6 pts (under), eloSurface 1930, SPS 61 faible sample. probA 68 %, probB 32 %, cotes 1.45 / 2.85.

{
  "verbatim": "Sur la terre battue, A arrive en bien meilleure forme : 4 victoires sur ses 5 derniers matchs et un L10 Surface à 18 points, contre 6 points seulement pour B, en retrait depuis trois semaines. L'enjeu est fort pour les deux, mais B a déjà été éliminé tôt sur ce type de surface cette saison. Le face-à-face penche nettement pour A, qui a remporté les trois derniers duels, dont deux sur terre. B devra gagner un set de plus que d'habitude pour inquiéter.",
  "joueurs": [
    { "nom": "J. Sinner", "forme_surface": "4-1 sur ses 5 derniers, L10 sur terre à 18 pts (over)", "motivation": "Quarts de Grand Slam, enjeu maximal", "h2h": "Mène 3-1, dont 2 victoires sur terre", "comportement": "Forme stable, sets remportés en deux manches" },
    { "nom": "A. Zverev", "forme_surface": "2-3 sur ses 5 derniers, L10 sur terre à 6 pts (under)", "motivation": "Quarts de Grand Slam, enjeu maximal", "h2h": "Défait 3-1, a perdu les 3 derniers duels", "comportement": "Deux défaites récentes en trois matchs" }
  ],
  "paris": [
    { "marche": "match-winner", "pick": "A", "confiance": 66, "rationale": "probA 68 % et cote 1.45 : écart Élo surface de 155 pts en faveur de A. H2H 3-1 avec deux victoires sur terre.", "timing": "prematch" },
    { "marche": "game-handicap-2.5", "pick": "A", "confiance": 58, "rationale": "SPS 82 contre 61 et L10 Surface 18 pts contre 6 pts justifient un écart de jeux supérieur à 2,5.", "timing": "prematch" },
    { "marche": "total-under-21.5", "pick": "under", "confiance": 55, "rationale": "Deux joueurs dominants au service sur terre récente et tendance aux sets en deux manches : total attendu sous 21,5.", "timing": "prematch" }
  ],
  "meta": { "version": 1, "disclaimer": "Analyse générée par IA — aide à la décision, pas un conseil de pari. Jouez responsablement.", "contexte": "prematch" }
}
```

### Exemple 2 — LIVE

```text
### Exemple attendu (calibrage — live)
Contexte : live, dur. Score : A mène 6-4 4-2, jeu 40-15 sur le service de A (A sert pour le set), A vient de briser au game précédent. Stats : aces 7-3, first won 74 % vs 58 %. DR : A 1.42 (Favorable), B 0.81 (Défavorable). Pressure index 68. probA 81 %, probB 19 %, cotes live 1.28 / 4.10.

{
  "verbatim": "A contrôle le match depuis le second set : il sert mieux (74 % de premiers points gagnés contre 58) et vient de briser pour mener 4-2, servant maintenant pour le set. La pression retombe sur B, dont le deuxième service tombe à 38 % et qui affiche un DR à 0,81. Sur la surface et sur l'élan actuel, A est le seul joueur crédible sur les prochains jeux.",
  "joueurs": [
    { "nom": "T. Fritz", "forme_surface": "Tenue de service à 74 % sur ses premiers points dans ce match", "motivation": null, "h2h": null, "comportement": "Sert à 74 %, a converti le break au game précédent, DR à 1,42" },
    { "nom": "H. Rune", "forme_surface": null, "motivation": null, "h2h": null, "comportement": "Deuxième service à 38 %, DR à 0,81, exposé sur chaque jeu de service" }
  ],
  "paris": [
    { "marche": "live-match-winner", "pick": "A", "confiance": 79, "rationale": "probA 81 % à la cote 1,28 et break déjà obtenu dans ce set. B sert à 58 % sur premiers points.", "timing": "live" },
    { "marche": "live-set-winner", "pick": "A", "confiance": 72, "rationale": "A sert pour le set avec un DR à 1,42 contre 0,81 et un avantage de break acquis.", "timing": "live" },
    { "marche": "aces-over-9.5", "pick": "over", "confiance": 61, "rationale": "10 aces déjà servis (7 pour A) alors que le match n'en est qu'au second set.", "timing": "live" }
  ],
  "meta": { "version": 1, "disclaimer": "Analyse générée par IA — aide à la décision, pas un conseil de pari. Jouez responsablement.", "contexte": "live" }
}
```

**Ce que calibrent les exemples** : verbatim de 3-4 phrases factuelles sans superlatif ; `null` assumé quand la donnée manque (ex. `motivation: null` en live) ; `confiance` alignée sur les probas fournies et < 70 quand l'écart est ténu ; rationales de ≤ 2 phrases citant des chiffres du payload ; disclaimer repris mot pour mot.

---

## 8. Checklist implémentation (pour l'étape suivante)

1. [ ] Valider ce prompt (system + template + few-shot) **avec l'utilisateur** avant tout câblage.
2. [ ] Créer `src/lib/tennis-ai-analysis.ts` : `buildTennisAiPayload(...)` + `buildTennisAiPrompt(...)` + `getOrGenerateTennisAi(...)` (cache + inflight), modélisé sur `handball-ai-analysis.ts`.
3. [ ] Route `src/app/api/ai/tennis-analysis/route.ts` : rate-limit 10/5 min/IP, payload ≤ 10 Ko, zod à l'entrée **et** à la sortie, sanitisation.
4. [ ] Filtre des marchés par contexte (§2.4) **avant** injection du payload.
5. [ ] Encart dans `match-card.tsx` + `match-card-broadcast.tsx` (desktop & mobile), states : loading / absent / affiché — jamais d'erreur brute.
6. [ ] Compteur d'appels non cachés + log `[tennis-ai]` (suivi coût).
7. [ ] `bun run lint` + `bun run typecheck` à 0 erreur ; tests zod sur les 2 exemples few-shot (doivent passer le schéma tel qu'écrits).
