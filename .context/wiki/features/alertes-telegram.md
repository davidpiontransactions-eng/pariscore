---
type: feature
slug: alertes-telegram
title: Alertes Telegram (push notifications value bets + live momentum)
status: active-v9.9.5
tags: [feature, alerts, telegram, push, premium, live]
updated: 2026-05-22
sources: ["pariscore.html (#page-alertes)", "server.js", "CLAUDE.md"]
xref: [[live-intensity]], [[value-bet]], [[mobile-pwa]], [[mes-paris]]
---

# Alertes Telegram

**TL;DR:** Page `#page-alertes` config alertes Telegram personnalisées par user. Sport/ligue/marché/edge min/proba min/intensity threshold. Cooldown 15min anti-spam. Backend `pollLiveScores` 60s trigger. Livré v9.9.5 2026-05-13.

## Composants UI

- Filtres personnalisés:
  - Sport (foot / tennis)
  - Ligue (multi-select)
  - Marché (1X2 / BTTS / O2.5 / etc)
  - Edge min (slider %)
  - Proba min Poisson (slider %)
  - Intensity min (slider 0-100 cf. [[live-intensity]])
  - Pressure delta min (live momentum)
- Toggle ON/OFF par alerte (value bets / live momentum / pressure spike)
- Preview historique 50 dernières alertes envoyées
- Bouton "Tester l'alerte" → `/api/v1/alerts/test`

## Backend triggers

### Value bets (cron 12h après fetchOdds)
- Scan matchs avec `best_edge.edge > user.edge_min`
- Filter par user pref (sport/ligue/marché)
- Send Telegram via `TELEGRAM_BOT_TOKEN` + `chat_id` user
- Log dans `alerts_history` table

### Live momentum (poll 60s 19h-23h)
- `pollLiveScores()` server.js
- Trigger conditions:
  - `live_intensity >= intensityMin` user pref
  - OR `|pressure.delta| >= pressureDeltaMin` (spike momentum)
- Cooldown **15min par (user, match)** anti-spam
- Send Telegram

## Persistance

| Storage | Use |
|---|---|
| `db.kv['alert_prefs_<userId>']` | Config user (server-side) |
| `localStorage` | Miroir client (chatId rapid lookup) |
| `alerts_history` table | Log alertes envoyées |

## Config env

```
TELEGRAM_BOT_TOKEN=<bot token Botfather>
TELEGRAM_CHAT_IDS=<comma-separated chat IDs default broadcast>
ALERT_EDGE_THRESHOLD=8   # edge % minimum default
```

## Endpoints API

- `GET /api/v1/alerts/prefs` — user prefs read
- `POST /api/v1/alerts/prefs` — update prefs
- `GET /api/v1/alerts/history?limit=50` — history user
- `POST /api/v1/alerts/test` — send test message
- (interne) `pollLiveScores` cron + Telegram bot send

## Gates

`/api/v1/alerts/*` dans `anyPro` set (server.js:14521) → 403 sinon.

## Risques

- Telegram rate limit: 30 messages/sec global bot, 1 message/sec per chat
- Anti-spam: cooldown OK mais si trop d'users avec mêmes triggers → bursts
- Bot token compromis = leak DM users → rotation regularly

## Channel alternative

Web Push API (cf. [[mobile-pwa]] Phase 7) — VAPID ES256 backend livré bd `nwk6`. Substitut Telegram pour users sans compte Tg.

## Bd tickets liés

Pas de bd actif dédié. Considéré stable post v9.9.5.

Innovation potentielle:
- Multi-channel (Telegram + Web Push + Email + SMS Twilio)
- ML-based smart alerts (apprend pattern user click → tune prefs auto)

## Code locations

- `pariscore.html` `#page-alertes` UI
- `server.js` `pollLiveScores()` momentum trigger
- `server.js` `sendTelegram(chatId, message)` helper
- `server.js` `/api/v1/alerts/*` routes

## Related

- [[live-intensity]] — Source trigger live momentum
- [[value-bet]] — Source trigger value bets cron
- [[mobile-pwa]] — Web Push alternative channel
- [[mes-paris]] — Integration future (auto-suggest paris depuis alerte)

## Changelog

- 2026-05-22: création initiale wave 3
