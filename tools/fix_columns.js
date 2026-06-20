const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldCode = content.slice(
  content.indexOf('  // ─── TIMESFM FORECASTS'),
  content.indexOf('  // Fallback API interne\n  return jsonResponse(res, 404, { error: \'Route inconnue: \' + pathname });\n}')
);

const newCode =   // ─── TIMESFM FORECASTS ───────────────────────────────────────────
  if (pathname === '/api/v1/forecasts/tennis' && req.method === 'GET') {
    try {
      const rows = sqldb.prepare("SELECT entity_label, context, forecast_raw, input_tail, forecast_ts FROM timesfm_forecasts WHERE sport = 'tennis' ORDER BY forecast_ts DESC").all() || [];
      const list = rows.map(r => ({
        player: r.entity_label, surface: r.context || 'ALL',
        forecast_raw: JSON.parse(r.forecast_raw),
        input_tail: JSON.parse(r.input_tail || '[]'),
        generated_at: r.forecast_ts,
      }));
      for (const row of list) {
        if (Array.isArray(row.forecast_raw) && row.forecast_raw.length === 2) {
          row.point = row.forecast_raw[0];
          row.quantiles = row.forecast_raw[1];
          row.q50 = row.quantiles?.[5] ?? null;
        }
      }
      let filtered = list;
      if (query.player) { const p = query.player.toLowerCase(); filtered = filtered.filter(r => r.player.toLowerCase().includes(p)); }
      if (query.surface) { const s = query.surface.toLowerCase(); filtered = filtered.filter(r => r.surface?.toLowerCase() === s); }
      return jsonResponse(res, 200, { sport: 'tennis', count: filtered.length, forecasts: filtered });
    } catch (e) { console.error('[TimesFM] Erreur route tennis:', e.message); return jsonResponse(res, 500, { error: e.message }); }
  }

  if (pathname === '/api/v1/forecasts/tennis/trending' && req.method === 'GET') {
    try {
      const rows = sqldb.prepare("SELECT entity_label, context, forecast_raw, input_tail, forecast_ts FROM timesfm_forecasts WHERE sport = 'tennis' ORDER BY forecast_ts DESC").all() || [];
      const trends = [];
      for (const r of rows) {
        const f = JSON.parse(r.forecast_raw);
        if (!Array.isArray(f) || f.length < 2) continue;
        const point = f[0]; if (!Array.isArray(point) || point.length < 2) continue;
        const tail = JSON.parse(r.input_tail || '[]');
        const lastTail = Array.isArray(tail) && tail.length > 0 ? tail[tail.length - 1] : null;
        const trend = lastTail ? ((point[point.length - 1] - lastTail) / lastTail * 100) : null;
        const volatility = point.reduce((acc, v, i) => { if (i > 0) acc += Math.abs(v - point[i - 1]); return acc; }, 0) / point.length;
        const quantiles = f[1]; const q50 = quantiles?.[5] ?? null;
        const upper = quantiles?.[9] ?? null; const lower = quantiles?.[1] ?? null;
        const uncertainty = (upper && lower) ? (upper - lower) : null;
        trends.push({ player: r.entity_label, surface: r.context || 'ALL', last_value: lastTail, forecast_final: point[point.length - 1], trend_pct: trend ? Math.round(trend * 10) / 10 : null, volatility: Math.round(volatility * 1000) / 1000, q50, uncertainty, generated_at: r.forecast_ts });
      }
      const risers = trends.filter(t => t.trend_pct !== null).sort((a, b) => (b.trend_pct || 0) - (a.trend_pct || 0));
      const decliners = trends.filter(t => t.trend_pct !== null).sort((a, b) => (a.trend_pct || 0) - (b.trend_pct || 0));
      const limit = Math.min(parseInt(query.limit || '10', 10) || 10, trends.length);
      return jsonResponse(res, 200, { sport: 'tennis', risers: risers.slice(0, limit), decliners: decliners.slice(0, limit), count: trends.length });
    } catch (e) { console.error('[TimesFM] Erreur route tennis/trending:', e.message); return jsonResponse(res, 500, { error: e.message }); }
  }

  if (pathname === '/api/v1/forecasts/football' && req.method === 'GET') {
    try {
      const rows = sqldb.prepare("SELECT entity_label, context, forecast_raw, input_tail, forecast_ts FROM timesfm_forecasts WHERE sport = 'football' ORDER BY forecast_ts DESC").all() || [];
      const list = rows.map(r => ({
        team: r.entity_label, metric: r.context || 'xG',
        forecast_raw: JSON.parse(r.forecast_raw),
        input_tail: JSON.parse(r.input_tail || '[]'),
        generated_at: r.forecast_ts,
      }));
      for (const row of list) {
        if (Array.isArray(row.forecast_raw) && row.forecast_raw.length === 2) {
          row.point = row.forecast_raw[0];
          row.quantiles = row.forecast_raw[1];
          row.q50 = row.quantiles?.[5] ?? null;
        }
      }
      if (query.team) { const t = query.team.toLowerCase(); list = list.filter(r => r.team.toLowerCase().includes(t)); }
      return jsonResponse(res, 200, { sport: 'football', count: list.length, forecasts: list });
    } catch (e) { console.error('[TimesFM] Erreur route football:', e.message); return jsonResponse(res, 500, { error: e.message }); }
  }

  if (pathname === '/api/v1/forecasts/football/trending' && req.method === 'GET') {
    try {
      const rows = sqldb.prepare("SELECT entity_label, context, forecast_raw, input_tail, forecast_ts FROM timesfm_forecasts WHERE sport = 'football' ORDER BY forecast_ts DESC").all() || [];
      const trends = [];
      for (const r of rows) {
        const f = JSON.parse(r.forecast_raw);
        if (!Array.isArray(f) || f.length < 2) continue;
        const point = f[0]; if (!Array.isArray(point) || point.length < 2) continue;
        const tail = JSON.parse(r.input_tail || '[]');
        const lastTail = Array.isArray(tail) && tail.length > 0 ? tail[tail.length - 1] : null;
        const trend = lastTail ? ((point[point.length - 1] - lastTail) / lastTail * 100) : null;
        const quantiles = f[1]; const q50 = quantiles?.[5] ?? null;
        const upper = quantiles?.[9] ?? null; const lower = quantiles?.[1] ?? null;
        const uncertainty = (upper && lower) ? (upper - lower) : null;
        trends.push({ team: r.entity_label, metric: r.context || 'xG', last_value: lastTail, forecast_final: point[point.length - 1], trend_pct: trend ? Math.round(trend * 10) / 10 : null, q50, uncertainty, generated_at: r.forecast_ts });
      }
      const risers = trends.filter(t => t.trend_pct !== null).sort((a, b) => (b.trend_pct || 0) - (a.trend_pct || 0));
      const decliners = trends.filter(t => t.trend_pct !== null).sort((a, b) => (a.trend_pct || 0) - (b.trend_pct || 0));
      const limit = Math.min(parseInt(query.limit || '10', 10) || 10, trends.length);
      return jsonResponse(res, 200, { sport: 'football', risers: risers.slice(0, limit), decliners: decliners.slice(0, limit), count: trends.length });
    } catch (e) { console.error('[TimesFM] Erreur route football/trending:', e.message); return jsonResponse(res, 500, { error: e.message }); }
  }
;

content = content.replace(oldCode, newCode);
fs.writeFileSync('server.js', content, 'utf8');
console.log('Replaced. oldCode length:', oldCode.length, 'newCode length:', newCode.length);
console.log('player_name remaining:', (content.match(/player_name/g) || []).length);
console.log('entity_label count:', (content.match(/entity_label/g) || []).length);
