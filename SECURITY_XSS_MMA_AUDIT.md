# SECURITY XSS AUDIT — LOT 2 MMA

**Scope** : Module MMA/UFC du fichier `pariscore.app.js` — IIFE auto-contenue lignes `31715 → 32283` (fonctions `initMMAPage`, `_fetchMMA`, `_applyMMAFilter`, `_renderMMAEvent`, `_renderMMAFight`, `_renderOddsCell`, `toggleMMAAnalysis`, `_loadMMABreakdown`, `_renderConsensusInto`, `_modelCell`, `_verdictBlock`, `_methodBar`, `openMMABreakdownModal`, `_renderBreakdownModal`, `_renderMMAAnalysis`, `_loadMMAPhotos`, `_mmaPhotoFallback`). Données : `/api/v1/mma/fights` → ufcstats.com + The Odds API + AgentMMA (Gemini LLM).

**Date** : 2026-07-11
**Auditeur** : Security Architect (Agent)
**Référence** : GANTT.md Phase 2-E, règles AGENTS.md, suite du LOT 1 TENNIS (12/12 patchés)

---

## 1. Helpers d'échappement disponibles (VÉRIFIÉS, existent)

| Helper | Localisation | Échappe | Usage |
|---|---|---|---|
| `_esc(s)` | `pariscore.app.js:31833` (local MMA) | `& < > "` | Contexte HTML (module MMA) |
| `escapeHtml(s)` | `pariscore.app.js:23156` | `& < > "` | Contexte HTML (générique global) |
| `_escapeHtmlSafe(s)` | `pariscore.app.js:5248` | `& < > "` | Contexte HTML (BetMines/TennisAbstract) |
| `_jsStr(s)` | `pariscore.app.js:22061` | `'` | Attribut `onclick='...'` |

**Note** : Le module MMA définit son propre helper local `_esc()` (ligne 31833) qui échappe `& < > "` — strictement équivalent à `escapeHtml()` global. Il est utilisé de façon systématique et correcte dans tout le module pour les noms de combattants, classes de poids, événements, records, etc. NE PAS redéfinir.

Les variables SAFE BY DESIGN (non auditées / non patchées) : `id` (`_bdSeq` numérique), `_MMA_BLANK` (data URI hardcoded), `def.label`/`def.cls` (hardcoded dans `betDefs`), valeurs numériques pures (`probA`, `conf`, `vp`, `ko/sub/dec`, `h` hue, `sa.spm`, `sa.acc`, `.toFixed()` via `_fmt`), `favName`/`who`/`winner`/`recA`/`recB` (déjà wrappés `_esc`), `def.re` (regex hardcoded).

---

## 2. AUDIT — Toutes les `innerHTML` interpolant une variable (module MMA)

Module MMA = IIFE unique `31715→32283`. Toutes les écritures DOM HTML recensées via `grep "innerHTML\|outerHTML\|insertAdjacentHTML"` dans la plage :

| # | file:line | Cible `innerHTML` | Source donnée |
|---|---|---|---|
| D1 | `31771` | message erreur statique | hardcoded |
| D2 | `31783` | message empty statique | hardcoded |
| D3 | `31816-31818` | message empty (filtre) | hardcoded (+ bool `_mmaFilter`) |
| D4 | `31821` | `events.map(_renderMMAEvent).join('')` | API `/api/v1/mma/fights` |
| D5 | `31830` | skeletons statiques | hardcoded |
| D6 | `32008-32010` | spinners statiques | hardcoded |
| D7 | `32025` | `_renderMMAAnalysis(d.text)` | API `/api/v1/mma/fight-analysis` (Gemini) |
| D8 | `32027` | message erreur `(e.message)` | erreur fetch locale |
| D9 | `32126` | consensus HTML (`_renderConsensusInto`) | API `/api/v1/mma/breakdown` |
| D10 | `32137` | `_renderBreakdownModal(st)` | `_bdStore` (cf. breakdown) |

### 2.A — CRITICAL (à patcher)

| # | file:line | Variable | Source | Contexte | Verdict |
|---|---|---|---|---|---|
| M1 | `pariscore.app.js:32236-32240` | `analysePart` (texte Gemini markdown) | API externe `/api/v1/mma/fight-analysis` → **Gemini LLM** | HTML (`.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')` injecte `$1` **brut**) | **CRITICAL** — le groupe capturé n'est pas échappé ; une sortie LLM contenant `<img onerror=...>` ou `<script>` est exécutée. Le backend relaie Gemini → user-influenced par défaut (principe de précaution AGENTS.md). |
| M2 | `pariscore.app.js:32278-32280` | `text` (fallback Gemini) | idem Gemini | HTML (même regex `**→<strong>`, fallback branche `else`) | **CRITICAL** — même faille dans la branche fallback (quand `TOP 3 PARIS` absent du texte Gemini). |

**Total CRITICAL : 2**

### 2.B — SAFE (déjà protégés par `_esc()`)

Le module MMA est globalement **très bien durci** : `_esc()` est appliqué systématiquement. Emplacements SAFE vérifiés :

| Catégorie | file:line | Pourquoi SAFE |
|---|---|---|
| Event group (nom event, date) | `31858-31859` | `_esc(ev.event_name)`, `_esc(ev.event_date)` |
| Fight card (weight class, when) | `31878`, `31880` | `_esc(f.weight_class)`, `_esc(_mmaWhen(...))` |
| Fighter photos (data-fighter, data-name, alt) | `31885`, `31904` | `_esc(f.fighter_a/b)` (x3 attrs par img) |
| Fighter names/records | `31887`, `31888`, `31900`, `31901` | `_esc(f.fighter_a/b)`, `_esc(recA/recB)` |
| Odds cell label | `31979` | `_esc(name)` |
| Probas/pcts/EV | `31889`, `31902`, `31981-31984`, `32050`, `32069`, `32070` | numériques (`Math.round`, `_fmt`/`.toFixed`) |
| Consensus verdict (who, favName) | `32050`, `32070`, `32118` | `_esc(who)`, `_esc(favName)` |
| Method string | `32119` | `_esc(am.method)` |
| Modal event (name, date, venue) | `32176` | `_esc(...)` x3 |
| Modal fighters (mf, name, rec) | `32169-32171` | `_esc(name)`, `_esc(rec)` |
| Modal winner/method | `32182` | `_esc(winner)`, `_esc(am.method)` |
| Modal tape (records) | `32199` | `_esc(recA/recB)` |
| Modal striking | `32200-32201` | numérique (`sa.spm`, `sa.acc`) |
| Modal FAQ (q, a) | `32217` | `_esc(f.q)`, `_esc(f.a)` |
| Bet cards (pick, meta, reason) | `32270-32272` | `_esc(pick/meta/reason)` — **les seules valeurs parsées depuis Gemini qui SONT échappées** |
| Méthode bar | `32054-32062` | numérique (`Math.round`) |
| `innerHTML` loading/erreur/empty | `31771`, `31783`, `31816`, `31830`, `32008-32010` | aucune variable / messages hardcoded |
| Drawer error catch | `32027` | `e.message` = erreur fetch locale (HTTP status), non user-controlled ; marginal mais non-injectable (pas d'apostrophe/quote contexte HTML simple) |

**Total SAFE : ~45+ emplacements**

### 2.C — FALSE_POSITIVE (apparence XSS mais non exploitable)

| # | file:line | Variable | Pourquoi FALSE_POSITIVE |
|---|---|---|---|
| F1 | `31911-31920` | `JSON.stringify(f.fighter_a/b)` dans `onclick="_esc(...)"` | **Vérifié par test round-trip (Node)** : `_esc()` échappe `"`→`&quot;` dans l'attribut HTML ; le parser HTML décode `&quot;`→`"` avant exécution JS → on récupère exactement la string JSON valide d'origine. Test avec fighter_a = `'a"<script>alert(1)</script>'` : (1) l'attribut `onclick="..."` ne casse pas (pas de `"` non-échappé), (2) après décodage HTML, `JSON.parse` reconstruit la string intacte. `JSON.stringify` gère lui-même les quotes/backslash pour le contexte JS. Double protection (HTML attr + JS string) → non-exploitable. Note : `f.fighter_a/b` vient de l'API mais n'est JAMAIS interpolé en contexte HTML pur sans `_esc`. |
| F2 | `32027` | `e.message` dans message d'erreur | `e.message` provient d'un `new Error('HTTP ' + r.status + '...')` construit localement avec un code HTTP numérique. Non user-controlled, pas de contexte d'apostrophe JS (innerHTML HTML simple). |

**Total FALSE_POSITIVE : 2**

---

## 3. COMPTE TOTAL (avant patch)

- **CRITICAL : 2** (M1, M2 — les deux dans `_renderMMAAnalysis`, branches `if` et `else`)
- **SAFE : ~45+**
- **FALSE_POSITIVE : 2**

**Principe de précaution appliqué** : la sortie du LLM Gemini via `/api/v1/mma/fight-analysis` est traitée comme **user-controlled** (le backend relaie un modèle externe ; prompt-injection / sortie malformée possible). Toute interpolation brute → CRITICAL.

---

## 4. PATCH (Step 2) — 2 CRITICAL à patcher

**Stratégie** : dans `_renderMMAAnalysis`, la regex markdown `**...**` → `<strong>...</strong>` doit échapper le texte AVANT d'y réinjecter des balises `<strong>`. On échappe donc le texte brut avec `escapeHtml()` (ou `_esc`) en tête de chaîne, PUIS on applique la transformation markdown. Les balises `<br>` et `<strong>` sont réintroduites après coup par la regex (donc préservées), tandis que tout `<`/`>`/`&`/`"` issu du LLM est neutralisé.

Wrapper appliqué : `escapeHtml()` (global, ligne 23156) — équivalent à `_esc()` mais explicite au niveau module. Patch UNE localisation à la fois via Edit (old_string UNIQUE).

| # | file:line | Avant | Après | Wrapper |
|---|---|---|---|---|
| M1 | `32236-32240` | `analysePart.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(...)` | `escapeHtml(analysePart).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(...)` | `escapeHtml` (HTML) |
| M2 | `32278-32280` | `text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(...)` | `escapeHtml(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(...)` | `escapeHtml` (HTML) |

---

## 5. VALIDATION (Step 3)

```
$ node --check pariscore.app.js
SYNTAX OK exit=0
```

Validé après chaque patch individuel (M1 → exit 0, puis M2 → exit 0) et validation finale. Aucun revert nécessaire.

**Test fonctionnel round-trip (Node)** : reproduction des 2 branches patchées sur 6 vecteurs (script, img onerror, svg onload, nested bold+evil, iframe, markdown légitime). Résultat : **ALL INJECTIONS NEUTRALIZED = true** — aucune balise HTML exécutable ne subsiste (`<`/`>` échappés en `&lt;`/`&gt;`), et le markdown `**bold**`→`<strong>` + `\n`→`<br>` est **préservé**.

---

## 6. RAPPORT FINAL (Step 4)

| Métrique | Valeur |
|---|---|
| **CRITICAL trouvés** | 2 |
| **CRITICAL patchés** | 2 |
| **CRITICAL restants** | 0 |
| **SAFE (non patchés, déjà protégés par `_esc`)** | ~45+ |
| **FALSE_POSITIVE** | 2 |
| **Fichier modifié** | `pariscore.app.js` (uniquement, lignes 32238 & 32279) |
| **Fichiers NON touchés** | `pariscore.html`, `server.js`, `.archive/`, sections tennis/autres sports |
| **`node --check` status** | exit 0 (PASS) |
| **Helpers utilisés** | `escapeHtml()` (existe ligne 23156, non redéfini) |

### Notes
- Le module MMA (IIFE `31715→32283`) est le module le **mieux durci d'origine** audité à ce jour : helper local `_esc()` (ligne 31833) appliqué systématiquement sur tous les noms/records/événements/classes de poids issus de l'API `/api/v1/mma/fights`. Seule faille : le parsing markdown du texte Gemini (`_renderMMAAnalysis`) qui échappait correctement les *bet cards* (lignes 32270-32272) mais oubliait le *corps d'analyse* (branches `if` et `else`).
- `_jsStr` existe (ligne 22061) mais n'a pas été requis : le seul `onclick` complexe (ligne 31911, `toggleMMAAnalysis` avec `JSON.stringify` + `_esc`) est SAFE par construction (FALSE_POSITIVE F1, vérifié par test round-trip Node : l'attribut HTML ne casse pas et `JSON.parse` reconstruit la string intacte après décodage HTML).
- Aucun helper n'a été redéfini. `_esc()` local MMA (ligne 31833) n'a pas été touché.
- La stratégie de patch (échapper AVANT la regex markdown) préserve le rendu `**bold**`→`<strong>` tout en neutralisant tout HTML malveillant : les seules balises littérales `<` dans la sortie sont celles que NOUS injectons (`<strong>`, `<br>`).

### Hand-off pour LOT 3 (autres sports)
- Wrapper recommandé pour contexte HTML : `escapeHtml()` (existe, ligne 23156) ou `_escapeHtmlSafe()` (ligne 5248).
- Wrapper pour `onclick` : `_jsStr()`.
- Pattern dangereux récurrent à rechercher : `.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')` (ou tout `.replace` réinjectant du HTML à partir d'une capture de variable externe) **sans** `escapeHtml()` en amont — c'est la signature exacte des 2 failles MMA.
- Variables SAFE BY DESIGN à ne PAS patcher : `s.key`, `p.onclick`, `glossaryTerms`, `b.id`/`t.id` (numériques), `safeId`/`matchId` pré-échappés, `def.label`/`def.cls` (hardcoded), valeurs `_fmt`/`.toFixed()`/`Math.round`.

**Statut LOT 2 MMA : TERMINÉ — 2/2 CRITICAL patchés, 0 restant, prod non cassée.**
