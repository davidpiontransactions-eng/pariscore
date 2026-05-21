# Sweep tâches .md — 21/05/2026

> Scan ~165 fichiers .md (root + .context + sessions/audits/strategy/specs + audit à lancer + Strategies à faire + Troubleshooting + MAWARROOMSPORT). Exclus : node_modules, .git, .beads, .claude/worktrees, .claude/agents, .claude/prompts, .claude/skills, .agents, .planning, open-design.
>
> Cross-ref bd : 44 open + 8 in_progress = 52 tickets actifs analysés.

## P0 candidates (action immédiate)

| Fichier | Section | Tâche | Hint priorité |
|---|---|---|---|
| .context/incident_securite_20260520.md | Phase 2 — Rotation clés | Rotate ADMIN_PASSWORD via openssl + deploy VPS | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 2 — Rotation clés | Rotate GA_POSTBACK_TOKEN via openssl rand -hex 24 | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 2 — Rotation clés | Rotate TELEGRAM_BOT_TOKEN via @BotFather /revoke + /newtoken | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 2 — Rotation clés | Rotate ODDS_API_KEY dashboard the-odds-api.com | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 2 — Rotation clés | Rotate GEMINI_API_KEY console aistudio.google.com | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 2 — Rotation clés | Rotate API_FOOTBALL_KEY dashboard api-football.com | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 2 — Rotation clés | Rotate BSD_API_KEY via email bzzoiro@proton.me | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 3 — Hardening | ufw deny 37.65.65.25 + range 78.153.140.0/24 + reload | P0 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 4 — Audit post-breach | Audit user_bets + bankroll_transactions + affiliate_clicks post 20/05 00:26 | P0 [bd:c8m] |
| .context/session_resume_handoff.md | Actions OPS bloquantes | Apply nginx hardening .context/nginx_hardening_pariscore.conf | P0 [bd:c8m] |
| .context/session_resume_handoff.md | Actions OPS bloquantes | Activation banner UI sécurité post final JWT rotate | P0 [bd:c8m] |
| .context/session_resume_handoff.md | SQLite b50 | Diag VPS bash .context/diag_sqlite_corruption.sh | P0 [bd:b50] |
| .context/session_resume_handoff.md | SEO u5x | Deploy robots.txt VPS + GSC URL Inspection 5 URLs | P0 [bd:u5x,d4rd] |
| .context/session_resume_handoff.md | Momentum 8c5 | Valider prod fix v12.14 sur match La Liga live | P0 [bd:8c5] |
| .context/session_resume_handoff.md | Backlog P0 | Run node seed_historique_db.js --sample-pl post quota reset | P0 [bd:9je,h9j7] |

## P1 candidates (court terme)

| Fichier | Section | Tâche | Hint priorité |
|---|---|---|---|
| rapport_qa_foot_tennis.md | CRIT-3 | Ajouter console.warn aux 11 broad catch server.js | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-1 | Wrapper safeInt(v,d) sur tous parseInt server+frontend | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-2 | Guard lb.length avant reduce()/length (pariscore.html:14162,14177) | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-3 | LRU eviction sessionStorage tennis snapshot 100 entries | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-4 | window.addEventListener storage sync favs multi-tab | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-5 | Combiner 10 filtres tennis en 1 .filter() early-exit | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-6 | Event delegation tbody (foot+tennis) remplace onclick inline | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-7 | z-index #mfs-body .mls-panel 100000→9300 | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-8 | Tier z-index 6 modals 9999 tied | P1 [bd:401] |
| rapport_qa_foot_tennis.md | MAJ-9 | #live-detail-modal z-index 1025 (tie 1020) | P1 [bd:401] |
| audit à lancer/auditlive.md | Backend SSE | Route /api/stream-live diffusion SSE live | P1 |
| audit à lancer/auditlive.md | Backend | Fn calculateLiveIntensity(stats) attaques×2+tirs+corners/temps | P1 |
| audit à lancer/auditlive.md | Backend | Détection cartons rouges + recalc Power Score | P1 |
| audit à lancer/auditlive.md | Frontend | Tri prioritaire matchs live status 1H/HT/2H/ET/P top | P1 |
| audit à lancer/auditlive.md | Frontend | Live Dot pulsé + Flash Alert sur buts + Barre Pression 0-100 | P1 |
| TODO_SESSION.md | AI-AL Enrichissement | Update Prompt AI-AL section Revue de Presse 5 avis | P1 |
| TODO_SESSION.md | En cours/Debug | Intégration Agent AI-AL Tennis (Bouton+Route+Prompt Telegram) | P1 |
| TODO_SESSION.md | En cours/Debug | Fix Data Tennis ATP/WTA matchs féminins tournois mixtes | P1 |
| TODO_SESSION.md | En cours/Debug | Fix Routage LIGA classement (ID 3) via /api/events/ | P1 |
| .context/rapport-bug-mobile-page-blanche-filtres-2026.md | Checklist | Reproduire bug mobile iOS Safari + Chrome Android | P1 |
| .context/rapport-bug-mobile-page-blanche-filtres-2026.md | Checklist | Appliquer Fix 1 applyFootballPreset + applyTennisPreset | P1 |
| .context/rapport-bug-mobile-page-blanche-filtres-2026.md | Checklist | Logger Fix 2 psLogout + apiFetch:401 trace VPS | P1 |
| .context/sessions/session-2026-05-06-v55-audit-experts.md | SAFE-002 | Appliquer safeFixed() aux 94 .toFixed() restants | P1 |
| .context/rapport-tennis-consolidation-2026.md | LOT P0 | Objet tennisMatch canonique + route /api/v1/tennis/matches | P1 |
| .context/rapport-tennis-consolidation-2026.md | LOT P0 | Tableau Tennis dense miroir Matchs football | P1 |
| .context/rapport-tennis-consolidation-2026.md | LOT P0 | Elo v2 recency decay + MoV + init bayésienne | P1 |
| .context/rapport-tennis-consolidation-2026.md | LOT P0 | Résolution surface via calendrier Tennis Explorer | P1 |
| .context/rapport-tennis-consolidation-2026.md | LOT P0 | Colonne Log-diff Elo vs rang ATP | P1 |
| .context/rapport-tennis-consolidation-2026.md | LOT P1 | Modèle point-par-point serve/return distribution jeux/sets | P1 |
| .context/rapport-tennis-consolidation-2026.md | LOT P1 | Backtesting tennis + /accuracy + calibration Brier blend | P1 |
| .context/test-report-h1-h6-final.md | Roadmap immédiate | Cron capture tennis score finals → tennisHistory.push | P1 |
| .context/test-report-h1-h6-final.md | Roadmap immédiate | Cleanup script tools/cleanup-history-edges.js purge legacy | P1 |

## P2 candidates (backlog)

| Fichier | Section | Tâche | Hint priorité |
|---|---|---|---|
| rapport_qa_foot_tennis.md | MIN-1 | LRU à 100 entries _tnPrematchSnapshot | P2 [bd:401] |
| rapport_qa_foot_tennis.md | MIN-2 | Supprimer dead code @media (min-width: 99999px) | P2 [bd:401] |
| rapport_qa_foot_tennis.md | MIN-3 | will-change + prefers-reduced-motion strict 12 animations live | P2 [bd:401] |
| rapport_qa_foot_tennis.md | MIN-4 | Audit fallback prefers-reduced-motion 30/59 keyframes | P2 [bd:401] |
| rapport_qa_foot_tennis.md | MIN-5 | filter:saturate(.55) Trading → opacity:0.65 | P2 [bd:401] |
| rapport_qa_foot_tennis.md | MIN-6 | Standardiser sticky col 2 offsets via --cf-sticky-col2 | P2 [bd:401] |
| rapport_qa_foot_tennis.md | MIN-7 | Audit 22 backdrop-filter sans -webkit- préfixe Safari | P2 [bd:401] |
| rapport_qa_foot_tennis.md | MIN-8 | setInterval cfRefreshT2K window._cfT2kInterval handle | P2 [bd:401] |
| rapport_qa_foot_tennis.md | COS-1/2/3 | Renommer keyframes dupliqués livePulse/pulse/spin | P2 [bd:401] |
| rapport_qa_foot_tennis.md | COS-4 | Créer tests/e2e Playwright minimal 3 smoke tests | P2 [bd:401] |
| .context/incident_securite_20260520.md | Backlog items | nginx ACL fichiers sensibles location regex | P2 [bd:c8m] |
| .context/incident_securite_20260520.md | Backlog items | Déplacer .env hors web root → /etc/pariscore/ | P2 [bd:c8m] |
| .context/incident_securite_20260520.md | Backlog items | Pre-commit hook gitleaks/trufflehog | P2 [bd:c8m] |
| .context/incident_securite_20260520.md | Backlog items | Monitoring 403 spikes alerts Prometheus | P2 [bd:c8m] |
| .context/incident_securite_20260520.md | Backlog items | Fail2ban config PariScore | P2 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 5 | Banner UI Maintenance sécurité reconnexion forcée | P2 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 6 | Signalement Cybermalveillance.gouv.fr + CERT-FR | P2 [bd:c8m] |
| .context/incident_securite_20260520.md | Phase 6 | Demande judiciaire SFR identité IP 37.65.65.25 | P2 [bd:c8m] |
| .context/strategy/marketing-affiliation.md | Phase 1 | Finaliser inscription 1xBet Partners + lien affilié DB | P2 |
| .context/strategy/marketing-affiliation.md | Phase 1 | Contacter manager 1xBet CPA + RevShare hybride | P2 |
| .context/strategy/marketing-affiliation.md | Phase 2 | Intégrer bouton Parier match cards + widget comparateur | P2 [bd:doublon-affiliation] |
| .context/strategy/marketing-affiliation.md | Phase 2 | Lancer campagnes TikTok Ads test €500 | P2 |
| .context/strategy/marketing-affiliation.md | Phase 3 | Recruter 5 affiliés Tipsters + dashboard affilié | P2 |
| .context/strategy/marketing-affiliation.md | Phase 4 | Activer SMS/Twilio rétention freemium + SEO 10 articles/mois | P2 |
| .context/strategy/marketing-affiliation.md | Phase 5 | Scale 15 affiliés + Facebook retargeting + tracking conversion | P2 |
| .context/strategy/marketing-affiliation.md | Week 1 | Compte Twitter/X @PariScoreAI + 1er thread 131 matchs IA | P2 |
| .context/strategy/marketing-affiliation.md | Week 2 | Lancer YouTube + blog "IA bat bookmakers 65%" + Telegram bot | P2 |
| .context/strategy/marketing-affiliation.md | Week 3 | Contacter Winamax + Unibet partnerships + boutons Parier | P2 |
| .context/strategy/marketing-affiliation.md | Outreach | Contacter Team Soccer Bet + Bureau des Tipsters Discord | P2 |
| .context/ROUTING-SCHEMA-2026.md | Phase 2+ | Route /api/v1/sources/health check provider+latence+quota | P2 |
| .context/ROUTING-SCHEMA-2026.md | Phase 2+ | Routes Understat /match/:id + /forecast?league=X | P2 |
| .context/ROUTING-SCHEMA-2026.md | Phase 2+ | Route /api/v1/metrics Prometheus live_dispatch_total | P2 |
| .context/ROUTING-SCHEMA-2026.md | Phase 2+ | Route /api/v1/affiliate/links CRUD + /users/me/preferences | P2 |
| .context/sessions/2026-05-17-refonte-tableau-concept-a.md | Reste à faire | Micro-barres inline Poisson (O2.5/BTTS) | P2 |
| .context/sessions/2026-05-17-refonte-tableau-concept-a.md | Reste à faire | Colonne jumelle 45'/90' style Datafoot | P2 |
| .context/sessions/2026-05-17-refonte-tableau-concept-a.md | Reste à faire | Étendre Concept A VALUE héros + tiers au tennis | P2 |
| .context/sessions/2026-05-17-refonte-tableau-concept-a.md | Reste à faire | Toggle densité Condensé/Normal/Aéré persisté | P2 |
| .context/sessions/2026-05-17-refonte-filtres-glass-neumorphism.md | Reste à faire | Étendre relief glass au toolbar mobile #mob-toolbar | P2 |
| .context/sessions/2026-05-17-refonte-filtres-glass-neumorphism.md | Reste à faire | Nettoyer inline styles .filter-row cosmétique | P2 |
| .context/audit-bsd-payloads.md | P1bis-P3 | TheSportsDB étendu + football-data.org + OpenFootball L5 fallback | P2 |
| .context/etude-apis-foot-gratuites-bsd-complement.md | Décisions | GO/NO-GO Priorité 1 TheSportsDB enrichment visuel | P2 |
| .context/etude-apis-foot-gratuites-bsd-complement.md | Décisions | GO/NO-GO Priorité 2 Understat xG scraping conditionnel | P2 |
| .context/etude-apis-foot-gratuites-bsd-complement.md | Décisions | GO/NO-GO Priorité 3 OpenFootball GitHub L5 fallback | P2 |
| .context/etude-apis-foot-gratuites-bsd-complement.md | Décisions | POC Highlightly / Live-Score API / SoccersAPI parallèle | P2 |
| .context/etude-apis-foot-gratuites-bsd-complement.md | Décisions | Audit BSD préalable (xG + logos payloads réels) | P2 |
| .context/etude-soccerdata-fbref.md | Phase 1 | POC Phase 1 (1-2j local, mesure divergence xG BSD vs FBref) | P2 [bd:8lqf,wect] |
| .context/etude-soccerdata-fbref.md | Phase 2 | Phase 2 batch (6-8h, cron nocturne + JSON load Node.js) | P2 [bd:8lqf,wect] |
| .context/etude-soccerdata-fbref.md | Phase 3 | Pattern A microservice → roadmap P0/P1 Bayesian Value Radar | P2 [bd:8lqf,wect] |
| .context/etude-soccerdata-fbref.md | Phase 3 | Audit TOS Sports-Reference avant code | P2 [bd:8lqf,wect] |
| .context/rapport-tennis-consolidation-2026.md | LOT P1 | Surface Speed Index maison (ace% ajusté) | P2 |
| .context/rapport-tennis-consolidation-2026.md | LOT P1 | Features fatigue/contexte 7/14j + voyage/fuseau/altitude | P2 |
| .context/rapport-tennis-consolidation-2026.md | LOT P2 | Bootstrap UQD + règle décision stricte tennis | P2 |
| .context/rapport-tennis-consolidation-2026.md | LOT P2 | Filtres marchés dérivés UI Set/Games betting | P2 |
| .context/rapport-tennis-consolidation-2026.md | LOT P2 | Worker thread Elo v2 + UQD | P2 |
| .context/rapport-tennis-consolidation-2026.md | LOT P2 | Meta-blend appris isotonic / logistic calibration | P2 |
| .context/rapport-tv-broadcasters-2026.md | Phase 2 | TheSportsDB Patreon $3/mo cible Q3 2026 | P2 |
| .context/rapport-tv-broadcasters-2026.md | Phase 3 | Sportmonks Worldwide $89/mo cible 2027 revenue $200+/mo | P2 |
| .context/rapport-tv-broadcasters-2026.md | Phase 4 | Audit maintenance saisonnier TV rotations droits | P2 |
| .context/audits/audit-etude-marche-data.md | Phase 1 | Ajout config ligues manquantes | P2 |
| .context/audits/audit-etude-marche-data.md | Phase 2 | Smart Fallback moyen terme | P2 |
| .context/audits/audit-etude-marche-data.md | Phase 3 | BSD expansion long terme | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Filtres L5/L10/L25 Client-Side tableau principal | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Filtres avancés (Poisson min slider, range cotes, time-to-kickoff, marché) | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Page Historique & Backtesting (P&L cumulé Chart.js) | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Architecture SSE /api/v1/live remplace polling 5min | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Live Intensity Score 0-100 composite possession/tirs/corners | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Gestion intelligente quotas API T1 6h / T2 12h | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Dropping Odds Tracker snapshot 2h + Δ flèche + chart évolution | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Power Score V2 Web scraping presse (L'Équipe, Marca) | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Système favoris star icon + localStorage/JWT + filtre Mes Favoris | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Algo Momentum Live backend SSE (AttDang×0.5+Tirs×1.5+Corners) | P2 [bd:8c5] |
| CLAUDE.md (project) | Roadmap v4.x | Composant graphique momentum Area Chart gradient | P2 [bd:8c5] |
| CLAUDE.md (project) | Roadmap v4.x | Intégration drapeaux 32px ronds filtres championnat | P2 |
| CLAUDE.md (project) | Roadmap v4.x | Nouveau filtre LIVE matchs en direct début liste | P2 |
| CLAUDE.md (project) | Roadmap v4.x P2-3 | In-Play Live Funnel (bloqué API live payante $50-200/mo) | P2 |
| CLAUDE.md (project) | Roadmap v4.x P2-3 | API Publique Documentée Swagger + tarifs Free/Pro/Business | P2 |
| CLAUDE.md (project) | Roadmap v4.x P2-3 | Migration SQLite remplace database.json + history.json | P2 |
| CLAUDE.md (project) | Roadmap v4.x P2-3 | Monétisation Stripe + landing SEO + dashboard abonnements | P2 |
| CLAUDE.md (project) | Roadmap v4.x P2-3 | Onglet Tendances Full /api/v1/trends + filtres marché | P2 |
| CLAUDE.md (project) | P0 Bayesian | Data Blender Poisson Bivarié + Elo dynamique + xG Logistic | P2 |
| CLAUDE.md (project) | P0 Bayesian | Script calibration historique 500 matchs | P2 |
| CLAUDE.md (project) | P1 UQD | Bootstrap UQD 500 itérations + IC90 par match | P2 |
| CLAUDE.md (project) | P1 UQD | Score composite fiabilité /100 + règle décision BET stricte | P2 |
| CLAUDE.md (project) | P2 Live Sniper | Poisson Time-Inhomogène remplace Poisson statique live | P2 |
| CLAUDE.md (project) | P2 Live Sniper | Context Engine météo/arbitres/kilométrage ajuste xG live | P2 |
| CLAUDE.md (project) | P2 Live Sniper | Alertes SSE favorite_trap + goal_flood push notif | P2 |
| Strategies à faire/Dev Audience/STRATEGIE8GROWTH.md | AEO | Créer fichier llms.txt API + modèles Poisson | P2 |
| Strategies à faire/Dev Audience/STRATEGIE8GROWTH.md | SEO | Structured Data Dataset/SportsEvent/FAQPage + PageSpeed 100/100 | P2 |
| Strategies à faire/Dev Audience/STRATEGIE8GROWTH.md | SEO | Page /about ultra-détaillée David + méthodologie (E-E-A-T) | P2 |
| Strategies à faire/Dev Audience/STRATEGIE8GROWTH.md | Content | Export GSC hebdo Claude + keyword gaps + CTR titres | P2 |
| Strategies à faire/Dev Audience/STRATEGIE8GROWTH.md | Architecture | SSR Server Side Rendering scores temps réel crawlers | P2 |

## Notes

### Doublons potentiels avec bd existants (signalés)

- 18 entrées P1 dans rapport_qa_foot_tennis.md sont déjà couvertes par bd ParisScorebis-401 (in_progress). Note v12.5 : 3/5 CRITIQUE fixés, CRIT-3 différé. MAJ/MIN backlog.
- 11 entrées P0 rotation clés/audit DB → toutes dans bd ParisScorebis-c8m (open, priority 0)
- Momentum La Liga + algo backend → bd ParisScorebis-8c5 (open) + entrée roadmap CLAUDE.md
- SEO robots.txt → bd ParisScorebis-u5x + d4rd (open)
- ETL Football → bd ParisScorebis-9je (in_progress) + h9j7 (OPS deploy)
- ETL Tennis → bd ParisScorebis-rxh (in_progress)
- ETL openfootball → bd ParisScorebis-6du6 (in_progress)
- ETL FBref → bd ParisScorebis-8lqf (in_progress) + wect (P2)
- ETL elofootball → bd ParisScorebis-8lvf (P1)
- BSD WebSocket live → bd ParisScorebis-5iw (in_progress)
- Spike odds alternatives → bd ParisScorebis-bjv (in_progress)
- PWA mobile e7l → install prompt + push livrés v12.19/v12.21, reste backend push (bd nwk6)
- Mobile bug page blanche filtres → rapport présent mais pas de bd dédié (à créer si pas couvert ailleurs)

### Tâches déjà couvertes par bd (à fermer du .md, signalées)

- Sessions 2026-05-17 refonte tableau/filtres : `Déploiement VPS OVH` listé 3× → couvert par bd ParisScorebis-h9j7 (OPS deploy global)
- AI-AL Tennis intégration : pas de bd, à créer si actif
- LIGA classement ID 3 fix routage : pas de bd, à créer ou archiver si obsolète

### Patterns récurrents observés

- **15+ checklist "Reste à faire" sessions/rapports** sans suivi bd → suggère création bd batch pour items ≥P1
- **Roadmap v4.x CLAUDE.md** : 18 items non checkés (P0 Bayesian Radar + P1 UQD + P2 Live Sniper + 10 features) — backlog projet le plus dense
- **TodoSession.md ligne 437** : 1 seul item ouvert (AI-AL Revue de Presse)
- **Décisions GO/NO-GO en attente DG** : 6+ rapports études bloqués sur arbitrage (FBref soccerdata, oddspapi RapidAPI, TheSportsDB Patreon, Transfermarkt Apify, OddsPortal, marketing-affiliation phases)

### Fichiers archive ignorés (filtrés)

- ARCHIVE_PROJECT.md (historique pure)
- CHANGELOG.md (lignes terminées)
- ARCHIVE_PROJECT.md.md (worktree backup)
- Sessions COMPLÉTÉES marquées ✅
- Test reports finalisés (test-report-*.md status FINAL)
- Rapports en cours (rapport-investigation-tennis-loading-2026.md : FIX déjà appliqué)

---

*Sweep automatique 21/05/2026 — pas de commit / pas de bd issue créé par l'agent. L'orchestrateur arbitre la suite.*
