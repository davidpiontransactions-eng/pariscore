# 🛌 Session Handoff — Resume Tomorrow

> **Stop session** : 21 mai 2026 fin journée
> **Dernière commit** : `73b74c2` v12.17 (CHANGELOG update session)
> **Total session** : 29 commits poussés `main` (v11.1 → v12.17)
> **Tickets fermés** : 29 / 50+ créés
> **Resume command** : `bd ready` puis lire ce fichier

---

## ⚠️ ACTIONS OPS BLOQUANTES (DG manuel, ne peut pas être automatisé)

### 🔴 SÉCURITÉ — Incident `c8m` (CRITIQUE — priorité absolue)
**Incident** : `37.65.65.25` (Nantes FR SFR) a téléchargé `server.js` le 20/05 00:26 UTC.
**Status rotation 8 clés** :
- [x] `JWT_SECRET` — DONE v12.x
- [ ] `ADMIN_PASSWORD` — pending
- [ ] `GA_POSTBACK_TOKEN` — pending
- [ ] `TELEGRAM_BOT_TOKEN` — pending via @BotFather
- [ ] `ODDS_API_KEY` — pending dashboard the-odds-api.com
- [ ] `GEMINI_API_KEY` — pending console aistudio.google.com
- [ ] `API_FOOTBALL_KEY` — pending dashboard api-football.com
- [ ] `BSD_API_KEY` — pending email bzzoiro@proton.me

**Actions complémentaires** :
- [ ] Ban IPs nginx : `sudo ufw deny from 37.65.65.25 to any && sudo ufw deny from 78.153.140.0/24 to any && sudo ufw reload`
- [ ] Apply nginx hardening (`.context/nginx_hardening_pariscore.conf`)
- [ ] Audit DB post-breach : `sqlite3 pariscore.db < .context/audit_db_post_breach.sql > /tmp/audit.txt`
- [ ] Activation banner UI : `localStorage.setItem('cf_security_banner', '1')` post final JWT rotate

### 🟠 SQLite `b50` — Diagnostic à exécuter
```bash
ssh ubuntu@<vps>
cd /home/ubuntu/pariscore
bash .context/diag_sqlite_corruption.sh > /tmp/sqlite_diag.txt
less /tmp/sqlite_diag.txt
```
Si corruption → procédure recovery dans script.

### 🟠 Momentum La Liga `8c5` — Validation prod
Deploy + restart + observer match La Liga live 5min → momentum bars dom/ext au lieu flat-line.

---

## 🔓 KEY ROTATION REMINDER QUICK COMMANDS

```bash
# Génération sécurisée
openssl rand -hex 64        # JWT_SECRET (64 bytes hex)
openssl rand -hex 24        # GA_POSTBACK_TOKEN (24 bytes hex)
openssl rand -base64 30     # ADMIN_PASSWORD (30+ chars)

# Restart après update .env
ssh ubuntu@<vps>
cd /home/ubuntu/pariscore
nano .env                   # paste new keys
pm2 restart pariscore
pm2 logs --lines 30         # verify boot
```

---

## 📋 BACKLOG PRIORISÉ POUR RESUME DEMAIN

### 🔴 P0 — Critique sprint courant (2 ouvertes)
1. **`c8m`** SECURITY rotation clés — actions OPS DG (voir ci-dessus)
2. **`9je`** ETL Historique pipeline — scaffold livré `seed_historique_db.js`
   - Next : run `node seed_historique_db.js --sample-pl` validation extraction
   - Puis : frontend integration `#page-historique` + lazy-loading

### 🟠 P1 — Sprint suivant 1-2 sem (6 ouvertes)
1. **`8c5`** Momentum La Liga — validation prod fix v12.14
2. **`b50`** SQLite corruption — run diag VPS
3. **`c5i`** Tennis serving cross-source — AiScore merge BSD `_live` shape (refactor data)
4. **`e7l`** Mobile PWA polish — install prompt UI + push notifications + splash iOS
5. **`qe5`** Live Dashboard Cockpit Phase 1 — sprint dédié 5-7j feature majeure
6. **`x9s`** Plug oddsapi tous champs cotes — depend `qkx` eval positive d'abord

### 🟡 P2 — Innovations différées (15 ouvertes)
- SSE bloqués : `a8n` Market Divergence + `6v0` DR Spike → débloque `c0c` + `647` UI pulses
- Backend lourd : `cty` CLV strategy, `6xw` Break Point Pressure
- Sparklines : `tvf` Foot live + `9bg` PBP Tennis
- Spike eval : `qkx` RapidAPI odds-api1 (gate pour x9s)
- ParisScorebis-401 QA remaining (CRIT-3 + MAJ-1/3/5/6)
- `bjv` Spike OddsPortal — research livrée (.context/spike_odds_alternatives.md), décision DG
- `sml` Test ps-test post-x9s
- ParisScorebis-3u9, b3b, bvu, zia (pre-existing P2)

### ⚪ P3 — Polish + consolidation (5 ouvertes)
- BD-DATA-009 Travel Factor, BD-DATA-010 PBP streaming, BD-DATA-011 CLV temps réel, BD-DATA-012 Steam detector
- UI-013 CLV tracker, UI-015 Break Point halo
- Pre-existing : 3vn TTL cache, 9ij Tennis alias, dt9 AiScore frontend hook, h6a Tennis Abstract Elo, i5r LiveScore tennis

---

## 📦 RAPPORTS DRAFT EN ATTENTE ARBITRAGE DG

| Fichier | Contenu |
|---|---|
| `rapport_innovations_core_tabs.md` | 12 INNOV roadmap P0/P1/P2 (Phase 1 livrée v12.0-2.4) |
| `rapport_qa_foot_tennis.md` | 28 risk flags (8 fixés, 20 différés) |
| `rapport_design_system_v2.md` | Design V2.0 spec (5 phases livrées Epic 70r) |
| `rapport_design_system_v2_qa_visuel.md` | Validation tokens runtime |
| `.context/spike_odds_alternatives.md` | Décision provider abstraction $30/mo combo |
| `.context/incident_securite_20260520.md` | Dossier preuves légales |
| `.context/audit_db_post_breach.sql` | Queries audit post-breach |
| `.context/diag_sqlite_corruption.sh` | Script diag SQLite |
| `.context/nginx_hardening_pariscore.conf` | Nginx ACL + rate limit + headers |

---

## 🎯 PROCHAINE SESSION — Recommandations 1ère heure

### Si DG arrive avec OPS critiques validés
1. Vérifier statut rotation clés (sudo grep KEY /home/ubuntu/pariscore/.env)
2. Vérifier ban IPs (sudo ufw status)
3. Run audit DB post-breach + analyser anomalies
4. Si tout clean → close `c8m` ticket

### Si DG arrive frais sans actions OPS
1. Demander statut OPS (rotation, ban, audit DB)
2. Si pas done → guide pas-à-pas commandes (déjà documenté ci-dessus)
3. Si done → tackle next P0 (`9je` ETL Historique run sample-pl)

### Tâches valeur ajoutée tractables
- **ETL Historique ingestion** (`9je`) : run `node seed_historique_db.js --sample-pl` puis intégration frontend
- **QA fix CRIT-3** : ajouter throttled trace helper aux 11 broad catches server.js
- **e7l PWA polish** : ajouter install prompt UI button + push notif scaffold
- **x9s prep** : si DG valide qkx eval positive, créer providers/odds_provider.js abstraction

---

## 🎲 LIENS UTILES SESSION

- Repo : `C:\Users\david\Documents\dev PariScore\ParisScorebis`
- Prod : `https://pariscore.fr`
- VPS : `ssh ubuntu@<vps-ip>` puis `/home/ubuntu/pariscore`
- Git remote : `https://github.com/davidpiontransactions-eng/pariscore`
- bd command : `bd ready` (5 next), `bd list --status=open --priority=0`

---

## 📊 SESSION STATS

- Durée session : ~10h
- Commits : 29 (v11.1 → v12.17)
- Lignes ajoutées : ~5000+ (CF overlay + Design V2 + rapports + scripts + scaffolds)
- Tickets fermés : 29 (Sprint 1 P0 + Design V2 epic + QA fixes + bugs + scaffolds)
- Tickets ouverts : 28 (P0×2, P1×6, P2×15, P3×5)
- Tickets créés : 7 nouveaux (9je, qkx, x9s, sml, t8r, n4g, autres)
- Bd issues exported : 158 cumulés (lifetime)
- Rapports doc : 5 markdown + 2 scripts shell/SQL + 1 nginx conf

---

*Session bien remplie. Bon repos.*
*Resume : `cat .context/session_resume_handoff.md` puis `bd ready`.*
