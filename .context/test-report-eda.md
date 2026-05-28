# Test Report — EDA Toolkit (fg-data-profiling + D-Tale + PandasAI)
**Date** : 2026-05-28

## ✅ Tests passés

- `node --check server.js` → SYNTAX OK (post toutes corrections)
- `_EDA_PY_BIN` résolution cross-platform : Win32 `.venv-data\Scripts\python.exe` / Linux `.venv-data/bin/python`
- `_edaTable()` sanitize regex `[^a-z0-9_]` → élimine injection SQLite via table name
- `_edaParseOut()` → extrait last JSON-line même si Python émet warnings avant JSON
- Routes JWT admin : `GET /api/v1/admin/eda/tables`, `GET /api/v1/admin/eda/profile`, `GET /api/v1/admin/eda/dtale`, `POST /api/v1/admin/eda/chat`
- `/eda/profile/:table` → auth admin vérifiée (403 si non-admin)
- D-Tale detached spawn : Node.js répond après 2s, processus Python survit indépendamment
- Python `run_dtale` : print JSON early → flush → sleep 7200 → Flask D-Tale thread reste vivant
- Port clamping D-Tale : `1024–65534` (interdit ports système < 1024)
- VPS install script `tools/install-eda-vps.sh` : Python 3.11 auto-detect + fallback `apt-get`
- Smoke test imports : `fg-data-profiling`, `dtale`, `pandasai` OK en venv 3.11

## ⚠️ Avertissements (non bloquants)

### W1 — PandasAI nécessite OPENAI_API_KEY
**Localisation** : `tools/pariscore-eda.py` `run_chat()` + route `/api/v1/admin/eda/chat`
**Problème** : Sans clé OpenAI ou PandasAI, la route retourne `{"ok": false, "error": "OPENAI_API_KEY manquante"}` — UX pauvre.
**Recommandation** : Ajouter documentation dans admin dashboard + retourner HTTP 503 avec message explicite (actuellement HTTP 200 avec `ok: false`).

### W2 — D-Tale port fixe par défaut (40000)
**Localisation** : `_spawnEDA` dtale route, query param `?port=`
**Problème** : Si port 40000 déjà occupé sur VPS (autre service, autre D-Tale), spawn silencieux échoue.
**Recommandation** : Ajouter vérification `net.createServer().listen(port)` avant spawn + retry port+1.

### W3 — fg-data-profiling timeout 180s peut être court pour grandes tables
**Localisation** : `_spawnEDA(..., 180000)` profiling route
**Problème** : `archive_matches` peut avoir 50k+ lignes → profiling minimal prend 60-90s mais en cas de charge CPU VPS, timeout 180s peut être atteint.
**Recommandation** : Passer en `minimal=True` (déjà par défaut) + documenter limite ~20k lignes conseillée.

### W4 — D-Tale flask server non authentifié
**Localisation** : D-Tale expose port 40000 directement sans auth
**Problème** : Si VPS firewall laisse passer port 40000, D-Tale est accessible sans JWT.
**Recommandation** : Configurer ufw pour bloquer port 40000 depuis l'extérieur (`ufw deny 40000`). D-Tale accessible uniquement via reverse proxy ou tunnel SSH local.

## ❌ Bugs détectés et corrigés

### BUG-1 — SECURITY : `/eda/profile/:table` sans auth ❌ → ✅ CORRIGÉ
**Sévérité** : CRITICAL
**Localisation** : `server.js` route `GET /eda/profile/:table`
**Code problématique** : Route servait les rapports HTML (données DB sensibles) sans vérification JWT
**Fix** : Ajout `const u = getAuthUser(req); if (!u || u.role !== 'admin') return jsonResponse(res, 403, ...)`

### BUG-2 — JSON parse crash si Python émet warnings ❌ → ✅ CORRIGÉ
**Sévérité** : HIGH
**Localisation** : `_spawnEDA()` parser + `_edaParseOut()`
**Code problématique** : `JSON.parse(raw)` crashait si Python imprimait `FutureWarning` avant le JSON
**Fix** : `_edaParseOut()` filtre les lignes commençant par `{`, prend la dernière

### BUG-3 — D-Tale subprocess mort dès spawn Node.js ❌ → ✅ CORRIGÉ
**Sévérité** : HIGH
**Localisation** : `server.js` route dtale + `tools/pariscore-eda.py` `run_dtale()`
**Code problématique** : `subprocess=True` Python (thread interne) survivait tant que le processus Python vivait, mais le processus Python se terminait dès la fin du script
**Fix** : Node.js spawn `detached: true` + `stdio: 'ignore'` + `child.unref()` ; Python print JSON → flush → sleep(7200)

### BUG-4 — `_EDA_PY` Linux path incorrect ❌ → ✅ CORRIGÉ
**Sévérité** : MEDIUM
**Localisation** : `server.js` constante `_EDA_PY_BIN`
**Code problématique** : Default Linux était `.venv-data/Scripts/python` (Windows path sur Linux)
**Fix** : Ternaire OS → Win32 `Scripts/python.exe` / autres `bin/python`

### BUG-5 — Table vide après sanitize provoque erreur SQLite ❌ → ✅ CORRIGÉ
**Sévérité** : MEDIUM
**Localisation** : `server.js` helper `_edaTable()`
**Code problématique** : `table.replace(/[^a-z0-9_]/gi,'')` sur input `"../secret"` → `""` → SQL `SELECT * FROM ` crashait
**Fix** : `_edaTable()` retourne `null` si résultat vide → route répond HTTP 400

### BUG-6 — Port D-Tale non validé ❌ → ✅ CORRIGÉ
**Sévérité** : LOW
**Localisation** : `server.js` route dtale
**Code problématique** : `port = parseInt(q.port) || 40000` acceptait port 22 ou 80 → conflit système
**Fix** : Clamp `Math.max(1024, Math.min(65534, parseInt(q.port) || 40000))`

## 💡 Recommandations d'amélioration

1. **Supervision D-Tale** : Stocker PID dans `db.kv` (`eda_dtale_pid`) → route `DELETE /api/v1/admin/eda/dtale` pour kill propre
2. **PandasAI local LLM** : Brancher Ollama (llama3.2 local) comme fallback si `OPENAI_API_KEY` absent → 0 coût cloud
3. **ufw VPS** : `ufw deny 40000` post-deploy pour D-Tale non-exposé public
4. **Cron EDA auto** : Profiling hebdomadaire `player_surface_scores` → email/Telegram admin avec lien rapport
5. **Route profile streaming** : Pour tables >20k lignes, streamer le HTML via SSE pendant génération plutôt que timeout 180s
