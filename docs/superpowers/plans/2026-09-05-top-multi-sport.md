# Top Multi-Sport — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un composant "Top Multi-Sport" pleine largeur en haut de la page d'accueil, avec sélection de sport, style liguette par compétition (inspiré Behance Sports Bet), et polling automatique.

**Architecture:** Endpoint unifié `/api/v1/top-matches/all` qui agrège les APIs sport existantes via des adapters. Frontend = composant HTML/CSS/JS inséré dans `pariscore.html` avant le hero.

**Tech Stack:** Next.js App Router (route.ts), TypeScript, vanilla JS (legacy pattern), CSS custom properties, AppCache (pattern existant).

## Design Tokens (Behance Sports Bet)

| Rôle | Couleur | Usage |
|------|---------|-------|
| Primary | `#7B2FBE` / `#6C3CB4` | Headers ligue, nav active |
| Accent Cyan | `#00D4FF` / `#00BCD4` | Badges LIVE |
| Accent Orange | `#FF6B35` | Europa League, alerts |
| Green | `#00C853` | Best odds, VALEUR |
| Background | `#F5F5F5` | Fond de page |
| Cards | `#FFFFFF` | Fond lignes/cards |
| Text Primary | `#1A1A2E` | Noms, titres |
| Text Secondary | `#888888` | Heures, labels |
| Border | `#EEEEEE` | Séparateurs |

### Couleurs par ligue

| Ligue | Couleur |
|-------|---------|
| Champions League | `#6C3CB4` |
| Premier League | `#3D195B` |
| La Liga | `#FF4B44` |
| Serie A | `#024494` |
| Bundesliga | `#D20515` |
| Ligue 1 | `#0D47A1` |
| Liga Portugal | `#E30613` |
| Eredivisie | `#FF6600` |

## Global Constraints

- TypeScript strict mode, pas de `any`
- Comments en français
- Conventional commits `feat(scope): description`
- `bun run lint` + `bun run typecheck` avant chaque commit
- Pattern legacy : `var` + function declarations (pas de ES6 modules inline)
- CSS : `!important` uniquement si nécessaire pour override
- AppCache pour le cache client (pattern existant)

---

## Fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `src/lib/top-matches/types.ts` | Créer | Types partagés |
| `src/lib/top-matches/football.ts` | Créer | Adapter football |
| `src/lib/top-matches/tennis.ts` | Créer | Adapter tennis |
| `src/lib/top-matches/nba.ts` | Créer | Adapter NBA |
| `src/lib/top-matches/wnba.ts` | Créer | Adapter WNBA |
| `src/lib/top-matches/f1.ts` | Créer | Adapter F1 |
| `src/lib/top-matches/cs2.ts` | Créer | Adapter CS2 |
| `src/lib/top-matches/mma.ts` | Créer | Adapter MMA |
| `src/lib/top-matches/cycling.ts` | Créer | Adapter Cycling |
| `src/lib/top-matches/index.ts` | Créer | Agrégateur |
| `src/app/api/v1/top-matches/all/route.ts` | Créer | Endpoint |
| `pariscore.html` | Modifier | HTML + CSS + JS |
| `pariscore.js` | Modifier | Init showPage |

---

### Task 1: Types partagés

**Files:**
- Create: `src/lib/top-matches/types.ts`

**Interfaces:**
- Produces: `TopMatch`, `TopLeague`, `TopMatchResponse`, `SportAdapter`, `SportType`

- [ ] **Step 1: Créer les types**

```typescript
export interface TopTeam {
  name: string;
  logo?: string;
  rank?: number;
}

export interface TopOdds {
  home?: string;
  draw?: string;
  away?: string;
  best?: 'home' | 'draw' | 'away';
}

export interface TopMetric {
  label: string;
  value: number | string;
  max?: number;
}

export interface TopBadge {
  label: string;
  color: string;
}

export interface TopMatch {
  id: string;
  home: TopTeam;
  away: TopTeam;
  kickoff: string;
  status: 'scheduled' | 'live' | 'finished';
  score?: string;
  odds?: TopOdds;
  metric?: TopMetric;
  badge?: TopBadge;
}

export interface TopLeague {
  league: string;
  leagueIcon: string;
  leagueColor: string;
  sport: string;
  matches: TopMatch[];
}

export interface TopMatchResponse {
  groups: TopLeague[];
  generated_at: string;
}

export type SportType = 'football' | 'tennis' | 'nba' | 'wnba' | 'f1' | 'cs2' | 'mma' | 'cycling';

export interface SportAdapter {
  sport: SportType;
  fetch(limit: number, timeframe: string): Promise<TopLeague[]>;
}
```

- [ ] **Step 2: Vérifier TypeScript**

Run: `bun run typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/lib/top-matches/types.ts
git commit -m "feat(top-matches): add shared types for multi-sport top matches"
```

---

### Task 2: Adapter Football

**Files:**
- Create: `src/lib/top-matches/football.ts`

**Interfaces:**
- Consumes: Types de Task 1
- Produites: `footballAdapter: SportAdapter`

- [ ] **Step 1: Créer l'adapter**

```typescript
import type { SportAdapter, TopLeague, TopMatch } from './types';

const LEAGUE_COLORS: Record<string, string> = {
  'champions league': '#6C3CB4',
  'premier league': '#3D195B',
  'la liga': '#FF4B44',
  'serie a': '#024494',
  'bundesliga': '#D20515',
  'ligue 1': '#0D47A1',
  'eredivisie': '#FF6600',
  'liga portugal': '#E30613',
  'europa league': '#F57C00',
  default: '#455A64',
};

function getLeagueColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(LEAGUE_COLORS)) {
    if (key !== 'default' && lower.includes(key)) return color;
  }
  return LEAGUE_COLORS.default;
}

export const footballAdapter: SportAdapter = {
  sport: 'football',
  async fetch(limit, timeframe) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/v1/top-matches?timeframe=${timeframe}&limit=${limit}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const matches = data.matches || [];

    const byLeague = new Map<string, TopMatch[]>();
    for (const m of matches) {
      const league = m.league || m.competition || 'Autre';
      if (!byLeague.has(league)) byLeague.set(league, []);
      byLeague.get(league)!.push({
        id: String(m.id || m.match_id || ''),
        home: { name: m.homeTeam || m.home?.name || 'Home', logo: m.homeLogo || m.home?.logo, rank: m.homeRank },
        away: { name: m.awayTeam || m.away?.name || 'Away', logo: m.awayLogo || m.away?.logo, rank: m.awayRank },
        kickoff: m.kickoff || m.date || m.start_time || '',
        status: m.status === 'FT' ? 'finished' : m.is_live ? 'live' : 'scheduled',
        score: m.score || undefined,
        odds: m.odds ? {
          home: String(m.odds.home || m.odds[0] || ''),
          draw: String(m.odds.draw || m.odds[1] || ''),
          away: String(m.odds.away || m.odds[2] || ''),
          best: m.topPick?.label?.includes('Home') ? 'home' : m.topPick?.label?.includes('Away') ? 'away' : undefined,
        } : undefined,
        badge: m.topPick ? { label: m.topPick.label, color: '#00c853' } : undefined,
      });
    }

    const groups: TopLeague[] = [];
    for (const [league, leagueMatches] of byLeague) {
      groups.push({
        league,
        leagueIcon: '⚽',
        leagueColor: getLeagueColor(league),
        sport: 'football',
        matches: leagueMatches,
      });
    }
    return groups;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/top-matches/football.ts
git commit -m "feat(top-matches): add football adapter"
```

---

### Task 3: Adapter Tennis

**Files:**
- Create: `src/lib/top-matches/tennis.ts`

- [ ] **Step 1: Créer l'adapter**

```typescript
import type { SportAdapter, TopLeague, TopMatch } from './types';

const SURFACE_COLORS: Record<string, string> = {
  'clay': '#E65100',
  'hard': '#1565C0',
  'grass': '#2E7D32',
  'indoor': '#6A1B9A',
  default: '#455A64',
};

function getSurfaceColor(surface: string): string {
  for (const [key, color] of Object.entries(SURFACE_COLORS)) {
    if (key !== 'default' && surface.toLowerCase().includes(key)) return color;
  }
  return SURFACE_COLORS.default;
}

function mapReason(reason?: string): { label: string; color: string } {
  switch ((reason || '').toLowerCase()) {
    case 'en direct': case 'live': return { label: 'LIVE', color: '#f44336' };
    case 'valeur': case 'value': return { label: 'VALEUR', color: '#00c853' };
    case 'vapeur': return { label: 'VAPEUR', color: '#ff9800' };
    case 'classique': case 'classic': return { label: 'TOP', color: '#FFD700' };
    case 'drama': return { label: 'DRAMA', color: '#38bdf8' };
    case 'upset': return { label: 'UPSET', color: '#00bcd4' };
    default: return { label: 'TOP', color: '#455A64' };
  }
}

export const tennisAdapter: SportAdapter = {
  sport: 'tennis',
  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/v1/tennis/top10?mode=viewer`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const matches = (data.top10 || []).slice(0, limit);

    const byTourney = new Map<string, TopMatch[]>();
    for (const m of matches) {
      const tourney = m.tournament || 'Autre';
      if (!byTourney.has(tourney)) byTourney.set(tourney, []);
      const badge = mapReason(m.reason);
      byTourney.get(tourney)!.push({
        id: String(m.matchId || m.id || ''),
        home: { name: m.player1 || 'J1', rank: m.rank_p1 },
        away: { name: m.player2 || 'J2', rank: m.rank_p2 },
        kickoff: m.start_time ? new Date(m.start_time * 1000).toISOString() : '',
        status: m.is_live ? 'live' : m.status === 'FT' ? 'finished' : 'scheduled',
        score: m.live_score || undefined,
        metric: m.score_top10 != null ? { label: 'Score', value: m.score_top10, max: 100 } : undefined,
        badge: { label: badge.label, color: badge.color },
      });
    }

    const groups: TopLeague[] = [];
    for (const [tourney, tourneyMatches] of byTourney) {
      groups.push({
        league: tourney,
        leagueIcon: '🎾',
        leagueColor: getSurfaceColor(tourneyMatches[0]?.badge?.label || ''),
        sport: 'tennis',
        matches: tourneyMatches,
      });
    }
    return groups;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/top-matches/tennis.ts
git commit -m "feat(top-matches): add tennis adapter"
```

---

### Task 4: Adapters NBA, WNBA, F1, CS2, MMA, Cycling

**Files:**
- Create: `src/lib/top-matches/nba.ts`
- Create: `src/lib/top-matches/wnba.ts`
- Create: `src/lib/top-matches/f1.ts`
- Create: `src/lib/top-matches/cs2.ts`
- Create: `src/lib/top-matches/mma.ts`
- Create: `src/lib/top-matches/cycling.ts`

- [ ] **Step 1: NBA adapter**

```typescript
import type { SportAdapter, TopLeague } from './types';

export const nbaAdapter: SportAdapter = {
  sport: 'nba',
  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${base}/api/v1/nba/matches`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    const matches = (data.matches || []).slice(0, limit).map((m: Record<string, unknown>) => ({
      id: String(m.id || ''),
      home: { name: String(m.homeTeam || (m.home as Record<string,unknown>)?.name || 'Home'), logo: String(m.homeLogo || '') },
      away: { name: String(m.awayTeam || (m.away as Record<string,unknown>)?.name || 'Away'), logo: String(m.awayLogo || '') },
      kickoff: String(m.kickoff || m.date || ''),
      status: m.status === 'FT' ? 'finished' : m.is_live ? 'live' : 'scheduled',
      score: String(m.score || ''),
      odds: m.odds ? { home: String((m.odds as Record<string,unknown>).home || ''), away: String((m.odds as Record<string,unknown>).away || '') } : undefined,
    }));
    return [{ league: 'NBA', leagueIcon: '🏀', leagueColor: '#1D428A', sport: 'nba', matches }];
  },
};
```

- [ ] **Step 2: WNBA adapter** (même pattern, `/api/wnba/matches`)
- [ ] **Step 3: F1 adapter** (`/api/v1/f1`, value bets → format match)
- [ ] **Step 4: CS2, MMA, Cycling** (fallbacks vides)
- [ ] **Step 5: Commit**

```bash
git add src/lib/top-matches/nba.ts src/lib/top-matches/wnba.ts src/lib/top-matches/f1.ts src/lib/top-matches/cs2.ts src/lib/top-matches/mma.ts src/lib/top-matches/cycling.ts
git commit -m "feat(top-matches): add NBA, WNBA, F1, CS2, MMA, cycling adapters"
```

---

### Task 5: Agrégateur + Endpoint

**Files:**
- Create: `src/lib/top-matches/index.ts`
- Create: `src/app/api/v1/top-matches/all/route.ts`

- [ ] **Step 1: Agrégateur**

```typescript
import type { SportType, TopLeague } from './types';
import { footballAdapter } from './football';
import { tennisAdapter } from './tennis';
import { nbaAdapter } from './nba';
import { wnbaAdapter } from './wnba';
import { f1Adapter } from './f1';
import { cs2Adapter } from './cs2';
import { mmaAdapter } from './mma';
import { cyclingAdapter } from './cycling';

const adapters = {
  football: footballAdapter,
  tennis: tennisAdapter,
  nba: nbaAdapter,
  wnba: wnbaAdapter,
  f1: f1Adapter,
  cs2: cs2Adapter,
  mma: mmaAdapter,
  cycling: cyclingAdapter,
};

const ALL_SPORTS = Object.keys(adapters) as SportType[];

export async function fetchTopMatches(
  sport: SportType | 'all',
  limit: number,
  timeframe: string,
): Promise<TopLeague[]> {
  const sports = sport === 'all' ? ALL_SPORTS : [sport];
  const results = await Promise.allSettled(
    sports.map((s) => adapters[s].fetch(limit, timeframe)),
  );
  const groups: TopLeague[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') groups.push(...r.value);
  }
  return groups;
}
```

- [ ] **Step 2: Endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchTopMatches } from '@/lib/top-matches';
import type { SportType } from '@/lib/top-matches/types';

const VALID_SPORTS = ['all', 'football', 'tennis', 'nba', 'wnba', 'f1', 'cs2', 'mma', 'cycling'];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sport = (sp.get('sport') || 'all') as SportType | 'all';
  const limit = Math.min(20, Math.max(1, parseInt(sp.get('limit') || '10')));
  const timeframe = sp.get('timeframe') || 'today';

  if (!VALID_SPORTS.includes(sport)) {
    return NextResponse.json({ error: `Invalid sport. Valid: ${VALID_SPORTS.join(', ')}` }, { status: 400 });
  }

  try {
    const groups = await fetchTopMatches(sport, limit, timeframe);
    return NextResponse.json({
      groups,
      generated_at: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json({ groups: [], generated_at: new Date().toISOString() });
  }
}
```

- [ ] **Step 3: Tester**

Run: `curl "http://localhost:3000/api/v1/top-matches/all?sport=football&limit=3"`

- [ ] **Step 4: Commit**

```bash
git add src/lib/top-matches/index.ts src/app/api/v1/top-matches/all/route.ts
git commit -m "feat(top-matches): add unified endpoint and aggregator"
```

---

### Task 6: HTML + CSS dans pariscore.html

**Files:**
- Modify: `pariscore.html` — insérer avant le hero (~ligne 13496)

- [ ] **Step 1: HTML du composant**

Insérer avant `<section>` (hero) :

```html
<!-- ═══ TOP MULTI-SPORT — Pleine largeur (Behance style) ═══ -->
<div id="top-multi-sport" class="tms-container">
  <div class="tms-header">
    <div class="tms-title-row">
      <h2 class="tms-title">Top Matchs du Jour</h2>
      <span class="tms-count" id="tms-count"></span>
    </div>
    <div class="tms-controls">
      <div class="tms-sport-tabs" id="tms-sport-tabs">
        <button class="tms-tab active" data-sport="all" onclick="tmsSwitchSport('all',this)">Tous</button>
        <button class="tms-tab" data-sport="football" onclick="tmsSwitchSport('football',this)">⚽ Football</button>
        <button class="tms-tab" data-sport="tennis" onclick="tmsSwitchSport('tennis',this)">🎾 Tennis</button>
        <button class="tms-tab" data-sport="nba" onclick="tmsSwitchSport('nba',this)">🏀 NBA</button>
        <button class="tms-tab" data-sport="wnba" onclick="tmsSwitchSport('wnba',this)">🏀 WNBA</button>
        <button class="tms-tab" data-sport="f1" onclick="tmsSwitchSport('f1',this)">🏎️ F1</button>
        <button class="tms-tab" data-sport="cs2" onclick="tmsSwitchSport('cs2',this)">🎮 CS2</button>
        <button class="tms-tab" data-sport="mma" onclick="tmsSwitchSport('mma',this)">🥊 MMA</button>
        <button class="tms-tab" data-sport="cycling" onclick="tmsSwitchSport('cycling',this)">🚴 Cycling</button>
      </div>
      <button class="tms-refresh" id="tms-refresh" onclick="tmsRefresh()" title="Rafraîchir">⟳</button>
    </div>
  </div>
  <div class="tms-leagues" id="tms-leagues">
    <div class="tms-loading">Chargement...</div>
  </div>
  <div class="tms-empty" id="tms-empty" style="display:none;">Aucun match top disponible.</div>
</div>
```

- [ ] **Step 2: CSS (style Behance)**

```css
/* ═══ TOP MULTI-SPORT — Sports Bet Style ═══ */
.tms-container {
  width: 100%;
  padding: 20px 24px;
  margin-bottom: 24px;
  background: #f5f5f5;
  border-radius: 16px;
  box-sizing: border-box;
}
.tms-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.tms-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tms-title {
  font-size: 20px;
  font-weight: 800;
  color: #1a1a2e;
  margin: 0;
  letter-spacing: -0.3px;
}
.tms-count {
  font-size: 12px;
  color: #888;
  font-family: var(--font-mono);
}
.tms-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tms-sport-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.tms-sport-tabs::-webkit-scrollbar { display: none; }
.tms-tab {
  padding: 7px 14px;
  border: none;
  border-radius: 20px;
  background: #e8e8e8;
  color: #666;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.tms-tab:hover { background: #ddd; }
.tms-tab.active {
  background: #7B2FBE;
  color: #fff;
}
.tms-refresh {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: #e8e8e8;
  color: #555;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.tms-refresh:hover { background: #ddd; }
.tms-refresh.tms-spinning { animation: tms-spin 0.5s ease; }
@keyframes tms-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* League card */
.tms-league-card {
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.tms-league-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  gap: 8px;
}
.tms-league-cols {
  margin-left: auto;
  display: flex;
  gap: 24px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.85;
}

/* Match row */
.tms-match-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background 0.15s;
}
.tms-match-row:last-child { border-bottom: none; }
.tms-match-row:hover { background: #fafafa; }
.tms-match-time {
  width: 52px;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tms-date {
  font-size: 10px;
  color: #999;
  font-weight: 400;
}
.tms-match-teams {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 10px;
}
.tms-team {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tms-team-logo {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #eee;
}
.tms-team-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}
.tms-match-odds {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.tms-odds-box {
  padding: 6px 12px;
  border-radius: 6px;
  background: #f5f5f5;
  font-size: 13px;
  font-weight: 700;
  min-width: 52px;
  text-align: center;
  color: #333;
}
.tms-odds--best {
  background: #00c853;
  color: #fff;
}
.tms-metric {
  flex-shrink: 0;
  text-align: right;
  min-width: 70px;
}
.tms-metric-value {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a2e;
}
.tms-metric-label {
  font-size: 10px;
  color: #888;
}
.tms-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  margin-left: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.tms-loading, .tms-empty {
  text-align: center;
  padding: 30px;
  color: #999;
  font-size: 13px;
}
@media (max-width: 768px) {
  .tms-container { padding: 14px 12px; }
  .tms-header { flex-direction: column; align-items: flex-start; }
  .tms-match-row { flex-wrap: wrap; gap: 8px; }
  .tms-match-odds { width: 100%; justify-content: flex-end; }
  .tms-league-cols { display: none; }
}
```

- [ ] **Step 3: Commit**

```bash
git add pariscore.html
git commit -m "feat(top-matches): add HTML and CSS for Top Multi-Sport (Behance style)"
```

---

### Task 7: JavaScript dans pariscore.html

**Files:**
- Modify: `pariscore.html` — ajouter JS après le CSS

- [ ] **Step 1: Fonctions JS**

```javascript
// ═══ TOP MULTI-SPORT ═══
var _tmsSport = 'all';
var _tmsTimer = null;
var _tmsForceRefresh = false;

async function initTopMultiSport() {
  _tmsStopPolling();
  await _tmsFetch();
  _tmsStartPolling();
}

function _tmsStopPolling() {
  if (_tmsTimer) { clearInterval(_tmsTimer); _tmsTimer = null; }
}

function _tmsStartPolling() {
  _tmsStopPolling();
  _tmsTimer = setInterval(function() {
    _tmsForceRefresh = false;
    _tmsFetch();
  }, 120000);
}

async function _tmsFetch() {
  var leaguesEl = document.getElementById('tms-leagues');
  var emptyEl = document.getElementById('tms-empty');
  var countEl = document.getElementById('tms-count');
  if (!leaguesEl) return;

  var cacheKey = '/api/v1/top-matches/all?sport=' + _tmsSport;
  if (!_tmsForceRefresh) {
    try {
      var cached = AppCache.get(cacheKey);
      if (cached && cached.groups && cached.groups.length) {
        _tmsRender(cached, countEl, leaguesEl, emptyEl);
        return;
      }
    } catch(_) {}
  }

  try {
    leaguesEl.innerHTML = '<div class="tms-loading">Chargement...</div>';
    emptyEl.style.display = 'none';
    var res = await fetch('/api/v1/top-matches/all?sport=' + _tmsSport + '&limit=10&_=' + Date.now());
    var data = await res.json();
    AppCache.set(cacheKey, data, 60000, 300000);
    _tmsRender(data, countEl, leaguesEl, emptyEl);
  } catch(err) {
    leaguesEl.innerHTML = '';
    emptyEl.style.display = 'block';
    emptyEl.textContent = 'Impossible de charger les matchs.';
  }
}

function _tmsRender(data, countEl, leaguesEl, emptyEl) {
  var groups = data.groups || [];
  if (!groups.length) {
    leaguesEl.innerHTML = '';
    emptyEl.style.display = 'block';
    if (countEl) countEl.textContent = '';
    return;
  }
  emptyEl.style.display = 'none';
  var totalMatches = groups.reduce(function(s, g) { return s + g.matches.length; }, 0);
  if (countEl) countEl.textContent = totalMatches + ' matchs';

  var html = '';
  for (var i = 0; i < groups.length; i++) {
    html += _tmsRenderLigue(groups[i]);
  }
  leaguesEl.innerHTML = html;
}

function _tmsRenderLigue(group) {
  var html = '<div class="tms-league-card">';
  html += '<div class="tms-league-header" style="background:' + _tmsEsc(group.leagueColor) + '">';
  html += '<span>' + _tmsEsc(group.leagueIcon) + '</span>';
  html += '<span>' + _tmsEsc(group.league) + '</span>';
  if (group.sport === 'football') {
    html += '<div class="tms-league-cols"><span>W1</span><span>N</span><span>W2</span></div>';
  }
  html += '</div>';
  for (var j = 0; j < group.matches.length; j++) {
    html += _tmsRenderMatch(group.matches[j], group.sport);
  }
  html += '</div>';
  return html;
}

function _tmsRenderMatch(m, sport) {
  var t = m.kickoff ? new Date(m.kickoff) : null;
  var timeStr = t ? String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0') : '—';
  var dateStr = t ? t.getDate() + '/' + (t.getMonth()+1) : '';

  var html = '<div class="tms-match-row" onclick="tmsGoToMatch(\'' + _tmsEsc(m.id) + '\',\'' + _tmsEsc(sport) + '\')">';
  html += '<div class="tms-match-time"><span>' + timeStr + '</span><span class="tms-date">' + dateStr + '</span></div>';
  html += '<div class="tms-match-teams">';
  html += '<div class="tms-team">';
  if (m.home.logo) html += '<img class="tms-team-logo" src="' + _tmsEsc(m.home.logo) + '" alt="" loading="lazy">';
  html += '<span class="tms-team-name">' + _tmsEsc(m.home.name) + '</span>';
  html += '</div>';
  html += '<div class="tms-team">';
  if (m.away.logo) html += '<img class="tms-team-logo" src="' + _tmsEsc(m.away.logo) + '" alt="" loading="lazy">';
  html += '<span class="tms-team-name">' + _tmsEsc(m.away.name) + '</span>';
  html += '</div>';
  html += '</div>';

  if (sport === 'tennis' || sport === 'f1') {
    if (m.metric) {
      html += '<div class="tms-metric">';
      html += '<div class="tms-metric-value">' + m.metric.value + (m.metric.max ? '/' + m.metric.max : '') + '</div>';
      html += '<div class="tms-metric-label">' + _tmsEsc(m.metric.label) + '</div>';
      html += '</div>';
    }
  } else if (m.odds) {
    html += '<div class="tms-match-odds">';
    html += '<span class="tms-odds-box' + (m.odds.best === 'home' ? ' tms-odds--best' : '') + '">' + _tmsEsc(m.odds.home || '—') + '</span>';
    html += '<span class="tms-odds-box' + (m.odds.best === 'draw' ? ' tms-odds--best' : '') + '">' + _tmsEsc(m.odds.draw || '—') + '</span>';
    html += '<span class="tms-odds-box' + (m.odds.best === 'away' ? ' tms-odds--best' : '') + '">' + _tmsEsc(m.odds.away || '—') + '</span>';
    html += '</div>';
  }

  if (m.badge) {
    html += '<span class="tms-badge" style="background:' + _tmsEsc(m.badge.color) + '">' + _tmsEsc(m.badge.label) + '</span>';
  }
  html += '</div>';
  return html;
}

function _tmsEsc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tmsSwitchSport(sport, btn) {
  _tmsSport = sport;
  _tmsForceRefresh = true;
  document.querySelectorAll('.tms-tab').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  _tmsFetch();
}

function tmsRefresh() {
  _tmsForceRefresh = true;
  _tmsFetch();
  var el = document.getElementById('tms-refresh');
  if (el) { el.classList.add('tms-spinning'); setTimeout(function() { el.classList.remove('tms-spinning'); }, 500); }
}

function tmsGoToMatch(id, sport) {
  if (sport === 'tennis') showPage('tennis');
  else if (sport === 'nba') showPage('nba');
  else if (sport === 'f1') showPage('f1');
  else if (sport === 'cs2') showPage('cs2');
  else if (sport === 'mma') showPage('mma');
  else if (sport === 'cycling') showPage('cycling');
  else showPage('matchs');
}
```

- [ ] **Step 2: Commit**

```bash
git add pariscore.html
git commit -m "feat(top-matches): add JavaScript for Top Multi-Sport"
```

---

### Task 8: Intégration showPage

**Files:**
- Modify: `pariscore.js` — ligne ~932

- [ ] **Step 1: Ajouter initTopMultiSport()**

Dans le bloc `if (pageId === 'accueil')`, ajouter avant `initAccueilTopMatches()` :

```javascript
  initTopMultiSport();
```

- [ ] **Step 2: Commit**

```bash
git add pariscore.js
git commit -m "feat(top-matches): integrate Top Multi-Sport init in showPage"
```

---

### Task 9: Quality gates

- [ ] **Step 1: Lint**

Run: `bun run lint`

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`

- [ ] **Step 3: Test endpoint**

Run: `curl http://localhost:3000/api/v1/top-matches/all?sport=all&limit=5`

- [ ] **Step 4: Vérifier rendu**

Ouvrir http://localhost:3000 → page d'accueil → Top Multi-Sport visible au-dessus du hero

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(top-matches): complete Top Multi-Sport component"
```
