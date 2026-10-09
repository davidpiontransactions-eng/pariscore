#!/bin/bash
# scripts/update_vps.sh — VPS deploy runner (streamed to VPS by scripts/deploy.bat)
#
# Smart deploy: skips `npm install` + `next build` when only LEGACY files changed
# (pariscore.{html,app.js,js}, services/*.js, data/*.json, public/**).
# Legacy-only deploy ~15-30s vs ~3min full build. Build runs iff src/app/next.config/
# package.json/tsconfig changed. Safe default = full build (first run / unknown diff).
#
# Env overrides: DEPLOY_DIR, PM2_LEGACY, PM2_NEXT, SKIP_DISCORD=1
set -uo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/pariscore}"
PM2_LEGACY="${PM2_LEGACY:-pariscore}"        # legacy server.js — serves pariscore.html + /api/v1/cs2/*
PM2_NEXT="${PM2_NEXT:-pariscore-next}"        # Next.js standalone

cd "$DEPLOY_DIR" || { echo "ERR: deploy dir $DEPLOY_DIR introuvable"; exit 1; }

# Préserver les données de data/ produites par les crons VPS.
#
# Deux modes de perte au `git reset --hard origin/main` :
#   1. un fichier TRACKÉ puis désindexé (« untrack ») est SUPPRIMÉ de l'arbre :
#      c'est ce qui arrivera aux ~250 data/*.json désindexés par le commit
#      « fix(git): untrack dynamic data json snapshots » au deploy suivant, et
#      ce qui est arrivé à flashscore_handball.json (remis au snapshot committé
#      du 2026-09-28 → onglet Handball vide, bead ParisScorebis-1gge) ;
#   2. un fichier tracké modifié par un cron est RÉINITIALISÉ à la version
#      committée : le run du cron est perdu jusqu'au prochain tick (drama pour
#      les crons hebdomadaires : matrix lundi, photos lundi, hbl-stats lun/jeu).
# Donc : sauvegarde de TOUS les fichiers de data/ trackés AVANT le reset, puis
# restauration UNIQUEMENT de ceux disparus après le reset (ceux toujours trackés
# sont déjà corrects — le reset les a remis lui-même).
DATA_BACKUP=$(mktemp -d)
git ls-files data 2>/dev/null | while read -r f; do
  mkdir -p "$DATA_BACKUP/$(dirname "$f")" 2>/dev/null
  cp "$f" "$DATA_BACKUP/$f" 2>/dev/null || true
done

PREV="$(git rev-parse HEAD 2>/dev/null || echo '')"

echo "[1/6] git fetch + reset --hard origin/main..."
git fetch --all -q || { echo "ERR: git fetch"; exit 1; }
git reset --hard origin/main -q || { echo "ERR: git reset"; exit 1; }

# Restauration des données scrapées devenues absentes après le reset.
if [ -d "$DATA_BACKUP/data" ]; then
  find "$DATA_BACKUP/data" -type f 2>/dev/null | while read -r src; do
    rel="${src#"$DATA_BACKUP"/}"
    if [ ! -f "$rel" ]; then
      mkdir -p "$(dirname "$rel")" 2>/dev/null
      cp "$src" "$rel" 2>/dev/null || true
    fi
  done
fi
rm -rf "$DATA_BACKUP"

CURR="$(git rev-parse HEAD)"

# Nothing to deploy? Exit fast (idempotent re-run).
# FORCE_BUILD=1 court-circuite cette sortie : reconstruit même si git est à
# jour (cas .next cassé par un build avorté — constat 2026-10-08 : un build
# avorté laisse .next/static incohérent, pm2 sert un HTML à chunks 404).
if [ -z "${FORCE_BUILD:-}" ] && [ -n "$PREV" ] && [ "$PREV" = "$CURR" ]; then
  echo "Already up to date ($CURR). Nothing to deploy."
  echo "--- VPS_DEPLOY_OK ---"
  echo "build_ran: 0"
  pm2 jlist 2>/dev/null >/dev/null && echo "pm2: unchanged" || true
  exit 0
fi

# Diff changed files between previous and current deployed commit.
if [ -n "$PREV" ]; then
  CHANGED="$(git diff --name-only "$PREV" "$CURR" 2>/dev/null || echo '')"
else
  CHANGED=""  # first deploy → safe default (full build)
fi

# Decide what's required.
NEED_INSTALL=0   # npm install
NEED_BUILD=0     # next build
if [ -n "${FORCE_BUILD:-}" ]; then
  NEED_BUILD=1   # override manuelle : FORCE_BUILD=1 bash update_vps.sh
fi
if [ -z "$CHANGED" ]; then
  NEED_INSTALL=1; NEED_BUILD=1   # safe default
else
  # services/ INCLUS : les services sont BUNDLÉS dans les chunks Next
  # (constat 2026-09-27 : services_01bjv5_._.js contient mmaService) — les
  # classer en "legacy" laissait un bundle périmé après un fix service.
  if printf '%s\n' "$CHANGED" | grep -qE '^(src/|app/|services/|next\.config|tsconfig|postcss|tailwind|components\.json|prisma/)'; then
    NEED_BUILD=1
  fi
  if printf '%s\n' "$CHANGED" | grep -qE '^(package\.json|bun\.lock|package-lock\.json)'; then
    NEED_INSTALL=1
  fi
fi

echo "  prev=${PREV:-<none>} curr=$CURR"
if [ -n "$CHANGED" ]; then printf '    %s\n' $CHANGED; else echo "    (no diff / first run)"; fi
echo "  decision: install=$NEED_INSTALL build=$NEED_BUILD"

echo "[2/6] Syntax check (changed legacy JS)..."
SYNTAX_FAIL=0
node --check pariscore.js 2>/dev/null || { echo "ERR: pariscore.js syntaxe"; SYNTAX_FAIL=1; }
node --check pariscore.app.js 2>/dev/null || { echo "ERR: pariscore.app.js syntaxe"; SYNTAX_FAIL=1; }
[ "$SYNTAX_FAIL" = "1" ] && exit 1
if [ -n "$CHANGED" ]; then
  for f in $(printf '%s\n' "$CHANGED" | grep -E '^services/.*\.js$' || true); do
    [ -f "$f" ] && { node --check "$f" 2>/dev/null || { echo "ERR: $f syntaxe"; exit 1; }; }
  done
fi

if [ "$NEED_INSTALL" = "1" ]; then
  echo "[3/6] bun install (deps changed)..."
  bun install || { echo "ERR: bun install"; exit 1; }
  bun run rebuild 2>&1 || echo "  warn: rebuild échec (non bloquant)"
else
  echo "[3/6] bun install SKIPPED (no deps changed)"
fi

# [3b] Dépendances Python des bridges (HORS gate NEED_INSTALL : indépendantes
# de package.json).
#
# ⚠️ Dette corrigée le 2026-10-06 : euroleague_api n'était installé sur le VPS
# que par une installation manuelle, absente de tout manifeste. `bun install`
# ne voit rien de Python, donc un déploiement « propre » sur machine neuve
# reproduisait la panne : le bridge rendait {games: [], error} et le calendrier
# EuroLeague/EuroCup perdait ses matchs SANS QUE LE DÉPLOIEMENT ÉCHOUE.
#
# NON BLOQUANT, volontaire : le bridge attrape ImportError et dégrade
# proprement (euroleague-bridge.ts:84). Faire échouer tout un déploiement pour
# un calendrier dégradé serait plus cher que le défaut lui-même.
if ! python3 -c "import euroleague_api" >/dev/null 2>&1; then
  echo "[3b] euroleague_api manquant → installation (sinon calendrier EuroLeague/EuroCup dégradé)"
  if python3 -m pip install --user --break-system-packages -r scripts/requirements-bridge.txt 2>&1; then
    echo "[3b] euroleague_api installé"
  else
    echo "[3b] AVERTISSEMENT : échec pip — bridge euroleague dégradé, déploiement POURSUIT"
  fi
else
  echo "[3b] euroleague_api déjà présent (SKIP)"
fi

BUILD_RAN=0
if [ "$NEED_BUILD" = "1" ]; then
  # Prisma AVANT le build (corrigé 2026-10-03, bead ParisScorebis-2tpn).
  # Le sync était après `bun run build` : tout changement de schema partait
  # donc dans un build avec un client Prisma PERIMÉ, et `tsc` échouait sur les
  # nouveaux champs — « error TS2339: Property 'passwordHash' does not exist »
  # — deploy aborté, .next/standalone jamais produit, pm2 en 502.
  echo "[4a] Prisma schema sync (db push + generate)..."
  npx prisma db push --skip-generate 2>&1 || { echo "ERR: prisma db push"; exit 1; }
  npx prisma generate 2>&1 || { echo "ERR: prisma generate"; exit 1; }

  echo "[4/6] Next.js build... (start $(date -u +%H:%M:%S))"
  # Le jumeau `.next/standalone/pariscore.db` est une COPIE du fichier racine :
  # il peut être périmé sans aucun lien avec la source, et il n'est ni produit ni
  # nécessaire au runtime. On le supprime AVANT le build pour ne pas le laisser
  # traîner : sans cela, un redéploiement sans DATABASE_PATH le ressusciterait et
  # l'API relirait des chiffres périmés en répondant 200.
  rm -f .next/standalone/pariscore.db

  # ── BACKUP DU BUILD ACTIF (incident VPS down 2026-10-08) ────────────────────
  # `next build` PURGE .next avant de recompiler. Un build raté laissait donc
  # la prod sans bundle et le `pm2 restart` suivant servait un 502 : downtime de
  # 15 min. Le backup permet de restaurer instantly l'état précédent, et le
  # rollback est déclenché par le healthcheck (cf. section 6).
  BACKUP_DIR="$DEPLOY_DIR/.next.bak"
  rm -rf "$BACKUP_DIR"
  if [ -d "$DEPLOY_DIR/.next" ]; then
    echo "  backup du build actif -> .next.bak ($(du -sh "$DEPLOY_DIR/.next" 2>/dev/null | cut -f1))"
    cp -a "$DEPLOY_DIR/.next" "$BACKUP_DIR" || { echo "ERR: backup .next impossible"; rm -rf "$BACKUP_DIR"; }
  else
    echo "  pas de .next actif — pas de backup (premier deploy)"
  fi

  if ! bun run build 2>&1; then
    echo "ERR: Next.js build failed — deploy aborted, PM2 untouched"
    # Le build a purgé .next : on restaure l'état servi précédent, sinon la prod
    # reste sans bundle jusqu'au prochain déploiement réussi.
    if [ -d "$BACKUP_DIR" ]; then
      echo "  restauration du build précédent depuis .next.bak..."
      rm -rf "$DEPLOY_DIR/.next"
      cp -a "$BACKUP_DIR" "$DEPLOY_DIR/.next" && echo "  rollback .next OK"
    fi
    exit 1
  fi
  # Garde-fou (BUG-1) : un build Next ok ne garantit pas l'export standalone.
  # Si server.js est absent, pm2 crash en boucle (502) ; on STOPE le deploy
  # plutot que de conclure VPS_DEPLOY_OK / health OK en trompe-l'oeil.
  if [ ! -f .next/standalone/server.js ]; then
    echo "ERR: .next/standalone/server.js absent apres next build - deploy aborted"
    if [ -d "$BACKUP_DIR" ]; then
      rm -rf "$DEPLOY_DIR/.next"
      cp -a "$BACKUP_DIR" "$DEPLOY_DIR/.next" && echo "  rollback .next OK"
    fi
    exit 1
  fi
  # Le build est vert : on CONSERVE le backup jusqu'au healthcheck (section 6),
  # qui peut encore le restaurer si le runtime refuse le bundle. On ne libère
  # l'espace qu'après le "health: OK".
  BUILD_RAN=1
  echo "  build done ($(date -u +%H:%M:%S))"
  # Sync .env → standalone (.env vars lues au runtime par Next.js standalone ;
  # les vars ajoutées après le build ne seraient pas copiées sans ce step).
  cp -f .env .next/standalone/.env 2>/dev/null || true
  # Fix Windows→Linux : le package `debug` manque dans require-in-the-middle (Sentry)
  # Le dossier existe déjà dans le standalone mais `debug` n'est pas copié.
  DEBUG_FIX=$(find .next/standalone/.next/node_modules -maxdepth 1 -type d -name "require-in-the-middle-*" 2>/dev/null | head -1)
  if [ -n "$DEBUG_FIX" ] && [ ! -d "$DEBUG_FIX/node_modules/debug" ]; then
    echo "  [fix] installing missing debug in $DEBUG_FIX"
    cd "$DEBUG_FIX" && bun add debug --no-save 2>/dev/null && cd -
  fi
  # 2026-09-18 : NE PLUS réécrire les alias nginx vers /opt (incident : HTML frais
  # depuis ~/pariscore + statics périmés depuis /opt = site cassé). Le serving est
  # ~/pariscore (pm2 cwd + alias nginx) ; /opt ne sert que les données (DATA_DIR).
  # Anciennes lignes neutralisées :
  # sudo sed -i 's|alias /home/ubuntu/pariscore/.next/static/;|alias /opt/pariscorebis/.next/standalone/.next/static/;|g' /etc/nginx/sites-enabled/pariscore* 2>/dev/null || true
  # sudo sed -i 's|alias /home/ubuntu/pariscore/public/;|alias /opt/pariscorebis/.next/standalone/public/;|g' /etc/nginx/sites-enabled/pariscore* 2>/dev/null || true
  sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true
else
  echo "[4/6] Next.js build SKIPPED (legacy-only deploy — no src/app/next.config change)"
fi

# [4b] Build sauté mais des fichiers public/ ont bougé : le serving nginx alias
# /images/ → .next/standalone/public/, dossier PRODUIT UNIQUEMENT par un build
# Next. Sans cette synchro, les nouveaux assets (logos, sw.js…) restent en 404
# malgré un deploy OK. Constat 2026-10-05 : 15 logos EuroCup en 404 après un
# deploy « legacy-only » (build_ran: 0) alors que le git checkout était bon.
# ET Next fige l'inventaire de public/ au démarrage : sans pm2 restart, les
# fichiers fraichement copiés restent introuvables (constat idem 2026-10-05).
if [ "$BUILD_RAN" = "0" ] && printf '%s\n' "$CHANGED" | grep -q '^public/'; then
  echo "[4b] Sync public/ -> standalone (no build)..."
  for _sp in "$PWD/.next/standalone/public" "/opt/pariscorebis/.next/standalone/public"; do
    if [ -d "$_sp" ]; then
      cp -rf public/. "$_sp/" || { echo "  warn: synchro $_sp"; continue; }
      echo "  sync OK -> $_sp"
    else
      echo "  $_sp absent — skip"
    fi
  done
  echo "  restart pariscore-next (inventaire public/ figé au boot)..."
  # ── DATABASE_PATH obligatoire (2026-10-05) ─────────────────────────────────
  # Sous standalone, `process.cwd()` vaut `.next/standalone/` : sans cette
  # variable, le handball lit `.next/standalone/pariscore.db` — un JUMEAU de
  # 515 Mo, copie périmée du fichier racine. Elle existe, donc `existsSync` la
  # valide : l'API répond 200 avec des chiffres plausibles et faux (0 cote sur
  # la Superlig, 85 matchs au lieu de 89). Deux diagnostics perdus là-dessus.
  # Chemins EN DUR, jamais relatifs : un chemin relatif reproduirait exactement
  # le bug qu'on vient de corriger.
  export DATABASE_PATH="/home/ubuntu/pariscore/pariscore.db"
  pm2 restart pariscore-next --update-env 2>&1 | tail -2 || echo "  warn: restart pariscore-next"
fi

echo "[4c] Sync code -> /opt/pariscorebis (dir prod pariscore-next)..."
OPT_DIR="${OPT_DIR:-/opt/pariscorebis}"
if [ -d "$OPT_DIR/.git" ]; then
  git -C "$OPT_DIR" fetch --all -q || echo "  warn: fetch $OPT_DIR"
  git -C "$OPT_DIR" reset --hard "$CURR" -q || { echo "ERR: reset $OPT_DIR"; exit 1; }
  cp -f ecosystem.config.js "$OPT_DIR/ecosystem.config.js" 2>/dev/null || true
  if [ "$BUILD_RAN" = "1" ]; then
    rm -rf "$OPT_DIR/.next/standalone" || { echo "ERR: purge standalone OPT"; exit 1; }
    mkdir -p "$OPT_DIR/.next" || { echo "ERR: mkdir $OPT_DIR/.next"; exit 1; }
    cp -r .next/standalone "$OPT_DIR/.next/standalone" || { echo "ERR: copie build -> OPT"; exit 1; }
    cp -f "$OPT_DIR/.env" "$OPT_DIR/.next/standalone/.env" 2>/dev/null || true
  fi
  echo "  OPT sync: $(git -C "$OPT_DIR" log --oneline -1)"
else
  echo "  $OPT_DIR sans .git — skip sync (pipeline tar manuel)"
fi

echo "[5/6] PM2 restart..."
# Legacy only if the process still exists (legacy retired → no more noise).
if pm2 describe "$PM2_LEGACY" >/dev/null 2>&1; then
  pm2 restart "$PM2_LEGACY" --update-env 2>&1 || echo "  warn: pm2 restart $PM2_LEGACY échec"
else
  echo "  $PM2_LEGACY absent (legacy retiré) — skip"
fi
# Chaîne hockey — 6 crons, hors du garde-fou $BUILD_RAN (deliberement).
#
# Ces scrapers sont des `node scripts/*.mjs` AUTONOMES : ils lisent et écrivent
# `data/*.json`, sans jamais toucher au build Next.js. Les laisser dans le
# `if $BUILD_RAN` faisait qu'un deploy « legacy-only » (sans rebuild) les laissait
# non ré-inscrits — alors que leur seule dépendance vient d'être satisfaite.
# Les 4 crons juste après, eux, restent sous le garde-fou : leur commentaire
# declare une dependence au code Next.js, et changer cela sans le mesurer serait
# une hypothese, pas une correction.
#
# Ils étaient déclarés dans ecosystem.config.js mais enregistrés À LA MAIN sur
# le VPS courant : aucun chemin de déploiement ne les inscrivait. Conséquence
# mesurée : sur un VPS reconstruit, la chaîne hockey entière ne démarrait pas,
# SANS AUCUN MESSAGE D'ERREUR — un cron non inscrit est un cron absent, pas un
# cron en erreur. Ces `--only` ferment ce trou.
#
# L'ORDRE de ces lignes ne séquence RIEN : `startOrRestart` enregistre le cron,
# il ne l'exécute pas. La séquence 03:00 → 03:15 → 03:30 → 03:45 → 04:00 →
# 04:10 vit dans les `cron_restart` d'ecosystem.config.js — notamment le KHL à
# 03:45, après le classement eliteprospects de 03:30 dont il dépend. L'ordre
# ci-dessous est documentaire, en miroir de cette séquence.
for HC in annabet prematch eliteprospects khl projections restart; do
  pm2 startOrRestart ecosystem.config.js --only "pariscore-cron-hockey-$HC" --update-env 2>/dev/null || true
done

# Chaîne handball — 7 crons, meme trou que la chaîne hockey ci-dessus : declares
# dans ecosystem.config.js, mais inscrits à la main sur le VPS. Consequence
# mesuree le 2026-10-06 (bead ParisScorebis-1gge) :
#   - flashscore-handball tourne toujours à `0 23 * * *` alors que le repo
#     impose `0 */4 * * *` (fenêtre glissante des Résultats + matchs du soir) ;
#   - handball-history tourne `20 4 * * 1` (HEBDO) alors que le repo impose
#     `0 23 * * *` (QUOTIDIEN) — le seuil du Top 10 exige ≥3 matchs terminés
#     par équipe, un trou de 6 jours le vidait ;
#   - hbl-players, lnh, handball-hero-photo, odds-papi, handball-nightly sont
#     ABSENTS de pm2 : leurs JSON ne sont jamais régénérés (odds vides,
#     popup LNH / stats joueurs / backtest du jour périmés).
# startOrRestart est idempotent : il crée l'absent et réaligne le cron du
# présent. Hors garde-fou BUILD_RAN, comme la chaîne hockey : ces scrapers ne
# lisent/écrivent que data/*.json.
for HB in flashscore-handball handball-history hbl-players handball-hero-photo lnh odds-papi handball-nightly; do
  pm2 startOrRestart ecosystem.config.js --only "pariscore-cron-$HB" --update-env 2>/dev/null || true
done

# Cron foot des cotes (archive oddsportal, `30 */6 * * *`) — meme trou que les
# deux boucles ci-dessus : declare dans ecosystem.config.js mais jamais inscrit
# sur le VPS (constaté le 2026-10-06, bead ParisScorebis-acke : `pm2 jlist` ne
# le contient pas, donc l'archive de cotes n'a jamais été alimentée en prod).
pm2 startOrRestart ecosystem.config.js --only pariscore-cron-odds --update-env 2>/dev/null || true

# Next.js only if a build ran.
if [ "$BUILD_RAN" = "1" ]; then
  pm2 startOrRestart "$OPT_DIR/ecosystem.config.js" --only pariscore-next --update-env 2>&1 | tail -5 || echo "  warn: pm2 startOrRestart pariscore-next échec"
  # Cron re-registration (only after full build — crons depend on Next.js code).
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-rg --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-match-stats --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-gemini --update-env 2>/dev/null || true
  pm2 startOrRestart ecosystem.config.js --only pariscore-cron-elo-weekly --update-env 2>/dev/null || true
else
  echo "  $PM2_NEXT NOT restarted (no build)"
  echo "  cron jobs NOT restarted (legacy-only deploy)"
fi
pm2 save 2>/dev/null || true

# FlashScore refresh toutes les 15 min (cron système, pas pm2)
CRON_LINE="*/15 * * * * cd $OPT_DIR && bash scripts/cron_snooker_refresh.sh >> logs/snooker-refresh.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "cron_snooker_refresh"; then
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "  ✅ cron snooker-refresh ajouté (*/15)"
else
  echo "  cron snooker-refresh déjà présent"
fi

# Refresh hebdo stats joueurs (tous les lundis 06:00 UTC)
CRON_WEEKLY="0 6 * * 1 cd $OPT_DIR && bash scripts/cron_weekly_player_stats.sh >> logs/weekly-stats.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "cron_weekly_player_stats"; then
  (crontab -l 2>/dev/null; echo "$CRON_WEEKLY") | crontab -
  echo "  ✅ cron weekly-stats ajouté (lundi 06:00)"
else
  echo "  cron weekly-stats déjà présent"
fi

# Snooker quotidien — Oddsportal NIO + CueTracker complet (08:00 UTC).
# Sans ce cron : oddsportal_nio.json et cuetracker_matches.json stagnent (audit lot5).
CRON_DAILY="0 8 * * * cd $OPT_DIR && bash scripts/cron_snooker.sh >> logs/snooker-cron.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "cron_snooker.sh"; then
  (crontab -l 2>/dev/null; echo "$CRON_DAILY") | crontab -
  echo "  ✅ cron snooker quotidien ajouté (08:00 UTC)"
else
  echo "  cron snooker quotidien déjà présent"
fi

# Tables calendrier & top10 snooker+hockey — quotidien01:00 UTC.
# Couvre : flashscore --both, oddsportal NIO, cuetracker, betexplorer/annabet/
# oddspedia prematch, eliteprospects standings + player-stats (voir cron_daily_tables.sh)
CRON_DAILY_TABLES="0 1 * * * cd $OPT_DIR && bash scripts/cron_daily_tables.sh >> logs/daily-tables.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "cron_daily_tables.sh"; then
  (crontab -l 2>/dev/null; echo "$CRON_DAILY_TABLES") | crontab -
  echo "  ✅ cron daily-tables ajouté (01:00 UTC)"
else
  echo "  cron daily-tables déjà présent"
fi

# Revue de presse académique bimestrielle (tous les14 jours, garde dans le script).
# Sortie : docs/press-review/YYYY-MM-DD.md (modèles prédictifs, LLM OSS, paris sportifs).
CRON_PRESS="0 6 * * * cd $OPT_DIR && python3 scripts/press-review.py >> logs/press-review.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "press-review.py"; then
  (crontab -l 2>/dev/null; echo "$CRON_PRESS") | crontab -
  echo "  ✅ cron press-review ajouté (06:00, garde14j)"
else
  echo "  cron press-review déjà présent"
fi

echo "[6/6] Health check..."
HEALTH_OK=0
# Legacy-only = 4 checks (fast restart), Full build = 8 checks (slower boot)
MAX_CHECKS=8
[ "$BUILD_RAN" = "0" ] && MAX_CHECKS=4
for i in $(seq 1 $MAX_CHECKS); do
  if curl -s -m 5 http://localhost:3000/api/v1/status 2>/dev/null | grep -q '"status":"ok"'; then
    echo "  health: OK"; HEALTH_OK=1; break
  fi
  echo "  health: waiting ($i/$MAX_CHECKS)..."; sleep 2
done
if [ "$HEALTH_OK" != "1" ]; then
  echo "ERR: health check échec après $MAX_CHECKS tentatives — ROLLBACK"
  pm2 ls 2>/dev/null | tail -8 || true
  pm2 logs "$PM2_NEXT" --lines 20 --nostream 2>/dev/null || true
  # ── ROLLBACK (demande 2026-10-09) ───────────────────────────────────────────
  # Un healthcheck KO après `pm2 reload` signifie que le nouveau bundle est
  # incompatible du runtime (ou pire). Sans restauration, la prod reste en 502
  # jusqu'au prochain deploy. On remet le build précédent et on recharge.
  if [ "$BUILD_RAN" = "1" ] && [ -d "$DEPLOY_DIR/.next.bak" ]; then
    echo "  rollback : restauration du build précédent..."
    rm -rf "$DEPLOY_DIR/.next"
    cp -a "$DEPLOY_DIR/.next.bak" "$DEPLOY_DIR/.next" || echo "  warn: restauration .next.bak échouée"
    rm -rf "$DEPLOY_DIR/.next.bak"
    pm2 startOrRestart "$OPT_DIR/ecosystem.config.js" --only "$PM2_NEXT" --update-env 2>&1 | tail -3 || true
    for i in 1 2 3 4 5 6; do
      if curl -s -m 5 http://localhost:3000/api/v1/status 2>/dev/null | grep -q '"status":"ok"'; then
        echo "  rollback: health OK — prod revenue à l'état précédent"
        break
      fi
      sleep 2
    done
  else
    echo "  pas de backup .next.bak — rollback impossible"
  fi
  exit 1
fi
[ "$HEALTH_OK" = "1" ] || echo "  warn: health check échec — vérifier pm2 logs"

# Health OK : le backup n'a plus servi, on libère l'espace (~900 Mo).
rm -rf "$DEPLOY_DIR/.next.bak"

echo ""
echo "--- VPS_DEPLOY_OK ---"
echo "commit: $(git log --oneline -1)"
echo "build_ran: $BUILD_RAN"
echo "finished_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# [7] Discord notification (webhook from .env, never hardcoded).
if [ "${SKIP_DISCORD:-0}" != "1" ]; then
  WEBHOOK="$(grep -E '^DISCORD_DEPLOY_WEBHOOK_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [ -n "$WEBHOOK" ]; then
    COMMIT_HASH="$(git rev-parse --short HEAD)"
    COMMIT_MSG="$(git log -1 --pretty=%s | sed 's/"/\\"/g')"
    COMMIT_AUTHOR="$(git log -1 --pretty=%an | sed 's/"/\\"/g')"
    DEPLOY_TS="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
    PAYLOAD="$(cat <<JSON
{"embeds":[{"title":"PariScore deploy","description":"**${COMMIT_MSG}**","color":3066993,"fields":[{"name":"Commit","value":"\`${COMMIT_HASH}\`","inline":true},{"name":"Auteur","value":"${COMMIT_AUTHOR}","inline":true},{"name":"Build","value":"${BUILD_RAN}","inline":true}],"footer":{"text":"VPS OVH pm2 ${PM2_LEGACY}"},"timestamp":"${DEPLOY_TS}"}]}
JSON
)"
    curl -s -H "Content-Type: application/json" -X POST -d "$PAYLOAD" "$WEBHOOK" >/dev/null 2>&1 \
      && echo "discord: OK" || echo "discord: échec (non bloquant)"
  else
    echo "discord: webhook absent — skip"
  fi
fi
