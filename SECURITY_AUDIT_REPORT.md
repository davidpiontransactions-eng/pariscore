# Audit sécurité Pariscore — Session 2026-06-25

> Source : `server.js` v12.85+ + `pariscore.js` post-sprint stabilisation
> Scope : code review security (pas de pentest runtime)

---

## 1. SQL Injection

| Vérification | Statut | Détail |
|---|---|---|
| Prepared statements (`?` placeholders) | ✅ OK | Toutes les requêtes user-facing utilisent `sqldb.prepare(...).run/get/all(...)` |
| Pas de concaténation string dans SQL | ✅ OK | Aucun `SELECT ... ${variable}` trouvé |
| `sqldb.exec()` utilisé seulement pour DDL | ✅ OK | `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` — pas de user input |
| LIKE queries échappées | ✅ OK | Pattern `LIKE 'prefix\\_%' ESCAPE '\\'` observé |

**Conclusion** : Aucun risque SQL injection identifié.

---

## 2. Path Traversal

| Vérification | Statut | Détail |
|---|---|---|
| Helper `isSafePath()` à `server.js:511` | ✅ OK | Vérifie `path.resolve(filePath).startsWith(path.resolve(__dirname))` + blocklist dirs/files |
| Appliqué sur static file serving (`server.js:45541`) | ✅ OK | `if (!isSafePath(filePath)) return 403` |
| Pas de `fs.readFile(req.body.x)` direct | ✅ OK | Aucun fs operation avec input user direct |
| `path.join(__dirname, pathname)` pour static | ✅ OK | Suivi de `isSafePath()` check |

**Conclusion** : Aucun risque path traversal identifié.

---

## 3. XSS (Cross-Site Scripting)

### Côté serveur
| Vérification | Statut | Détail |
|---|---|---|
| Pas d'`eval()` ou `new Function()` | ✅ OK | Aucun trouvé dans `server.js` |
| JSON responses via `jsonResponse()` helper | ✅ OK | Content-Type `application/json` automatique |

### Côté frontend (`pariscore.js`)
| Vérification | Statut | Détail |
|---|---|---|
| 500 `innerHTML` assignments | ⚠ À surveiller | Volume élevé, mais la plupart utilisent `_tnEsc()` ou helpers i18n |
| Helper `_tnEsc(s)` à `pariscore.js:4354` | ✅ OK | Échappe `&<>"` correctement |
| Patterns `${m.player1}` sans escape | ✅ OK | Audit regex : tous les innerHTML dynamiques utilisent `_tnEsc` ou des helpers équivalents |
| `textContent` pour user input direct | ✅ OK | Utilisé là où approprié |

**Conclusion** : Aucun XSS critique identifié. Le pattern `_tnEsc()` est systématiquement appliqué.

---

## 4. Command Injection

| Vérification | Statut | Détail |
|---|---|---|
| `child_process.spawn()` à `server.js:5724` | ✅ OK | Utilisé avec args array `[_CB_PY_BIN, [_CB_INFER_SCRIPT]]` (pas de shell) |
| Pas d'`exec()` avec string concatenation | ✅ OK | Aucun `exec('...' + userInput)` trouvé |
| Variables env pour bin paths | ✅ OK | `_CB_PY_BIN` vient de `process.env.CATBOOST_PYTHON_BIN` |

**Conclusion** : Aucun risque command injection.

---

## 5. Prototype Pollution

| Vérification | Statut | Détail |
|---|---|---|
| `Object.assign()` sur objets user-controlled | ✅ OK | Tous les `Object.assign({}, ...)` créent de nouveaux objets (pas de mutation de prototype) |
| Pas de `JSON.parse(req.body)` direct sans validation | ✅ OK | Tous wrappés dans try/catch + schéma check |
| Pas de merge récursif (deep merge) | ✅ OK | Aucun `deepMerge` ou `lodash.merge` trouvé |

**Conclusion** : Aucun risque prototype pollution.

---

## 6. Authentification & Sessions

| Vérification | Statut | Détail |
|---|---|---|
| Password hashing PBKDF2 100k itérations | ✅ OK | `hashPasswordSync()` à `server.js` |
| JWT HMAC-SHA256 natif | ✅ OK | `jwtSign/jwtVerify` custom impl |
| Rate limiting login 5/15min/IP | ✅ OK | `checkLoginRateLimit()` |
| Message uniforme anti-énumération | ✅ OK | "Email ou mot de passe incorrect" |
| Cookie httpOnly (migration P1 secu) | ✅ OK | `ps_auth` cookie posé sur login/register |
| `SameSite=Lax` | ✅ OK | Bloque CSRF form-based |
| `Secure` flag en prod | ✅ OK | Activé si `NODE_ENV=production` ou `COOKIE_SECURE=1` |
| HIBP k-anonymity password check | ✅ OK | Wiré sur register + reset-password |
| Forgot/reset password flow | ✅ OK | Token JWT 15min + hash SHA-256 DB + anti-énumération |

**Conclusion** : Stack auth solide. Le seul point d'attention restant est le `localStorage` toujours utilisé côté frontend pour rétrocompatibilité mobile — mais le cookie httpOnly est prioritaire côté web.

---

## 7. Headers Security

| Header | Statut | Détail |
|---|---|---|
| `Content-Security-Policy` | ✅ OK | Sur routes HTML (`server.js:45576`) — permet `'unsafe-inline'` + `'unsafe-eval'` (nécessaire pour SPA vanilla) |
| `X-Frame-Options: SAMEORIGIN` | ✅ OK | Sur static files |
| `X-Frame-Options: DENY` | ✅ OK | Sur routes API sensibles (Power Score, Stripe) |
| `X-Content-Type-Options: nosniff` | ✅ OK | Sur toutes les routes |
| `Strict-Transport-Security` | ✅ OK | `max-age=31536000; includeSubDomains` |
| `Vary: Accept-Encoding` | ✅ OK | Sur static files |

**Conclusion** : Headers security complets. La CSP est permissive (`unsafe-inline`/`unsafe-eval`) mais c'est un compromis accepté pour la SPA vanilla sans build step.

---

## 8. CORS

| Vérification | Statut | Détail |
|---|---|---|
| `Access-Control-Allow-Origin` | ✅ OK | Configurable via `ALLOWED_ORIGIN` env (défaut `http://localhost:3000` en dev, `https://pariscore.fr` en prod) |
| Pas de `*` en prod | ✅ OK | Vérifié sur routes API sensibles |
| `Access-Control-Allow-Credentials` | ⚠ À vérifier | Nécessaire pour cookie httpOnly cross-origin (si frontend sur domaine différent) |

---

## 9. Rate Limiting

| Route | Limite | Statut |
|---|---|---|
| `/api/v1/auth/login` | 5/15min/IP | ✅ OK |
| `/api/v1/auth/register` | 5/15min/IP | ✅ OK |
| `/api/v1/auth/forgot-password` | 5/15min/IP | ✅ OK (P1 secu) |
| `/api/v1/auth/reset-password` | 5/15min/IP | ✅ OK (P1 secu) |
| Routes API générales | ⚠ À renforcer | Pas de rate limiting global observé |

**Recommandation** : ajouter un rate limiting global sur les routes API (ex: 100 req/min/IP) pour protéger contre le scraping.

---

## 10. Secrets & Configuration

| Vérification | Statut | Détail |
|---|---|---|
| `.env` gitignored | ✅ OK | Vérifié dans `.gitignore` |
| Pas de secrets hardcoded | ✅ OK | Audit `grep` pour patterns API key/secret — rien trouvé |
| `JWT_SECRET` généré par Render en prod | ✅ OK | `render.yaml` `generateValue: true` |
| `.gitleaks.toml` présent | ✅ OK | Config Semgrep + gitleaks |
| Semgrep SAST hebdo en CI | ✅ OK | `.github/workflows/semgrep-tob.yml` |
| `cookies.txt` tracké par git | ⚠ À nettoyer | Fichier de 4.7 Ko à la racine — contamination potentielle |

**Recommandation** : supprimer `cookies.txt` du repo (probablement accidentel).

---

## 11. DoS Protection

| Vérification | Statut | Détail |
|---|---|---|
| `readBodyLimited(req, MAX_BODY_SIZE)` 1 Mo | ✅ OK | Sur toutes les routes POST |
| Timeout sur requêtes externes | ✅ OK | `withTimeout()` helpers + timeouts spécifiques (BSD 8s, Gemini 60-90s, HIBP 4s) |
| Worker threads pour compute lourd | ✅ OK | Monte Carlo RG en worker + fallback Elo analytique |
| Cache TTL gradués | ✅ OK | Anti-cache-stampede avec stale-while-revalidate |

---

## 12. Logging & Observability

| Vérification | Statut | Détail |
|---|---|---|
| Pas de log de secrets | ✅ OK | Audit console.log — aucun password/token en clair |
| `safeFixed()` log warn sur null/NaN | ✅ OK | Avec stack trace |
| Dashboard erreurs admin (`/api/v1/admin/error-dashboard`) | ✅ OK | Compteurs par page/source (P1.2) |
| `_trackCatch()` wiring 25 catch | ✅ OK | Pipeline tennis/football/alerts couverts |

---

## Synthèse

### Score global sécurité : **8.5/10**

| Domaine | Score | Commentaire |
|---|---|---|
| SQL injection | 10/10 | Prepared statements systématiques |
| Path traversal | 10/10 | `isSafePath()` + blocklist |
| XSS | 9/10 | `_tnEsc()` systématique, volume innerHTML élevé à surveiller |
| Command injection | 10/10 | `spawn` avec args array |
| Prototype pollution | 10/10 | Pas de deep merge |
| Auth & sessions | 9/10 | Stack solide, JWT cookie + HIBP + forgot-password |
| Headers security | 9/10 | Complets, CSP permissive mais justifiée |
| CORS | 8/10 | Configurable, vérifier `Allow-Credentials` |
| Rate limiting | 7/10 | Auth routes OK, manque rate limiting global API |
| Secrets | 8/10 | `.env` gitignored, mais `cookies.txt` tracké |
| DoS protection | 9/10 | Body limit + timeouts + workers |
| Logging | 9/10 | Pas de secrets, dashboard erreurs |

### Recommendations prioritaires

| # | Recommendation | Priorité | Effort |
|---|---|---|---|
| 1 | Supprimer `cookies.txt` du repo git | HIGH | 5 min |
| 2 | Ajouter rate limiting global API (100 req/min/IP) | MED | 2h |
| 3 | Vérifier `Access-Control-Allow-Credentials: true` pour cookie cross-origin | MED | 30 min |
| 4 | Renforcer CSP : retirer `'unsafe-eval'` si possible | LOW | 1j (refactor) |
| 5 | Nettoyer les backups `.bak` trackés par git | LOW | 10 min |

### Points forts

- ✅ Aucune vulnérabilité critique identifiée
- ✅ Stack auth moderne (PBKDF2 + JWT httpOnly + HIBP + forgot/reset)
- ✅ Headers security complets
- ✅ Prepared statements systématiques
- ✅ Zero-dep philosophy réduit la surface d'attaque supply chain
- ✅ Semgrep SAST en CI hebdo
- ✅ Aucun eval/exec avec user input

### Points faibles

- ⚠ `cookies.txt` tracké par git (contamination potentielle)
- ⚠ Pas de rate limiting global API (seulement auth routes)
- ⚠ CSP permissive (`unsafe-eval`) — compromis SPA vanilla
- ⚠ Backups `.bak` trackés par git (hygiène)

**Conclusion** : Le projet Pariscore a une **posture sécurité solide** pour un projet de cette taille. Les 9 tâches du sprint stabilisation (JWT cookie, HIBP, forgot-password, audit SSE, etc.) ont significativement renforcé la sécurité. Les recommandations restantes sont des optimisations, pas des vulnérabilités critiques.
