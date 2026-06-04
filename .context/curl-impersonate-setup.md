# curl-impersonate — Cloudflare TLS JA3 bypass (TA + BetMines)

**Problème** : Cloudflare Bot Management fingerprint le handshake TLS/HTTP2 de Node.js
(`https` natif = JA3 non-navigateur) → `HTTP 403` sur tennisabstract.com + api.betmines.com.
Les headers sont déjà parfaits (Chrome UA + Accept + Referer + sec-ch-ua) — le blocage est
au niveau TLS, donc **aucun fix par header n'est possible**.

**Solution** : [curl-impersonate](https://github.com/lexiforest/curl-impersonate) mime le
handshake TLS de Chrome → passe le filtre CF. Zéro dépendance npm (appel via `child_process`).

Code : `server.js` → `curlImpersonateGet()` + `cfBypassGet()` (sélecteur transparent).
Activé par `USE_CURL_IMPERSONATE=1` → réactive automatiquement TA + BetMines.

---

## Install VPS (Ubuntu, une fois)

```bash
cd /tmp
# Fork actif 2026 (lexiforest). Vérifier la dernière release pour la version.
wget https://github.com/lexiforest/curl-impersonate/releases/download/v1.2.1/curl-impersonate-v1.2.1.x86_64-linux-gnu.tar.gz
sudo mkdir -p /opt/curl-impersonate
sudo tar -xzf curl-impersonate-*.tar.gz -C /opt/curl-impersonate

# Test direct (doit renvoyer 200, pas 403)
/opt/curl-impersonate/curl_chrome116 -s -o /dev/null -w "%{http_code}\n" https://www.tennisabstract.com/
```

> ⚠️ **Ne pas symlink** le wrapper dans `/usr/local/bin` : le script `curl_chromeXXX`
> résout sa lib `.so` via `$(dirname $0)`. Toujours appeler par **chemin absolu**.

---

## Activer

Ajouter au `.env` VPS :

```bash
USE_CURL_IMPERSONATE=1
CURL_IMPERSONATE_BIN=/opt/curl-impersonate/curl_chrome116
```

Puis :

```bash
cd ~/pariscore && pm2 restart server
pm2 logs server --lines 30 --nostream | grep -i "curl-impersonate\|TennisAbstract\|BetMines"
```

Log attendu :
```
[curl-impersonate] ENABLED (bin=/opt/curl-impersonate/curl_chrome116) — CF TLS bypass actif (TA + BetMines).
```
Et plus de `HTTP 403` dans `server-error.log`.

---

## Limites

- **TLS bypass uniquement.** Si CF active un **Turnstile / challenge JS** sur ces domaines,
  le binaire renvoie `200` + la page de challenge (pas la data) → parser vide.
  Dans ce cas → **Web Unlocker** (Bright Data / ScraperAPI, payant, défait Turnstile).
- Binaire absent → `curlImpersonateGet` rejette proprement (`ENOENT`), les callers
  loggent l'échec sans crash. Repli : laisser `USE_CURL_IMPERSONATE=0` (sources off,
  fallback Elo interne BSD + consensus Sofascore/Forebet).

---

## Désactiver / rollback

```bash
# .env VPS : retirer ou mettre à 0
USE_CURL_IMPERSONATE=0
pm2 restart server
```
Sources retournent à l'état désactivé par défaut (zéro 403, zéro data TA/BetMines).
