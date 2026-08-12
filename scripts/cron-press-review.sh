#!/bin/bash
# ============================================================================
# PariScore — Cron Revue de Presse : pré-chauffe du cache 24h.
#
# Appelle GET /api/ai/press-review-cron (route Next.js App Router, servie par
# `pariscore-next` sur le port 3005) qui pré-remplit le cache disque
# .cache/press-review/ pour les matchs du jour (tennis + football).
#
# 100 % gratuit : pipeline déterministe (RSS + connecteurs + synthèse),
# aucun appel Gemini/LLM.
#
# Cron PM2 : pariscore-cron-press-review (cron_restart '0 7 * * *').
# Le process meurt après exécution ; PM2 le relance au prochain tick.
# Auth : token envoyé en query ?token= (CRON_SECRET requis, lu depuis .env
#   ou l'environnement du process — échoue explicitement s'il manque).
# ============================================================================

set -u

BASE_URL="${PRESS_CRON_URL:-http://localhost:3005}"

# Token lu depuis .env (même source que process.env.CRON_SECRET de la route).
TOKEN="$(grep -E '^CRON_SECRET=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
TOKEN="${TOKEN:-${CRON_SECRET:-}}"

if [ -z "${TOKEN}" ]; then
  echo "[press-review-cron] CRON_SECRET manquant dans .env — refus de démarrer (route non protégée)." >&2
  exit 1
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[press-review-cron] ${TS} — démarrage sur ${BASE_URL}/api/ai/press-review-cron"

RESP="$(curl -s -m 240 -w $'\nHTTP_STATUS:%{http_code}' \
  "${BASE_URL}/api/ai/press-review-cron?token=${TOKEN}")"
HTTP_CODE="$(printf '%s' "$RESP" | sed -n 's/.*HTTP_STATUS:\([0-9]*\)$/\1/p')"
BODY="$(printf '%s' "$RESP" | sed -n 's/HTTP_STATUS:[0-9]*$//p')"

if [ "${HTTP_CODE}" = "200" ]; then
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[press-review-cron] ${TS} — OK ${HTTP_CODE} : ${BODY}"
  exit 0
else
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[press-review-cron] ${TS} — ÉCHEC HTTP ${HTTP_CODE} : ${BODY}" >&2
  exit 1
fi