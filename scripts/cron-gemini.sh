#!/bin/bash
# ============================================================================
# PariScore — Cron Gemini : pré-calcul des analyses pour les matchs du jour.
#
# Appelle GET /api/ai/gemini-cron (route Next.js App Router, servie par
# `pariscore-next` sur le port 3005) qui pré-calcule les analyses Gemini
# des 5 premiers matchs tennis + 5 premiers foot, stockées dans le cache
# mémoire gemini-cache.ts (TTL 12h).
#
# Sans ce cron, le service de bookings subirait la latence de l'appel Gemini
# pour chaque utilisateur. La pré-calcul fait l'appel une seule fois.
#
# Cron PM2 : pariscore-cron-gemini (cron_restart '0 6,8,10,12,14,16,18 * * *').
# Le process meurt après exécution ; PM2 le relance au prochain tick.
# Auth : token envoyé en query ?token= (CRON_SECRET requis, lu depuis .env
#   ou l'environnement du process — échoue explicitement s'il manque).
# ============================================================================

set -u

BASE_URL="${GEMINI_CRON_URL:-http://localhost:3005}"

# Token lu depuis .env (même source que process.env.CRON_SECRET de la route).
# Pas de fallback : un token faible ou absent expose la route (coût Gemini).
TOKEN="$(grep -E '^CRON_SECRET=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
TOKEN="${TOKEN:-${CRON_SECRET:-}}"

if [ -z "${TOKEN}" ]; then
  echo "[gemini-cron] CRON_SECRET manquant dans .env — refus de démarrer (route non protégée)." >&2
  exit 1
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[gemini-cron] ${TS} — démarrage sur ${BASE_URL}/api/ai/gemini-cron"

RESP="$(curl -s -m 120 -w $'\nHTTP_STATUS:%{http_code}' \
  "${BASE_URL}/api/ai/gemini-cron?token=${TOKEN}")"
HTTP_CODE="$(printf '%s' "$RESP" | sed -n 's/.*HTTP_STATUS:\([0-9]*\)$/\1/p')"
BODY="$(printf '%s' "$RESP" | sed -n 's/HTTP_STATUS:[0-9]*$//p')"

if [ "${HTTP_CODE}" = "200" ]; then
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[gemini-cron] ${TS} — OK ${HTTP_CODE} : ${BODY}"
  exit 0
else
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[gemini-cron] ${TS} — ÉCHEC HTTP ${HTTP_CODE} : ${BODY}" >&2
  exit 1
fi