---
type: concept
slug: sse
title: Server-Sent Events (SSE) — pattern push live
status: active
tags: [concept, infrastructure, sse, live, streaming, websocket-alt]
updated: 2026-05-22
sources: ["server.js", "pariscore.html"]
xref: [[live-dashboard-cockpit]], [[live-intensity]], [[power-score]], [[ai-scout]], [[zero-dep-node]]
---

# Server-Sent Events (SSE)

**TL;DR:** Pattern HTTP unidirectionnel push serveur → client. Zero-dep (`http` natif Node), pas de bibliothèque WebSocket. Use cases PariScore: scores live + intensity updates + Power Score streaming + Pro Scout streaming.

## Architecture vs WebSocket

| Feature | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client only | Bidirectionnel |
| Protocol | HTTP standard (text/event-stream) | ws:// upgrade |
| Reconnect | Auto built-in browser | Manual |
| Native | Browser EventSource API | Browser WebSocket API |
| Server impl | Stream Response chunks | Library typique |
| **Cohérence [[zero-dep-node]]** | ✅ Native | ❌ Library required |
| Use case PariScore | ✅ broadcast updates | Inutile (no client-input live) |

PariScore choisit SSE pour cohérence [[zero-dep-node]] + simplicité.

## Pattern serveur

```js
// server.js:15253 — /api/v1/live SSE endpoint
if (pathname === '/api/v1/live' && req.method === 'GET') {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // nginx hint
  });
  res.write('retry: 5000\n\n');  // browser reconnect 5s
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

function broadcastSSE(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch (_) { sseClients.delete(client); }
  }
}
```

## Pattern client

```js
// pariscore.html
const eventSource = new EventSource('/api/v1/live');
eventSource.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  if (payload.type === 'score_update') updateScoreDOM(payload);
  if (payload.type === 'intensity') updateIntensityBar(payload);
};
```

## Use cases PariScore

| Endpoint | Use case |
|---|---|
| `/api/v1/live` | Broadcast scores live + intensity + events (cf. [[live-intensity]]) |
| `/api/v1/powerscore/:matchId` | Streaming Gemini chunks Power Score (cf. [[power-score]]) |
| `/api/v1/scout/:matchId` | Streaming Pro Scout 5 Piliers Gemini |

## Code locations

- `server.js:1290` — `broadcastSSE(payload)` helper
- `server.js:15253` — `/api/v1/live` SSE endpoint
- `server.js` `sseClients = new Set()` tracking
- `pariscore.html` `new EventSource('/api/v1/live')`

## Smart Polling déclencheur

`fixtures?live=all` polling 60s fenêtre 19h-23h Paris → broadcast SSE diff scores → client UI updates sans full page refresh.

## Multi-instance limitation

SSE state in-memory `sseClients` Set. PM2 single instance ([[vps-ovh-prod]]) compatible. Si scale multi-instance future → Redis pubsub broadcast cross-instance requis (TODO).

## Limites

- Pas message client → serveur via SSE (use POST séparé)
- HTTP/1.1 limite 6 connections concurrent per origin (browser) → respect
- Large messages (Gemini SSE long output) peuvent timeout proxy intermédiaire (nginx tweak)

## Related

- [[live-dashboard-cockpit]] — Consommateur primary SSE updates
- [[live-intensity]] — Broadcast intensity scores via SSE
- [[power-score]] — SSE streaming Gemini
- [[ai-scout]] — Cache 6h (pas SSE car batch)
- [[zero-dep-node]] — Cohérence philosophie

## Changelog

- 2026-05-22: création initiale wave 3
