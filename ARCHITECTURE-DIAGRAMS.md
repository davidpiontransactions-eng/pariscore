# PariScore (SetPoint) — Diagrammes Mermaid

> **Complément visuel de [`ARCHITECTURE.md`](./ARCHITECTURE.md).**
> Les diagrammes ci-dessous sont rendus nativement par GitHub, GitLab, VS Code (extension Markdown Preview Mermaid), ZCode et OpenCode.
> Dernière mise à jour : 12 juillet 2026

---

## 1. Vue d'ensemble du système

```mermaid
graph TB
    subgraph External["Services externes"]
        ODDS[The Odds API<br/>cotes temps réel]
        POSTHOG[PostHog<br/>Analytics + A/B testing]
        SENTRY[Sentry<br/>Error tracking]
        SMTP[SMTP Server<br/>Email digest]
        CDN[Image CDN<br/>sfile.chatglm.cn]
    end

    subgraph Browser["Navigateur / PWA"]
        UI[React 19 App<br/>SSR + hydration]
        SW[Service Worker<br/>cache-first + push]
        WS[Socket.io Client<br/>live updates :3001]
    end

    subgraph Gateway["Caddy Gateway :81"]
        CADDB[Caddy reverse proxy<br/>?XTransformPort rewrite]
    end

    subgraph NextJS["Next.js 16 :3000 (Bun)"]
        ROUTES[API Routes<br/>App Router]
        SSR[SSR Page<br/>MatchCards]
        LAYOUT[Provider Tree<br/>Theme → Intl → Consent → PH → Sentry]
    end

    subgraph MiniService["Mini-service :3001 (Bun)"]
        LIVE[tennis-live<br/>socket.io + simulation 5s]
    end

    subgraph Libs["src/lib"]
        PRED[Prediction Engine<br/>ELO 70% + Form 20% + H2H 10%]
        TENNIS[tennis-data.ts<br/>MATCHES seed + photos]
        PUSH[push/store.ts<br/>VAPID subscriptions]
        EMAIL[email/store.ts<br/>Nodemailer]
    end

    UI <-->|fetch /api| CADDB
    UI <-->|io ?XTransformPort=3001| CADDB
    CADDB -->|proxy| ROUTES
    CADDB -->|WS upgrade| LIVE
    ROUTES --> ODDS
    ROUTES --> PRED
    ROUTES --> TENNIS
    ROUTES --> PUSH
    ROUTES --> EMAIL
    SSR --> LAYOUT
    UI -->|events consent-gated| POSTHOG
    UI -->|errors consent-gated| SENTRY
    UI -->|preconnect| CDN
    EMAIL -->|send| SMTP
    PUSH -->|web-push| SW

    style NextJS fill:#1a1a2e,color:#eaeaea
    style MiniService fill:#16213e,color:#eaeeea
    style Browser fill:#0f3460,color:#eee
    style External fill:#533483,color:#eaeaea
```

---

## 2. Flux de données — Prematch API

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant SWR as SWR Hook
    participant API as /api/tennis/prematch
    participant ODDS as The Odds API
    participant ENGINE as Prediction Engine
    participant CACHE as Cache mémoire (60s)

    U->>SWR: usePrematchMatches()
    SWR->>API: GET /api/tennis/prematch

    alt Cache frais (≤60s)
        API-->>SWR: {matches, source: "cache"}
    else Cache expiré
        alt ODDS_API_KEY configuré
            API->>ODDS: fetch tennis_atp_singles
            ODDS-->>API: odds décimals
            API->>API: source = "odds-api"
        else Pas de clé
            API->>API: liveOdds = null, source = "mock"
        end
        API->>ENGINE: predict(playerInputs) pour chaque match
        ENGINE-->>API: probA, probB, ic [95%], confidence
        API->>CACHE: store {matches, source, updatedAt}
        API-->>SWR: {matches, source: "odds-api"|"mock"}
    end

    SWR-->>U: Affiche MatchCards + ELO + odds

    note over SWR: Revalidate toutes les 60 secondes
```

---

## 3. Moteur de prédiction (ELO + Forme + H2H)

```mermaid
graph LR
    subgraph Inputs["Entrées joueur"]
        ELO[Elo global]
        SE[Elo surface<br/>dur/terre/gazon]
        FORM[Forme<br/>6 derniers matchs]
        H2H[Confrontations<br/>directes]
    end

    subgraph Blend["Fusion pondérée → P(A gagne)"]
        ELO_BL[**Elo blend 70%**<br/>blendedElo = 0.55×surface + 0.45×global<br/>P = 1/(1+10^((eloB-eloA)/400))]
        FORM_BL[**Forme 20%**<br/>decay 0.85^i sur 6 matchs<br/>pForm = logistic(formA-formB, ×4)]
        H2H_BL[**H2H 10%**<br/>winRate direct<br/>pH2H = h2hScore]
    end

    subgraph Output["PredictionResult"]
        PROB[probA: 0-100<br/>probB = 100 - probA]
        IC[ic: [low, high]<br/>95% CI bootstrap 1000 tirages]
        CONF[confidence: 0-1<br/>clamp(1 - icWidth/40)]
        ELOGAP[eloGap: blendedEloA - blendedEloB]
    end

    ELO --> ELO_BL
    SE --> ELO_BL
    FORM --> FORM_BL
    H2H --> H2H_BL
    ELO_BL -->|0.70| PROB
    FORM_BL -->|0.20| PROB
    H2H_BL -->|0.10| PROB
    PROB --> IC
    IC --> CONF
    ELO_BL --> ELOGAP

    style Blend fill:#0f3460,color:#eee
    style Output fill:#16213e,color:#eaeaea
```

---

## 4. Provider Tree (layout.tsx)

```mermaid
graph TD
    ROOT["<html>"] --> THEME["ThemeProvider<br/>next-themes<br/>attribute=class"]
    THEME --> INTL["NextIntlClientProvider<br/>locale fr/en<br/>cookie NEXT_LOCALE"]
    INTL --> CONSENT["ConsentProvider<br/>localStorage + cookie 180j<br/>RGPD gate"]
    CONSENT --> PH["PHProvider<br/>PostHog<br/>init deferred si consent.analytics"]
    PH --> SENTRY["SentryErrorBoundary<br/>captureException<br/>beforeSend drop si pas consent"]
    SENTRY --> PAGE["<page><br/>MatchCards + BetSlip<br/>+ Dialogs"]

    style THEME fill:#533483,color:#fff
    style CONSENT fill:#e74c3c,color:#fff
    style PAGE fill:#0f3460,color:#fff
```

---

## 5. API Routes — carte complète

```mermaid
graph LR
    subgraph Tennis["/api/tennis"]
        PRE["GET /prematch<br/>Matchs + ELO + odds"]
        BACK["GET /backtest<br/>Backtest stratégies"]
        ELOH["GET /elo-history<br/>ELO reverse-computé 12 mois"]
    end

    subgraph Push["/api/push"]
        PSUB["POST /subscribe<br/>Store subscription VAPID"]
        PDIG["POST /digest<br/>web-push.sendNotification"]
        PTEST["POST /test<br/>Alerte test"]
    end

    subgraph Email["/api/email"]
        ESUB["POST /subscribe<br/>Inscription"]
        EUNS["POST /unsubscribe<br/>Désinscription"]
        EDIG["POST /digest<br/>Résumé Nodemailer"]
        ET["POST /test<br/>Email test"]
    end

    subgraph Other["Autres"]
        SENT["POST /sentry-test"]
        SITEMAP["GET /sitemap.xml<br/>SEO statique"]
    end

    PRE -->|source| FETCH[bsd-fetcher + real-matches]
    BACK -->|engine| PRED[prediction/backtest]
    ELOH -->|reverse Elo| ELOLIB[prediction/elo-history]
    PSUB -->|Map mémoire| STORE[push/store.ts]
    PDIG -->|sign+send| WEBPUSH[web-push VAPID]
    EDIG -->|SMTP| MAILER[email/send.ts]

    style Tennis fill:#0f3460,color:#fff
    style Push fill:#533483,color:#fff
    style Email fill:#16213e,color:#fff
```

---

## 6. RGPD Consent Flow

```mermaid
state diagram-v2
    [*] --> Pending: Page chargée
    Pending --> Pending: Pas de telemetry<br/>(principe de précaution)

    Pending --> All: Accepter tout
    Pending --> AnalyticsOnly: Analytics uniquement
    Pending --> Rejected: Tout refuser

    All --> AnalyticsEnabled: PostHog init + Sentry beforeSend OK
    AnalyticsOnly --> AnalyticsEnabled: PostHog init + Sentry beforeSend OK
    Rejected --> AnalyticsDisabled: PostHog opt_out + Sentry drop

    AnalyticsEnabled --> Pending: Changement d'avis
    AnalyticsDisabled --> Pending: Changement d'avis

    note right of Pending: Stocké dans localStorage<br/>+ cookie 180 jours<br/>SameSite=Lax
```

---

## 7. Service Worker — stratégies de cache

```mermaid
graph TD
    REQ[Requête entrante] --> CHECK{Type?}

    CHECK||Static asset| CF[Cache-first<br/>setpoint-static-v4]
    CHECK||/api/* GET| NF[Network-first<br/>setpoint-api-v4]
    CHECK||Navigation offline| FALLBACK[Fallback cache /]
    CHECK||Cross-origin| BYPASS[Bypass<br/>pas de cache]

    CF --> C1{En cache?}
    C1||Oui| SERVE1[Servir cache]
    C1||Non| FETCH1[Fetch réseau → cache]

    NF --> C2{Réseau OK?}
    C2||Oui| SERVE2[Servir + cache]
    C2||Non| SERVE3[Servir cache]

    style CF fill:#0f3460,color:#fff
    style NF fill:#533483,color:#fff
    style FALLBACK fill:#e74c3c,color:#fff
```

---

## 8. WebSocket Live — mini-service tennis-live

```mermaid
sequenceDiagram
    participant UI as use-live-matches.ts
    participant CAD as Caddy :81
    participant LIVE as tennis-live :3001
    participant STATE as État matchs m1/m2/m3

    UI->>CAD: io("/?XTransformPort=3001")
    CAD->>LIVE: WS upgrade → localhost:3001
    LIVE-->>UI: initial_state: LiveMatchState[3]

    loop Chaque 5 secondes
        LIVE->>STATE: avance 1 match (round-robin)
        Note over STATE: point → game → set → match<br/>best-of-3, auto-restart
        STATE-->>LIVE: nouvel état
        LIVE-->>UI: match_update: LiveMatchState
        Note over UI: liveProbA override probA<br/>score affiché
    end

    UI->>LIVE: ping
    LIVE-->>UI: pong {t, echo}

    note over UI: 5s sans update → match marqué non-live
```

---

## 9. Push Notifications (VAPID)

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant UI as push-toggle.tsx
    participant SW as Service Worker
    participant FCM as FCM/APNS/Mozilla
    participant API as /api/push/subscribe
    participant STORE as push/store.ts (Map)

    U->>UI: Clic "Activer push"
    UI->>SW: Notification.requestPermission()
    SW-->>UI: "granted"
    UI->>SW: pushManager.subscribe(VAPID public key)
    SW-->>UI: PushSubscription
    UI->>API: POST {subscription}
    API->>STORE: subscriptionsRef.set(sub)

    note over STORE: Clé = endpoint<br/>Idempotent

    par Envoi push (async)
        API->>FCM: web-push.sendNotification(payload signé VAPID)
        FCM->>SW: push event
        SW->>U: showNotification("Value bet détecté")
        Note over SW: Actions: "Voir le match" / "Ignorer"
    end
```

---

## 10. Déploiement

```mermaid
graph LR
    subgraph Dev["Développement"]
        LOCAL["bun run dev<br/>Next.js :3000<br/>+ tennis-live :3001 (bun --hot)"]
        ENVLOCAL[".env local"]
    end

    subgraph Sandbox["Sandbox (Caddy :81)"]
        CAD["Caddy gateway<br/>?XTransformPort<br/>reverse proxy unifié"]
    end

    subgraph VPS["VPS OVH 51.75.21.239"]
        PM2["pm2 process manager"]
        STANDALONE["bun .next/standalone/server.js"]
        DBVPS[("SQLite<br/>pariscore.db")]
    end

    subgraph Render["Render.com (legacy)"]
        REND["Auto-deploy git push<br/>render.yaml"]
    end

    LOCAL --> CAD
    LOCAL -->|git push| VPS
    LOCAL -->|git push| Render
    PM2 --> STANDALONE
    STANDALONE --> DBVPS
    REND --> DBREND[("SQLite /app/data")]

    style VPS fill:#0f3460,color:#fff
    style Render fill:#533483,color:#fff
    style Sandbox fill:#16213e,color:#eaeaea
```

---

## 11. Couche Agent IA (ZCode + OpenCode + MCP + Skills)

```mermaid
graph TB
    subgraph Agents["Agents CLI"]
        ZC[ZCode]
        OC[OpenCode]
    end

    subgraph Skills[".agents/skills/ (70+)"]
        AOS["aos-* (24)<br/>addyosmani engineering"]
        FEC["fec-* (3)<br/>Front-End Checklist"]
        AGY["agency-* (8)<br/>Review/Security/SRE"]
        SPT["Sports data<br/>tennis, football, NBA..."]
        MET["metier-* (FR)<br/>Routeurs par domaine"]
        CAV["caveman-*<br/>Git workflow"]
        PS["ps-* (5)<br/>PariScore métier"]
    end

    subgraph MCP[".mcp.json (8 servers)"]
        FE["frontendchecklist<br/>390 règles audit"]
        PW["playwright<br/>Browser E2E"]
        MEM["memory<br/>Knowledge graph"]
        GIT["git<br/>Opérations structurées"]
        FS["project_fs<br/>Filesystem"]
        SP1["bzzoiro-sports"]
        SP2["sportdbdotdev"]
        SP3["sportradar"]
    end

    subgraph Codebase["PariScore"]
        SRC["src/ (Next.js 16)<br/>app + components + hooks + lib"]
        PRISMA["prisma/ (schema)"]
        LEGACY["server.js + pariscore.html<br/>(migration en cours)"]
        TESTS["tests/ (Playwright ~51 tests)"]
    end

    ZC --> Skills & MCP
    OC --> Skills & MCP
    Skills --> SRC
    MCP --> SRC
    FE -->|audit| SRC
    PW -->|E2E| TESTS

    style Agents fill:#1a1a2e,color:#eaeaea
    style Skills fill:#0f3460,color:#eee
    style MCP fill:#533483,color:#eaeaea
```

---

## Légende des couleurs

| Couleur | Couche |
|---------|--------|
| 🟦 Bleu foncé (`#0f3460`) | Serveur / API / Core |
| 🟣 Violet (`#533483`) | Services externes / Cloud |
| ⬛ Noir-bleu (`#1a1a2e`) | Framework / Runtime |
| 🔴 Rouge (`#e74c3c`) | Sécurité / RGPD / Alertes |
| 🗒️ Gris-bleu (`#16213e`) | Données / Infrastructure |
