// tools/p-bets-generator.js
// Module de génération des 5 bets prédictifs P_BETS
// Fusion des métriques pré-match + analyse Gemini + fallback déterministe

const https = require('https');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _eloProb(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function _probToOdds(prob) {
  if (prob == null || prob <= 0) return '99.00';
  return (1 / Math.max(0.01, Math.min(0.99, prob))).toFixed(2);
}

function _clampProb(p) {
  return Math.max(0.01, Math.min(0.99, p));
}

// ─── Appel natif HTTPS Gemini (10s timeout) ───────────────────────────────────

function _callGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
    });

    const u = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`);
    const opts = {
      hostname: u.hostname, port: 443,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!text) return reject(new Error('Gemini empty response'));
          resolve(text);
        } catch (e) { reject(new Error('Gemini parse error')); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Gemini timeout (10s)')); });
    req.write(body);
    req.end();
  });
}

// ─── Parsing réponse Gemini ───────────────────────────────────────────────────

function _parseGeminiBets(rawText) {
  if (!rawText) return null;
  const text = rawText.trim();

  // Essai JSON direct
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr) && arr.length >= 3 && arr.every(b => b.type && b.cote != null)) {
      return arr.slice(0, 5);
    }
  } catch (_) { /* pas du JSON */ }

  // Essai extraction bloc JSON dans ``` ou ```json
  const jsonMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[1]);
      if (Array.isArray(arr) && arr.length >= 3) return arr.slice(0, 5);
    } catch (_) { /* malformé */ }
  }

  // Essai extraction ligne par ligne : "type: X, cote: Y, confidence: Z, analyse: ..."
  const lines = text.split('\n').filter(l => l.trim());
  const bets = [];
  for (const line of lines) {
    if (bets.length >= 5) break;
    const t = line.match(/type[:\s]+["']?([^"',;]+)/i);
    const c = line.match(/cote[:\s]+["']?([0-9.]+)/i);
    const cf = line.match(/confidence[:\s]+(\d+)/i);
    if (t && c) {
      bets.push({
        type: t[1].trim(),
        cote: parseFloat(c[1]).toFixed(2),
        confidence: cf ? Math.min(10, Math.max(1, parseInt(cf[1], 10))) : 5,
        analyse: ''
      });
    }
  }
  return bets.length >= 3 ? bets : null;
}

// ─── Récupération métriques DB ────────────────────────────────────────────────

function _getPlayerMetrics(playerName, tour, surface, db) {
  const out = { elo: null, eloSurface: null, sps: null, l5Pts: null, l10Pts: null, serveIndex: null, receiveIndex: null, matchesCount: 0 };

  try {
    const eloAll = db.prepare(
      `SELECT elo, matches_count FROM tennis_elo WHERE player_name = ? AND tour = ? AND surface = 'ALL'`
    ).get(playerName, tour);
    if (eloAll) { out.elo = eloAll.elo; out.matchesCount = eloAll.matches_count; }

    if (surface) {
      const eloS = db.prepare(
        `SELECT elo, matches_count FROM tennis_elo WHERE player_name = ? AND tour = ? AND surface = ?`
      ).get(playerName, tour, surface);
      if (eloS) out.eloSurface = eloS.elo;
    }
  } catch (_) { /* table tennis_elo absente */ }

  try {
    const pf = db.prepare(
      `SELECT l5_pts, l10_pts, powerscore, serve_index, receive_index
       FROM v_tennis_player_form
       WHERE player_name = ? AND tour = ? AND surface = ?
       ORDER BY computed_at DESC LIMIT 1`
    ).get(playerName, tour, surface || 'ALL');
    if (pf) {
      out.l5Pts = pf.l5_pts;
      out.l10Pts = pf.l10_pts;
      out.powerscore = pf.powerscore;
      out.serveIndex = pf.serve_index;
      out.receiveIndex = pf.receive_index;
    }
  } catch (_) { /* table v_tennis_player_form absente — on skip */ }

  // Fallback direct tennis_sps_weekly si dispo
  try {
    if (surface && out.powerscore == null) {
      const sps = db.prepare(
        `SELECT sps_score FROM tennis_sps_weekly
         WHERE player_name = ? AND tour = ? AND surface = ?
         ORDER BY week_tag DESC LIMIT 1`
      ).get(playerName, tour, surface);
      if (sps) out.powerscore = sps.sps_score;
    }
  } catch (_) {}

  return out;
}

function _getH2H(player1Name, player2Name, db) {
  try {
    const h2h = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN winner_name = ? THEN 1 ELSE 0 END) AS w1
      FROM tennis_matches_internal
      WHERE (winner_name = ? AND loser_name = ?)
         OR (winner_name = ? AND loser_name = ?)
    `).get(player1Name, player1Name, player2Name, player2Name, player1Name);
    if (h2h && h2h.total > 0) return { total: h2h.total, p1Wins: h2h.w1 || 0 };
  } catch (_) {}
  return null;
}

function _getForm(playerName, surface, db) {
  try {
    const rows = db.prepare(`
      SELECT winner_name, loser_name FROM tennis_matches_internal
      WHERE (winner_name = ? OR loser_name = ?) AND surface = ?
      ORDER BY tourney_date DESC LIMIT 5
    `).all(playerName, playerName, surface || '');
    return rows.map(r => (r.winner_name === playerName ? 'W' : 'L'));
  } catch (_) { return []; }
}

function _getOdds(fixtureId, db) {
  try {
    const odds = db.prepare(`
      SELECT home_odds, draw_odds, away_odds, over_odds, under_odds
      FROM closing_odds
      WHERE match_id = ? ORDER BY commence_time DESC LIMIT 1
    `).get(String(fixtureId));
    if (odds) return odds;
  } catch (_) {}
  return null;
}

// ─── Construction prompt Gemini ────────────────────────────────────────────────

function _buildPrompt(p1, p2, surface, tour, elo1, elo2, metrics1, metrics2, h2h, odds, form1, form2) {
  let h2hStr = '';
  if (h2h) h2hStr = `H2H: ${h2h.p1Wins}/${h2h.total} pour ${p1}.`;

  let form1Str = form1.length ? `Forme L5 ${p1}: ${form1.join('')}` : '';
  let form2Str = form2.length ? `Forme L5 ${p2}: ${form2.join('')}` : '';

  return `Tu es un analyste expert en paris tennis et journaliste sportif. Tu as acces a 5 revues de presse (L'Equipe, Tennis Magazine, Eurosport, The Athletic, ESPN) que tu synthetises. Analyse ce match et fournis EXACTEMENT 5 recommandations de paris.

Match: ${p1} vs ${p2}
Tournoi: ${tour || '?'} | Surface: ${surface || '?'}
Elo ${p1}: ${elo1 != null ? Math.round(elo1) : 'N/A'} | Elo ${p2}: ${elo2 != null ? Math.round(elo2) : 'N/A'}
Powerscore ${p1}: ${metrics1.powerscore != null ? metrics1.powerscore : 'N/A'}
Powerscore ${p2}: ${metrics2.powerscore != null ? metrics2.powerscore : 'N/A'}
Service ${p1}: ${metrics1.serveIndex != null ? metrics1.serveIndex : 'N/A'}
Reception ${p2}: ${metrics2.receiveIndex != null ? metrics2.receiveIndex : 'N/A'}
${h2hStr}
${form1Str}
${form2Str}
Cotes dispo: ${odds ? JSON.stringify(odds) : 'N/A'}

Réponds UNIQUEMENT avec un tableau JSON valide (sans markdown) de 5 objets avec les champs:
- type: string (ex: "1/N/2", "O/U 2.5", "Score Exact", "BTTS", "Combiné", "Handicap", "Nombre de sets", "Break", "1er set")
- cote: string (cote décimale estimée, ex: "1.85")
- confidence: number (1-10)
- analyse: string (courte analyse fusionnant les métriques fournies)

Exemple:
[{"type":"1/N/2","cote":"1.85","confidence":8,"analyse":"Elo supérieur + bonnes stats service sur cette surface"}]
`;
}

// ─── Fallback déterministe (5 bets) ───────────────────────────────────────────

function _generateFallbackBets(p1, p2, surface, elo1, elo2, metrics1, metrics2, h2h, odds) {
  const eloA = elo1 || 1500;
  const eloB = elo2 || 1500;
  const rawProb = _eloProb(eloA, eloB);
  const prob = _clampProb(rawProb);

  // Ajustement surface si eloSurface dispo
  let adjProb = prob;
  if (metrics1.eloSurface != null && metrics2.eloSurface != null) {
    const surfProb = _eloProb(metrics1.eloSurface, metrics2.eloSurface);
    adjProb = prob * 0.6 + surfProb * 0.4;
    adjProb = _clampProb(adjProb);
  }

  // Ajustement powerscore
  const ps1 = metrics1.powerscore;
  const ps2 = metrics2.powerscore;
  if (ps1 != null && ps2 != null) {
    const psRatio = ps1 / Math.max(0.1, ps1 + ps2);
    adjProb = adjProb * 0.7 + psRatio * 0.3;
    adjProb = _clampProb(adjProb);
  }

  const p1Odds = _probToOdds(adjProb);
  const p2Odds = _probToOdds(1 - adjProb);

  // O/U 2.5 : basé sur tendances service/réception
  const serveDom = (metrics1.serveIndex || 50) + (metrics2.receiveIndex || 50);
  const underProb = _clampProb(0.45 + (serveDom - 100) * 0.002);
  const overProb = 1 - underProb;

  // Score exact (estimation simplifiée)
  const setProb = adjProb > 0.6 ? 0.3 : 0.15;

  // BTTS = les deux gagnent des jeux
  const bttsProb = _clampProb(0.65 + (metrics2.serveIndex || 50) * 0.001);

  // Combiné
  const combProb = _clampProb(adjProb * 0.8 + 0.1);

  const bets = [
    { type: '1/N/2', cote: p1Odds, confidence: Math.round(6 + Math.abs(adjProb - 0.5) * 10), analyse: '' },
    { type: 'O/U 2.5', cote: serveDom > 105 ? '1.80' : '2.00', confidence: 7, analyse: '' },
    { type: 'Score Exact', cote: setProb > 0 ? _probToOdds(setProb) : '5.00', confidence: 5, analyse: '' },
    { type: 'BTTS', cote: bttsProb > 0.5 ? '1.85' : '2.10', confidence: 7, analyse: '' },
    { type: 'Combiné', cote: _probToOdds(combProb), confidence: 6, analyse: '' }
  ];

  // Remplir analyse
  const p1EloStr = elo1 != null ? `${Math.round(elo1)}` : 'N/A';
  const p2EloStr = elo2 != null ? `${Math.round(elo2)}` : 'N/A';
  const h2hStr = h2h ? `H2H: ${h2h.p1Wins}/${h2h.total}` : 'pas de H2H';

  bets[0].analyse = `${p1} (Elo ${p1EloStr}) vs ${p2} (Elo ${p2EloStr}), ${h2hStr}, surface ${surface || '?'}`;
  bets[1].analyse = `Basé sur indices service/réception (${Math.round(metrics1.serveIndex || 50)}/${Math.round(metrics2.receiveIndex || 50)})`;
  bets[2].analyse = `Probabilité estimée ~${Math.round(adjProb * 100)}% pour ${p1}`;
  bets[3].analyse = `Les deux joueurs devraient remporter au moins un jeu sur ${surface || 'cette surface'}`;
  bets[4].analyse = `Pari combiné joueur ${p1} + under games basé sur domination service`;

  // Ajouter risque et recommandé
  return bets.map(function(b, idx) {
    var c = b.confidence || 5;
    var risk;
    if (c >= 8) risk = 'FAIBLE';
    else if (c >= 6) risk = 'MODERE';
    else risk = 'ELEVE';
    return {
      type: b.type,
      cote: b.cote,
      confidence: b.confidence,
      analyse: b.analyse,
      risk: risk,
      recommended: idx === 0 && c >= 6
    };
  });
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

async function generatePBetsFromOrchestrator(fixtureId, db, bsdFetch, tennisCtx) {
    console.log(`[P-BETS] Génération bets pour fixture ${fixtureId}`);

    // 1 — Récupérer les infos match depuis la DB
    let p1Name = null, p2Name = null, surface = null, tour = null, matchDataFromDb = null;

    try {
        // Cherche dans matches (football générique)
        const m = db.prepare(`SELECT home_team, away_team, league, sport FROM matches WHERE id = ?`).get(String(fixtureId));
        if (m) {
            p1Name = m.home_team;
            p2Name = m.away_team;
            tour = m.league;
            matchDataFromDb = m;
        }
    } catch (_) { /* pas de table matches */ }

    // 2 — Fallback: chercher via bsdFetch si pas trouvé en DB (timeout 8s)
    if (!p1Name && typeof bsdFetch === 'function') {
        try {
            const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('bsdFetch timeout')), ms))]);
            const r = await withTimeout(bsdFetch(`/api/v2/matches/${encodeURIComponent(String(fixtureId))}/`));
            if (r && r.status === 200 && r.data) {
                const d = r.data;
                p1Name = d.home_team?.name || d.home_name || d.home || d.team1?.name;
                p2Name = d.away_team?.name || d.away_name || d.away || d.team2?.name;
                surface = d.surface || d.tournament?.surface;
                if (d.league || d.tournament?.name) tour = d.league || d.tournament.name;
            }
        } catch (e) {
            console.warn(`[P-BETS] bsdFetch échec pour ${fixtureId}: ${e.message}`);
        }
    }

    // 2b — Fallback tennisCtx passé par le endpoint (Top10 tennis)
    if (!p1Name && tennisCtx) {
        p1Name = tennisCtx.p1 || null;
        p2Name = tennisCtx.p2 || null;
        surface = tennisCtx.surface || null;
        tour = tennisCtx.tour || null;
    }

    if (!p1Name || !p2Name) {
        console.warn(`[P-BETS] Impossible de trouver les joueurs pour fixture ${fixtureId}`);
        return [];
    }

    // 3 — Récupérer les métriques
    // Essai détection tour tennis
    let tennisTour = tour;
    if (!tennisTour || (!/ATP|WTA|ITF|CHALLENGER|GRAND SLAM/i.test(tennisTour) && !surface)) {
        surface = null; // pas clairement du tennis
    }

    const metrics1 = tennisTour ? _getPlayerMetrics(p1Name, tennisTour, surface, db) : { elo: null, eloSurface: null, sps: null, l5Pts: null, l10Pts: null, serveIndex: null, receiveIndex: null, matchesCount: 0 };
    const metrics2 = tennisTour ? _getPlayerMetrics(p2Name, tennisTour, surface, db) : { elo: null, eloSurface: null, sps: null, l5Pts: null, l10Pts: null, serveIndex: null, receiveIndex: null, matchesCount: 0 };
    const h2h = tennisTour ? _getH2H(p1Name, p2Name, db) : null;
    const form1 = tennisTour ? _getForm(p1Name, surface, db) : [];
    const form2 = tennisTour ? _getForm(p2Name, surface, db) : [];
    const odds = _getOdds(fixtureId, db);

    // 4 — Appel Gemini si clé dispo
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        try {
            const prompt = _buildPrompt(p1Name, p2Name, surface, tennisTour, metrics1.elo, metrics2.elo, metrics1, metrics2, h2h, odds, form1, form2);
            const raw = await _callGemini(prompt, apiKey);
            const parsed = _parseGeminiBets(raw);
            if (parsed && parsed.length >= 3) {
                console.log(`[P-BETS] Gemini OK — ${parsed.length} bets générés`);
                // Ajouter analyse par défaut si manquante
                return parsed.map(b => ({
                    ...b,
                    cote: typeof b.cote === 'number' ? b.cote.toFixed(2) : String(b.cote),
                    analyse: b.analyse || `Analyse générée par IA pour ${p1Name} vs ${p2Name}`
                }));
            }
            console.warn(`[P-BETS] Parsing Gemini a retourné ${parsed ? parsed.length : 0} bets valides — fallback`);
        } catch (e) {
            console.warn(`[P-BETS] Gemini échec: ${e.message} — fallback`);
        }
    } else {
        console.log(`[P-BETS] Pas de GEMINI_API_KEY — fallback déterministe`);
    }

    // 5 — Fallback déterministe
    const fallback = _generateFallbackBets(p1Name, p2Name, surface, metrics1.elo, metrics2.elo, metrics1, metrics2, h2h, odds);

    return fallback;
}

module.exports = { generatePBetsFromOrchestrator };
