// Probe 2 — capacités BSD pour fix corners: team param? ordering? next cursor?
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = env.BSD_API_KEY || process.env.BSD_API_KEY;
const BASE = (env.BSD_BASE_URL || 'https://sports.bzzoiro.com/api').replace(/\/$/, '');

async function bsd(endpoint) {
  const url = `${BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}tz=Europe/Paris`;
  const res = await fetch(url, { headers: { Authorization: `Token ${KEY}` } });
  let data = null; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

(async () => {
  // 1. Event 9099 detail → team ids
  const det = await bsd('/events/9099/');
  const h = det.data?.home_team_obj, a = det.data?.away_team_obj;
  console.log(`[9099] status=${det.status} home=${JSON.stringify({ id: h?.id, name: h?.name })} away=${JSON.stringify({ id: a?.id, name: a?.name })} league=${JSON.stringify(det.data?.league?.id || det.data?.league)}`);
  const engId = h?.name?.match(/England/i) ? h?.id : a?.id;
  const crId = h?.name?.match(/England/i) ? a?.id : h?.id;
  console.log(`englandId=${engId} costaRicaId=${crId}`);

  // 2. team= param support? (sans league)
  for (const [label, q] of [
    ['team-only', `/events/?team=${engId}&status=finished&page_size=15`],
    ['team-window', `/events/?team=${engId}&status=finished&date_from=2025-09-01&date_to=2026-06-11&page_size=15`],
  ]) {
    const r = await bsd(q);
    const rs = r.data?.results || [];
    const allEng = rs.length && rs.every(e => /england/i.test(e.home_team + ' ' + e.away_team));
    console.log(`\n[${label}] status=${r.status} count=${r.data?.count} page_len=${rs.length} all_england=${allEng}`);
    for (const e of rs.slice(0, 15)) {
      const hc = e.live_stats?.home?.corner_kicks, ac = e.live_stats?.away?.corner_kicks;
      console.log(`  ${e.id} ${String(e.event_date).slice(0, 10)} L${e.league?.id ?? e.league} ${e.home_team} vs ${e.away_team} [${e.status}] corners=${hc}-${ac}`);
    }
  }

  // 3. ordering= support?
  const r3 = await bsd(`/events/?date_from=2026-05-12&date_to=2026-06-11&league=31&status=finished&ordering=-event_date&page_size=5`);
  const rs3 = r3.data?.results || [];
  console.log(`\n[ordering=-event_date] status=${r3.status} first_dates=${rs3.map(e => String(e.event_date).slice(5, 10)).join(',')}`);

  // 4. next cursor shape
  const r4 = await bsd(`/events/?date_from=2026-05-12&date_to=2026-06-11&league=31&status=finished&page_size=50`);
  console.log(`\n[next-shape] next=${String(r4.data?.next).slice(0, 140)}`);
  // try following next verbatim path
  if (r4.data?.next) {
    const nextUrl = new URL(r4.data.next);
    const r5 = await fetch(r4.data.next.replace(/^http:/, 'https:'), { headers: { Authorization: `Token ${KEY}` } });
    const d5 = await r5.json().catch(() => null);
    const first5 = d5?.results?.[0];
    console.log(`[next-follow] status=${r5.status} first=${first5 ? String(first5.event_date).slice(0, 10) + ' ' + first5.home_team : '—'}`);
  }
})().catch(e => { console.error('PROBE2 FAIL:', e.message); process.exit(1); });
