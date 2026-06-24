/* ═══════════════════════════════════════════════════════════════
 * ParisScore — Player API endpoints for server.js
 * 
 * Paste these inside handleAPI() in server.js, after the existing
 * forecasts routes (around line 44820).
 *
 * Requires:
 *   - players table (see migration-players.sql)
 *   - sqldb variable already defined
 * ═══════════════════════════════════════════════════════════════ */

// ─── GET /api/v1/players/search?q=...&gender=ATP&limit=15 ───
if (pathname === '/api/v1/players/search' && req.method === 'GET') {
    try {
        var q = (query.q || '').trim().toLowerCase();
        var gender = query.gender || null; // 'ATP' | 'WTA' | null
        var limit = Math.min(parseInt(query.limit || '15', 10) || 15, 50);
        
        if (!q || q.length < 1) {
            return jsonResponse(res, 200, { results: [], count: 0, q: q });
        }
        
        var sql = "SELECT slug, name, gender, country, rank, points, photo_url, composite_score, l5, forecast_delta_pct FROM players WHERE (name LIKE ? OR country LIKE ? OR wikipedia_title LIKE ? OR slug LIKE ?)";
        var params = ['%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%'];
        if (gender) { sql += ' AND gender = ?'; params.push(gender); }
        sql += ' ORDER BY rank ASC LIMIT ?';
        params.push(limit);
        
        var rows = sqldb.prepare(sql).all(...params);
        var results = rows.map(function(r) {
            return {
                slug: r.slug, name: r.name, gender: r.gender,
                country: r.country, rank: r.rank, points: r.points,
                photoUrl: r.photo_url, compositeScore: r.composite_score,
                l5: r.l5, forecastDeltaPct: r.forecast_delta_pct
            };
        });
        
        return jsonResponse(res, 200, { results: results, count: results.length, q: q });
    } catch (e) {
        console.error('[Players:Search]', e.message);
        return jsonResponse(res, 500, { error: e.message });
    }
}

// ─── GET /api/v1/players/top10?surface=hard&gender=ATP ───
if (pathname === '/api/v1/players/top10' && req.method === 'GET') {
    try {
        var surface = query.surface || 'hard';
        var gender = query.gender || 'ATP';
        var validSurfaces = ['clay', 'grass', 'hard', 'indoor'];
        var validGenders = ['ATP', 'WTA'];
        if (!validSurfaces.includes(surface)) surface = 'hard';
        if (!validGenders.includes(gender)) gender = 'ATP';
        
        var rows = sqldb.prepare("SELECT * FROM players WHERE gender = ? ORDER BY rank ASC LIMIT 120").all(gender);
        
        var eloField = surface === 'clay' ? 'elo_clay' : surface === 'grass' ? 'elo_grass' : surface === 'indoor' ? 'elo_indoor' : 'elo_hard';
        
        var ranked = rows.map(function(r) {
            var surfaceElo = r[eloField] || 1500;
            var eloScore = Math.min(100, Math.max(0, (surfaceElo - 1500) / 5.5));
            var l5Score = (r.l5_win_rate || 0.5) * 100;
            var forecastScore = Math.min(100, Math.max(0, 50 + (r.forecast_delta_pct || 0) * 5));
            var h2hScore = (r.h2h_top10_win_rate || 0.5) * 100;
            var composite = eloScore * 0.4 + l5Score * 0.25 + forecastScore * 0.2 + h2hScore * 0.15;
            return {
                rank: 0, slug: r.slug, name: r.name, wikipediaTitle: r.wikipedia_title,
                country: r.country, officialRank: r.rank, points: r.points,
                photoUrl: r.photo_url, surfaceElo: surfaceElo,
                l5: r.l5, l5WinRate: r.l5_win_rate,
                forecastDeltaPct: r.forecast_delta_pct,
                h2hTop10WinRate: r.h2h_top10_win_rate,
                compositeScore: Math.round(composite * 10) / 10
            };
        }).sort(function(a, b) { return b.compositeScore - a.compositeScore; }).slice(0, 10);
        
        ranked.forEach(function(p, i) { p.rank = i + 1; });
        
        return jsonResponse(res, 200, { surface: surface, gender: gender, count: ranked.length, players: ranked });
    } catch (e) {
        console.error('[Players:Top10]', e.message);
        return jsonResponse(res, 500, { error: e.message });
    }
}

// ─── GET /api/v1/players/:slug ───
// Match /api/v1/players/ followed by a slug (not search or top10)
var playerMatch = pathname.match(/^\/api\/v1\/players\/([a-z0-9-]+)$/);
if (playerMatch && req.method === 'GET') {
    try {
        var slug = playerMatch[1];
        var row = sqldb.prepare("SELECT * FROM players WHERE slug = ?").get(slug);
        
        if (!row) {
            return jsonResponse(res, 404, { error: 'Player not found', slug: slug });
        }
        
        return jsonResponse(res, 200, {
            player: {
                slug: row.slug, name: row.name, wikipediaTitle: row.wikipedia_title,
                taId: row.ta_id, gender: row.gender, country: row.country,
                rank: row.rank, peakRank: row.peak_rank, points: row.points,
                photoUrl: row.photo_url,
                elo: row.elo, eloRank: row.elo_rank,
                eloHard: row.elo_hard, eloHardRank: row.elo_hard_rank,
                eloClay: row.elo_clay, eloClayRank: row.elo_clay_rank,
                eloGrass: row.elo_grass, eloGrassRank: row.elo_grass_rank,
                eloIndoor: row.elo_indoor,
                l5: row.l5, l5WinRate: row.l5_win_rate, l5DrTrend: row.l5_dr_trend,
                hard: { matches: row.hard_matches, winPct: row.hard_win_pct, dr: row.hard_dr, spw: row.hard_spw, rpw: row.hard_rpw, holdPct: row.hard_hold_pct, breakPct: row.hard_break_pct },
                clay: { matches: row.clay_matches, winPct: row.clay_win_pct, dr: row.clay_dr, spw: row.clay_spw, rpw: row.clay_rpw, holdPct: row.clay_hold_pct, breakPct: row.clay_break_pct },
                grass: { matches: row.grass_matches, winPct: row.grass_win_pct, dr: row.grass_dr, spw: row.grass_spw, rpw: row.grass_rpw, holdPct: row.grass_hold_pct, breakPct: row.grass_break_pct },
                forecast: { current: row.forecast_current, q50: row.forecast_q50, deltaPct: row.forecast_delta_pct },
                h2h: { top10WinRate: row.h2h_top10_win_rate, sample: row.h2h_top10_sample },
                compositeScore: row.composite_score,
                metricsSource: row.metrics_source,
                taScrapedAt: row.ta_scraped_at,
                updatedAt: row.updated_at
            }
        });
    } catch (e) {
        console.error('[Players:Profile]', e.message);
        return jsonResponse(res, 500, { error: e.message });
    }
}
