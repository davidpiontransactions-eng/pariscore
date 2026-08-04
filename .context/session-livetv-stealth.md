# Session: LiveTV Stealth Pipeline (2026-08-05)

**Contexte** : Vers un pipeline de résolution de streams LiveTV (livetv902.me)
résilient aux blocages IP datacenter — prefetch native + fallback furtif
Scrapling/patchright en cas de rejet.

**Blocage confirmé** : LiveTV renvoie **HTTP 451** depuis les IP de datacenter
(VPS OVH `ubuntu@51.75.21.239`). Même le fetch furtif Camoufox/stealth Chrome
depuis le VPS échoue : `{"ok": false, "status": 451, "error": "stealth refusé",
"elapsed_ms": 6216}` — test en direct (2026-08-05). Le 451 est un **blocage IP**
(450/451 = "unavailable for legal reasons"), pas un anti-bot JS : seule une IP
résidentielle (proxy `SCRAPLING_PROXY_URL`) le fera passer.

**Fichiers clés** :
- `scripts/livetv-stealth-fetch.py` — CLI Python one-shot (patchright stealth
  Chrome, timeout 90s, stdout JSON one-line `{ok,status,url?,path,bytes?,error?,
  elapsed_ms}`, HTML écrit dans un fichier temp jamais stdout).
- `src/lib/scrapling-bridge.ts` — pont Node → script Python (`execFile`),
  flags `SCRAPLING_ENABLED` / `SCRAPLING_PROXY_URL` / `SCRAPLING_PYTHON`
  (défaut `python3` sur Linux, `python` sur Windows).
- `src/lib/livetv-stream-service.ts` — `fetchHtml` : fetch natif d'abord ; sur
  `LIVETV_HTTP`/`LIVETV_BLOCKED` ET `SCRAPLING_ENABLED=true` → fallback
  `stealthFetchHtml(url)` ; si stealth échoue, ré-émet l'erreur native
  (préserve le fallback miroir livetv903 + cache négatif).
- `src/app/api/stream/resolve/route.ts` — route GET (cache CDN 10 min).

**Métriques** : local (IP résidentielle, sans proxy) stealth ≈ 25-35s pour
301-303 Ko de HTML (`so ok: 200, bytes: 303217, ms: 33653`).

## Installation VPS (faite)

Système Python 3.13 = PEP 668 (externally-managed) → **venv dédié** :
```bash
cd /home/ubuntu/pariscore
python3 -m venv .venv-scrapling
.venv-scrapling/bin/pip install "scrapling[fetchers]" \
  && .venv-scrapling/bin/pip install --force-reinstall \
     "scrapling==0.4.11" "browserforge==1.2.4" "patchright==1.61.2" \
     "curl_cffi==0.15.0" "apify-fingerprint-datapoints==0.13.0"
.venv-scrapling/bin/patchright install chromium   # binaire navigateur
```

⚠️ **Pins nécessaires** : scrapling 0.4.12 (nouvelle casse `browserforge` au
import (`ValueError: No headers based on this input`) — c'est 0.4.11 + les pins
ci-dessus qui marchent (verifié : `StealthyFetcher OK`).

⚠️ `scrapling install` (CLI) ne marche pas sur ce VPS : il appelle
`playwright install-deps chromium` → échoue car le repo apt Jenkins est cassé
(GPG NO_PUBKEY 7198F4B714ABFC68) ; et l'extra `[camoufox]` n'existe pas dans
0.4.11+. Utiliser `scrapling[fetchers]` + `patchright install chromium` à la place.

**Config requise pour activer le fallback en prod** (actuellement désactivé) :
```env
SCRAPLING_ENABLED=true
SCRAPLING_PROXY_URL=http://user:pass@proxy.residentiel:port   # obligatoire
SCRAPLING_PYTHON=/home/ubuntu/pariscore/.venv-scrapling/bin/python3
```
Sans proxy résidentiel, ne pas activer : le stealth échoue pareil (451) → coût
inutile (~6s + ressources navigateur sur chaque résolution non cache).

## Script de test local

```bash
python scripts/livetv-stealth-fetch.py "https://livetv902.me/enx/megasearch/?msq=psg"
# {"ok": true, "status": 200, "url": "...", "path": "...Temp\\livetv-stealth-*.html",
#  "bytes": 303217, "elapsed_ms": 24125}
```

## Statut

- [x] Bridge TS + fallback service + .env.example (tsc clean, bun -e testé)
- [x] Installation scrapling 0.4.11 venv VPS + patchright chromium
- [x] Diagnostic : 451 = blocage IP → proxy résidentiel requis
- [ ] Proxy résidentiel (`SCRAPLING_PROXY_URL`) + activation flag prod
- [ ] Commit + déploiement VPS une fois le code validé