/**
 * BSD WebSocket Handler v2 — Deep Merge Edition
 * ================================================
 * INTEGRATION GUIDE (attendre GO avant injection server.js) :
 *
 * 1. Remplacer `_bsdWsApplyEventStats` par `_bsdWsApplyEventStatsV2`  (drop-in)
 * 2. Remplacer le bloc `if (t === 'event')` par `_bsdWsDTOEvent`
 * 3. Ajouter `_wsGuardedPatch`, `_WS_STATIC_FIELDS`, `_bsdMergeIncidents`,
 *    `_bsdMergeShotmap`, `pollBSDLiveEnrichment` comme nouveaux helpers
 * 4. Appeler `pollBSDLiveEnrichment()` dans le cron poll live (toutes les 30s)
 *
 * AUCUNE modification aux champs statiques (elo, rank, poisson, fair, etc.)
 */

// ═══════════════════════════════════════════════════════════════════════════
// DEEP MERGE GUARD — whitelist des champs PROTÉGÉS contre écrasement WS
// ═══════════════════════════════════════════════════════════════════════════
const _WS_STATIC_FIELDS = new Set([
  // Enrichissement tennis (jamais touché par WS football)
  'player1', 'player2', 'predictions', 'surface', 'tour', 'round',
  'surf_rank', 'surf_rank_total', 'surf_form', 'elo_surface',
  'l5_pts', 'l10_pts', 'powerscore', 'ps_rank', 'ps_total',
  // Analyse mathématique pré-match
  'poisson', 'fair', 'edge', 'best_edge',
  'blended', 'calibrated', 'reliability', 'bootstrap_uqd',
  'blended_tennis', 'markov',
  // xG statique (Poisson) — uniquement overridable si source='bsd_real' via buildMatchRecord
  // Note: live_xg (WS) est un champ DIFFÉRENT de expectedGoals (pré-match)
  'expectedGoals',
  // Classements & forme pré-match
  'home_rank', 'away_rank', 'home_form', 'away_form',
  'stats',                    // stats historiques domicile/extérieur
  'bsd_coaches',              // enrichissement coaches (statique sur durée match)
  'bsd_unavailable',          // liste indisponibles (statique)
]);

/**
 * Patch sécurisé : écrit field=value sur m UNIQUEMENT si field non protégé.
 * Null/undefined ignorés (pas de pollution).
 * @param {object} m - Match object from db.matches
 * @param {string} field
 * @param {*} value
 */
function _wsGuardedPatch(m, field, value) {
  if (_WS_STATIC_FIELDS.has(field)) return; // ← PROTECTION
  if (value === null || value === undefined) return;
  m[field] = value;
}

// ═══════════════════════════════════════════════════════════════════════════
// DTO EVENT STATS V2 — 38 champs (vs 16 dans v1)
// Drop-in remplaçant de _bsdWsApplyEventStats
// ═══════════════════════════════════════════════════════════════════════════
function _bsdWsApplyEventStatsV2(m, stats) {
  if (!stats || typeof stats !== 'object') return;
  const h = stats.home || {};
  const a = stats.away || {};

  // Helper: pair {home, away} ou null si les deux null
  const pair = (kh, ka) => {
    const nh = kh == null ? null : Number(kh);
    const na = ka == null ? null : Number(ka);
    if (nh === null && na === null) return undefined;
    return { home: nh, away: na };
  };
  // Helper: objet {value, total, pct} depuis champ BSD (objet ou scalaire)
  const ratioObj = (kh, ka) => {
    const vh = h[kh], va = a[ka || kh];
    if (vh == null && va == null) return undefined;
    const map = v => (v && typeof v === 'object')
      ? { value: v.value == null ? null : Number(v.value), total: v.total == null ? null : Number(v.total), pct: v.pct == null ? null : Number(v.pct) }
      : (v == null ? null : { value: Number(v), total: null, pct: null });
    return { home: map(vh), away: map(va) };
  };
  const apct = v => (v && typeof v === 'object' && 'pct' in v) ? Number(v.pct) : (v == null ? null : Number(v));

  // ── DÉJÀ CAPTURÉS (v1) — conservés ────────────────────────────────────
  const poss = pair(h.ball_possession, a.ball_possession);
  if (poss !== undefined) _wsGuardedPatch(m, 'live_possession', poss);

  const shots = pair(h.total_shots, a.total_shots);
  if (shots !== undefined) _wsGuardedPatch(m, 'live_shots', shots);

  const sot = pair(h.shots_on_target, a.shots_on_target);
  if (sot !== undefined) _wsGuardedPatch(m, 'live_shots_on_target', sot);

  const sofft = pair(h.shots_off_target, a.shots_off_target);
  if (sofft !== undefined) _wsGuardedPatch(m, 'live_shots_off_target', sofft);

  const sib = pair(h.shots_inside_box, a.shots_inside_box);
  if (sib !== undefined) _wsGuardedPatch(m, 'live_shots_inside_box', sib);

  const blk = pair(h.blocked_shots, a.blocked_shots);
  if (blk !== undefined) _wsGuardedPatch(m, 'live_shots_blocked', blk);

  const ck = pair(h.corner_kicks, a.corner_kicks);
  if (ck !== undefined) _wsGuardedPatch(m, 'live_corners', ck);

  const fouls = pair(h.fouls, a.fouls);
  if (fouls !== undefined) _wsGuardedPatch(m, 'live_fouls', fouls);

  const offs = pair(h.offsides, a.offsides);
  if (offs !== undefined) _wsGuardedPatch(m, 'live_offsides', offs);

  if (h.yellow_cards != null || a.yellow_cards != null || h.red_cards != null || a.red_cards != null) {
    _wsGuardedPatch(m, 'live_cards', {
      home: { yellow: Number(h.yellow_cards || 0), red: Number(h.red_cards || 0) },
      away: { yellow: Number(a.yellow_cards || 0), red: Number(a.red_cards || 0) },
    });
  }

  const passes = pair(h.passes || h.accurate_passes, a.passes || a.accurate_passes);
  if (passes !== undefined) _wsGuardedPatch(m, 'live_passes', passes);

  const passAcc = pair(apct(h.pass_accuracy_pct), apct(a.pass_accuracy_pct));
  if (passAcc !== undefined) _wsGuardedPatch(m, 'live_pass_accuracy', passAcc);

  const bc = pair(h.big_chances, a.big_chances);
  if (bc !== undefined) _wsGuardedPatch(m, 'live_big_chances', bc);

  const bcm = pair(h.big_chances_missed, a.big_chances_missed);
  if (bcm !== undefined) _wsGuardedPatch(m, 'live_big_chances_missed', bcm);

  const xg = pair(h.xg || h.expected_goals, a.xg || a.expected_goals);
  if (xg !== undefined) _wsGuardedPatch(m, 'live_xg', xg);

  const tipb = pair(h.touches_in_penalty_area, a.touches_in_penalty_area);
  if (tipb !== undefined) _wsGuardedPatch(m, 'live_touches_opp_box', tipb);

  const da = pair(h.dangerous_attack, a.dangerous_attack);
  if (da !== undefined) _wsGuardedPatch(m, 'live_dangerous_attacks', da);

  // momentum_pct (objet BSD, distinct de momentum timeline Sofa — bd 8c5 fix)
  if (h.attack_pct != null || a.attack_pct != null || h.dangerous_attack_pct != null || a.dangerous_attack_pct != null) {
    _wsGuardedPatch(m, 'live_momentum_pct', {
      home: {
        attack_pct: h.attack_pct == null ? null : Number(h.attack_pct),
        dangerous_attack_pct: h.dangerous_attack_pct == null ? null : Number(h.dangerous_attack_pct),
        ball_safe_pct: h.ball_safe_pct == null ? null : Number(h.ball_safe_pct),
      },
      away: {
        attack_pct: a.attack_pct == null ? null : Number(a.attack_pct),
        dangerous_attack_pct: a.dangerous_attack_pct == null ? null : Number(a.dangerous_attack_pct),
        ball_safe_pct: a.ball_safe_pct == null ? null : Number(a.ball_safe_pct),
      },
    });
  }

  // ── NOUVEAUX — v2 ──────────────────────────────────────────────────────

  // Gardien
  const saves = pair(h.goalkeeper_saves || h.total_saves, a.goalkeeper_saves || a.total_saves);
  if (saves !== undefined) _wsGuardedPatch(m, 'live_saves', saves);

  const gp = pair(h.goals_prevented, a.goals_prevented);
  if (gp !== undefined) _wsGuardedPatch(m, 'live_goals_prevented', gp);

  // Récupérations / interceptions / duels
  const inter = pair(h.interceptions, a.interceptions);
  if (inter !== undefined) _wsGuardedPatch(m, 'live_interceptions', inter);

  const recov = pair(h.recoveries, a.recoveries);
  if (recov !== undefined) _wsGuardedPatch(m, 'live_recoveries', recov);

  const tackles = pair(h.tackles || h.total_tackles, a.tackles || a.total_tackles);
  if (tackles !== undefined) _wsGuardedPatch(m, 'live_tackles', tackles);

  const aerials = ratioObj('aerial_duels');
  if (aerials !== undefined) _wsGuardedPatch(m, 'live_aerial_duels', aerials);

  const groundD = ratioObj('ground_duels');
  if (groundD !== undefined) _wsGuardedPatch(m, 'live_ground_duels', groundD);

  const dribs = ratioObj('dribbles');
  if (dribs !== undefined) _wsGuardedPatch(m, 'live_dribbles', dribs);

  // Transitions / jeu long
  const crosses = ratioObj('crosses');
  if (crosses !== undefined) _wsGuardedPatch(m, 'live_crosses', crosses);

  const longB = ratioObj('long_balls');
  if (longB !== undefined) _wsGuardedPatch(m, 'live_long_balls', longB);

  // Pression zone finale
  const fte = pair(h.final_third_entries, a.final_third_entries);
  if (fte !== undefined) _wsGuardedPatch(m, 'live_final_third_entries', fte);

  const ftp = pair(
    h.final_third_phase && h.final_third_phase.pct != null ? Number(h.final_third_phase.pct) : h.final_third_phase,
    a.final_third_phase && a.final_third_phase.pct != null ? Number(a.final_third_phase.pct) : a.final_third_phase
  );
  if (ftp !== undefined) _wsGuardedPatch(m, 'live_final_third_pct', ftp);

  // Séquences défensives / balle arrêtée
  const hw = pair(h.hit_woodwork, a.hit_woodwork);
  if (hw !== undefined) _wsGuardedPatch(m, 'live_woodwork', hw);

  const clears = pair(h.clearances, a.clearances);
  if (clears !== undefined) _wsGuardedPatch(m, 'live_clearances', clears);

  const throwI = pair(h.throw_ins, a.throw_ins);
  if (throwI !== undefined) _wsGuardedPatch(m, 'live_throw_ins', throwI);

  const gk = pair(h.goal_kicks, a.goal_kicks);
  if (gk !== undefined) _wsGuardedPatch(m, 'live_goal_kicks', gk);

  const fk = pair(h.free_kicks, a.free_kicks);
  if (fk !== undefined) _wsGuardedPatch(m, 'live_free_kicks', fk);

  const disp = pair(h.dispossessed, a.dispossessed);
  if (disp !== undefined) _wsGuardedPatch(m, 'live_dispossessed', disp);

  // Shots outside box
  const sob = pair(h.shots_outside_box, a.shots_outside_box);
  if (sob !== undefined) _wsGuardedPatch(m, 'live_shots_outside_box', sob);

  // Big chances scored
  const bcs = pair(h.big_chances_scored, a.big_chances_scored);
  if (bcs !== undefined) _wsGuardedPatch(m, 'live_big_chances_scored', bcs);
}

// ═══════════════════════════════════════════════════════════════════════════
// DTO EVENT — remplace le bloc `if (t === 'event')` dans _bsdWsHandleJSON
// ═══════════════════════════════════════════════════════════════════════════
function _bsdWsDTOEvent(msg, m, alertHook) {
  const _prevScore = m.live_score;

  // Score
  if (msg.score) {
    const hs = msg.score.home, as_ = msg.score.away;
    if (hs != null && as_ != null) _wsGuardedPatch(m, 'live_score', hs + '-' + as_);
  }

  // Temps
  if (msg.time) {
    if (msg.time.minute != null) _wsGuardedPatch(m, 'live_minute', Number(msg.time.minute));
    if (msg.time.status) _wsGuardedPatch(m, 'status', msg.time.status);
    if (msg.time.period) _wsGuardedPatch(m, 'live_period', msg.time.period);
    // ← NOUVEAU: temps additionnel
    if (msg.time.added_time != null) _wsGuardedPatch(m, 'live_added_time', Number(msg.time.added_time));
  }

  // Stats enrichies v2
  _bsdWsApplyEventStatsV2(m, msg.stats);

  // Alertes (bd vl02)
  if (typeof alertHook === 'function') {
    try { alertHook(m, _prevScore); } catch (_) { /* non bloquant */ }
  }

  return _prevScore;
}

// ═══════════════════════════════════════════════════════════════════════════
// MERGE INCIDENTS — REST get_match_incidents → m.live_incidents
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalise un incident BSD → format PariScore canonique.
 * Filtre les types inconnus/inutiles.
 */
function _bsdNormalizeIncident(inc) {
  if (!inc || !inc.type) return null;
  const t = inc.type;

  // Types supportés
  const SUPPORTED = new Set(['goal', 'card', 'yellowcard', 'redcard', 'substitution',
                              'injurytime', 'var', 'period', 'missedpenalty', 'penalty']);
  const tLow = t.toLowerCase().replace(/[-_\s]/g, '');
  if (!SUPPORTED.has(tLow) && !tLow.includes('card') && !tLow.includes('goal')) return null;

  const out = {
    type: tLow,
    minute: inc.minute != null ? Number(inc.minute) : null,
    added_time: inc.added_time != null ? Number(inc.added_time) : null,
    is_home: inc.is_home ?? null,
    ts: Date.now(),
  };

  if (tLow === 'goal') {
    out.player = inc.player || null;
    out.player_id = inc.player_id || null;
    out.assist = inc.assist || null;
    out.goal_type = inc.goal_type || 'regular'; // regular | own_goal | penalty
    out.home_score = inc.home_score != null ? Number(inc.home_score) : null;
    out.away_score = inc.away_score != null ? Number(inc.away_score) : null;
    // Séquence de passes avec coords (riche — optionnel, plafond 10 steps)
    if (Array.isArray(inc.sequence) && inc.sequence.length) {
      out.sequence = inc.sequence.slice(0, 10).map(s => ({
        event: s.event,
        player: s.player,
        pid: s.pid,
        pos: s.pos ? { x: Number(s.pos.x), y: Number(s.pos.y) } : null,
        end: s.end ? { x: Number(s.end.x), y: Number(s.end.y) } : null,
        assist: s.assist || false,
        body: s.body || null,
        gk: s.gk ? { x: Number(s.gk.x), y: Number(s.gk.y) } : null,
      }));
    }
  } else if (tLow === 'injurytime') {
    out.length = inc.length != null ? Number(inc.length) : null;
  } else if (tLow === 'substitution') {
    out.player_in = inc.player_in || inc.player || null;
    out.player_out = inc.player_out || null;
    out.player_in_id = inc.player_in_id || null;
    out.player_out_id = inc.player_out_id || null;
  } else if (tLow.includes('card')) {
    out.player = inc.player || null;
    out.player_id = inc.player_id || null;
    out.card = tLow.includes('red') ? 'red' : 'yellow';
  }

  return out;
}

/**
 * Fusionne les incidents REST dans m.live_incidents (dédup par clé composite).
 */
function _bsdMergeIncidents(m, incidents) {
  if (!Array.isArray(incidents) || !incidents.length) return;

  if (!Array.isArray(m.live_incidents)) m.live_incidents = [];

  // Clé dédup : minute|type|player_id (ou player name si pas d'id)
  const _key = inc => `${inc.minute}|${inc.type}|${inc.player_id || inc.player || inc.length || ''}`;
  const existing = new Set(m.live_incidents.map(_key));

  let added = 0;
  for (const raw of incidents) {
    const norm = _bsdNormalizeIncident(raw);
    if (!norm) continue;
    const k = _key(norm);
    if (existing.has(k)) continue;
    existing.add(k);
    m.live_incidents.push(norm);
    added++;
  }

  // Tri chronologique
  if (added > 0) {
    m.live_incidents.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    // Plafond mémoire : 50 incidents max
    if (m.live_incidents.length > 50) m.live_incidents = m.live_incidents.slice(-50);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MERGE SHOTMAP — REST get_match_shotmap → m.live_momentum / live_xg_per_minute
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fusionne le shotmap BSD (momentum, xG/min, shots) dans le match.
 * - live_momentum : Array [{m, v}] — REMPLACE l'array (Sofa compatible)
 * - live_xg_per_minute : Array [{m, xg_home, xg_away, cum_home, cum_away}]
 * - live_shotmap : Array de shots (capped 50, triés par minute)
 */
function _bsdMergeShotmap(m, shotmapData) {
  if (!shotmapData || typeof shotmapData !== 'object') return;

  // Momentum timeline [{m: minute, v: -100..100}]
  // Remplace live_momentum array (Array.isArray guard préservé frontend bd 8c5)
  if (Array.isArray(shotmapData.momentum) && shotmapData.momentum.length) {
    // Guard: valeurs dans plage -100..100, minutes 1..120
    const cleaned = shotmapData.momentum
      .filter(e => e && e.m != null && e.v != null)
      .map(e => ({ m: Number(e.m), v: Math.max(-100, Math.min(100, Number(e.v))) }))
      .filter(e => Number.isFinite(e.m) && Number.isFinite(e.v));
    if (cleaned.length) m.live_momentum = cleaned; // ← direct (pas via guard, c'est un champ live)
  }

  // xG par minute [{m, xg_home, xg_away, cum_home, cum_away}]
  if (Array.isArray(shotmapData.xg_per_minute) && shotmapData.xg_per_minute.length) {
    const cleaned = shotmapData.xg_per_minute
      .filter(e => e && e.m != null)
      .map(e => ({
        m: Number(e.m),
        xg_home: e.xg_home != null ? parseFloat(Number(e.xg_home).toFixed(3)) : 0,
        xg_away: e.xg_away != null ? parseFloat(Number(e.xg_away).toFixed(3)) : 0,
        cum_home: e.cum_home != null ? parseFloat(Number(e.cum_home).toFixed(3)) : null,
        cum_away: e.cum_away != null ? parseFloat(Number(e.cum_away).toFixed(3)) : null,
      }))
      .filter(e => Number.isFinite(e.m));
    if (cleaned.length) m.live_xg_per_minute = cleaned;
  }

  // Shotmap individual shots (capped 50)
  if (Array.isArray(shotmapData.shotmap) && shotmapData.shotmap.length) {
    const cleaned = shotmapData.shotmap
      .filter(s => s && s.min != null && s.xg != null)
      .map(s => ({
        min: Number(s.min),
        home: !!s.home,
        type: s.type || 'miss',          // goal | save | miss | block
        xg: parseFloat(Number(s.xg).toFixed(4)),
        xgot: s.xgot != null ? parseFloat(Number(s.xgot).toFixed(4)) : null,
        gml: s.gml || null,              // position in goal (low-left, high-centre…)
        sit: s.sit || null,              // assisted | regular | set-piece | fast-break | free-kick
        body: s.body || null,            // right-foot | left-foot | head
        gtype: s.gtype || null,          // regular | own_goal | penalty
        player_id: s.player_id || null,
        pos: s.pos ? { x: Number(s.pos.x), y: Number(s.pos.y) } : null,
        added: s.added || null,
      }))
      .filter(s => Number.isFinite(s.min) && Number.isFinite(s.xg))
      .sort((a, b) => a.min - b.min)
      .slice(0, 50);
    if (cleaned.length) m.live_shotmap = cleaned;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POLL BSD LIVE ENRICHMENT — incidents + shotmap toutes les 30/60s
// ═══════════════════════════════════════════════════════════════════════════

const _bsdLiveEnrichState = new Map(); // matchId → { lastIncidents, lastShotmap, lastDetail }
const BSD_ENRICH_INCIDENTS_TTL = 30 * 1000;   // 30s
const BSD_ENRICH_SHOTMAP_TTL   = 60 * 1000;   // 60s — momentum/xG moins volatile

/**
 * Poll incidents + shotmap pour tous les matchs live BSD WS actifs.
 * Appeler depuis pollLiveScores() ou cron dédié.
 *
 * Dépend de : bsdFetch(), _bsdMergeIncidents(), _bsdMergeShotmap(), db.matches
 */
async function pollBSDLiveEnrichment() {
  // Cible : matchs live avec BSD event_id
  const targets = db.matches.filter(m =>
    m && m._bsd_event_id != null &&
    m.live_websocket &&
    (m.is_live || (m.live_score && m.live_score !== '0-0'))
  );
  if (!targets.length) return;

  const now = Date.now();

  for (const m of targets) {
    const eid = m._bsd_event_id;
    const st = _bsdLiveEnrichState.get(m.id) || {};

    // ── Incidents ────────────────────────────────────────────────────────
    if (!st.lastIncidents || (now - st.lastIncidents) > BSD_ENRICH_INCIDENTS_TTL) {
      try {
        const res = await bsdFetch(`/api/v2/events/${eid}/incidents/`, `bsd_incidents_${eid}`, BSD_ENRICH_INCIDENTS_TTL);
        if (res && res.status === 200 && Array.isArray(res.body && res.body.incidents)) {
          _bsdMergeIncidents(m, res.body.incidents);
          st.lastIncidents = now;
        } else if (res && res.status === 200 && Array.isArray(res.body)) {
          // Certaines versions BSD retournent un array direct
          _bsdMergeIncidents(m, res.body);
          st.lastIncidents = now;
        }
      } catch (e) {
        console.warn(`  [BSD-Enrich] incidents ${eid} erreur:`, e.message);
      }
    }

    // ── Shotmap (momentum + xG/min) ──────────────────────────────────────
    if (!st.lastShotmap || (now - st.lastShotmap) > BSD_ENRICH_SHOTMAP_TTL) {
      try {
        const res = await bsdFetch(`/api/v2/events/${eid}/shotmap/`, `bsd_shotmap_${eid}`, BSD_ENRICH_SHOTMAP_TTL);
        if (res && res.status === 200 && res.body) {
          _bsdMergeShotmap(m, res.body);
          st.lastShotmap = now;
        }
      } catch (e) {
        console.warn(`  [BSD-Enrich] shotmap ${eid} erreur:`, e.message);
      }
    }

    _bsdLiveEnrichState.set(m.id, st);
  }

  // Purge state matchs terminés (économie mémoire)
  for (const [id, _] of _bsdLiveEnrichState) {
    if (!db.matches.find(m => m && m.id === id)) {
      _bsdLiveEnrichState.delete(id);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH _bsdWsHandleJSON — remplacer le bloc `if (t === 'event')` par :
// ═══════════════════════════════════════════════════════════════════════════
/*
  // Frame event (~30s) → patch stats canoniques + broadcast SSE typé
  if (t === 'event') {
    const eid = msg.event_id;
    const m = _bsdWsLookupMatch(eid, msg.home && msg.home.name, msg.away && msg.away.name);
    if (!m) return;

    _bsdWsDTOEvent(msg, m, _checkLiveAlerts);  // ← remplace le bloc inline

    if (sseClients.size > 0) {
      broadcastSSE('ws_event', {
        id: m.id,
        event_id: eid,
        score: m.live_score || null,
        minute: m.live_minute || null,
        added_time: m.live_added_time || null,           // ← NOUVEAU
        status: m.status || null,
        period: m.live_period || null,
        live_possession: m.live_possession || null,
        live_shots: m.live_shots || null,
        live_shots_on_target: m.live_shots_on_target || null,
        live_corners: m.live_corners || null,
        live_xg: m.live_xg || null,
        live_big_chances: m.live_big_chances || null,
        live_saves: m.live_saves || null,                // ← NOUVEAU
        live_interceptions: m.live_interceptions || null, // ← NOUVEAU
        live_recoveries: m.live_recoveries || null,       // ← NOUVEAU
        live_aerial_duels: m.live_aerial_duels || null,   // ← NOUVEAU
        live_crosses: m.live_crosses || null,             // ← NOUVEAU
        live_woodwork: m.live_woodwork || null,           // ← NOUVEAU
        live_goals_prevented: m.live_goals_prevented || null, // ← NOUVEAU
        live_momentum: (Array.isArray(m.live_momentum) ? m.live_momentum : null),
        live_momentum_pct: m.live_momentum_pct || null,
        live_cards: m.live_cards || null,
        live_dangerous_attacks: m.live_dangerous_attacks || null,
        live_touches_opp_box: m.live_touches_opp_box || null,
      });
    }
    return;
  }
*/

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS / SUMMARY (pour référence intégration)
// ═══════════════════════════════════════════════════════════════════════════
/*
  Fonctions à ajouter dans server.js :
  ─────────────────────────────────────
  _WS_STATIC_FIELDS          (const Set)
  _wsGuardedPatch()           remplace mutations directes m.field = ...
  _bsdWsApplyEventStatsV2()  remplace _bsdWsApplyEventStats
  _bsdWsDTOEvent()            remplace bloc inline if (t === 'event')
  _bsdNormalizeIncident()     helper REST incidents
  _bsdMergeIncidents()        merge incidents dans m.live_incidents
  _bsdMergeShotmap()          merge shotmap → live_momentum + live_xg_per_minute
  _bsdLiveEnrichState         (Map)
  pollBSDLiveEnrichment()     appeler depuis pollLiveScores() toutes les 30s

  Champs live NOUVEAUX exposés sur le match object :
  ────────────────────────────────────────────────────
  live_added_time             number (temps additionnel courant)
  live_saves                  {home, away}
  live_interceptions          {home, away}
  live_recoveries             {home, away}
  live_aerial_duels           {home: {value,total,pct}, away: ...}
  live_ground_duels           {home: {value,total,pct}, away: ...}
  live_crosses                {home: {value,total,pct}, away: ...}
  live_long_balls             {home: {value,total,pct}, away: ...}
  live_dribbles               {home: {value,total,pct}, away: ...}
  live_tackles                {home, away}
  live_woodwork               {home, away}
  live_shots_outside_box      {home, away}
  live_big_chances_scored     {home, away}
  live_throw_ins              {home, away}
  live_clearances             {home, away}
  live_goal_kicks             {home, away}
  live_free_kicks             {home, away}
  live_dispossessed           {home, away}
  live_final_third_entries    {home, away}
  live_final_third_pct        {home, away}
  live_goals_prevented        {home, away}
  live_incidents              Incident[] (goals, cards, subs — from REST)
  live_momentum               [{m, v}] (timeline minute par minute — from shotmap REST)
  live_xg_per_minute          [{m, xg_home, xg_away, cum_home, cum_away}]
  live_shotmap                Shot[] (per-shot xG avec pos, body, gml)
*/
