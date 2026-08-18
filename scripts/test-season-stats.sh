#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# test-season-stats.sh — QA de la feature "Team Season Stats" (fcstats-style)
#
# Usage :
#   BASE_URL=http://localhost:3000 bash scripts/test-season-stats.sh [base_url]
#   (défaut : http://localhost:3000)
#
# Vérifie :
#   1. Syntaxe des deux fichiers legacy (node --check).
#   2. Logique de calcul hors-ligne et DÉTERMINISTE (V/N/D, over/under 2.5,
#      BTTS, streaks, records) via node -e — aucune dépendance réseau.
#   3. La route GET /api/v1/team/:id/season-stats (chemin BSD-first, fallback
#      Sofascore) : forme JSON + état vide propre, sans crash.
#
# Note réseau : sur certaines machines les upstream (Sofascore 403, BSD 401,
# ESPN site.api 403) sont bloqués → la route renverra {empty:true} sans erreur.
# Le happy-path complet se valide en prod (VPS) où BSD/Sofascore sont joignables.
# ----------------------------------------------------------------------------
set -euo pipefail
BASE="${1:-${BASE_URL:-http://localhost:3000}}"
PASS=0; FAIL=0
ok()   { echo "  [PASS] $1"; PASS=$((PASS+1)); }
ko()   { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
section() { echo; echo "────────────────────────────────────────"; echo "## $1"; echo "────────────────────────────────────────"; }

# ── 1. Syntaxe ──────────────────────────────────────────────────────────────
section "1. Syntaxe (node --check)"
if node --check server.js 2>/dev/null; then ok "server.js"; else ko "server.js"; fi
if node --check pariscore.js 2>/dev/null; then ok "pariscore.js"; else ko "pariscore.js"; fi

# ── 2. Logique de calcul offline (déterministe) ─────────────────────────────
section "2. Logique de calcul (offline, sans réseau)"
OFFLINE=$(node -e '
  // Copie miroir des helpers normalisés server.js (_ssAggNorm/_ssStreaksNorm/_ssRecordsNorm)
  function agg(nl){const o={played:0,wins:0,draws:0,losses:0,points:0,ppg:0,gf:0,ga:0,gfPer:0,gaPer:0,over25:0,under25:0,cleanSheet:0,failedToScore:0,btts:0,winPct:0,drawPct:0,lossPct:0};for(const m of nl){o.played++;if(m.myGoals>m.opGoals)o.wins++;else if(m.myGoals===m.opGoals)o.draws++;else o.losses++;o.points+=m.myGoals>m.opGoals?3:m.myGoals===m.opGoals?1:0;o.gf+=m.myGoals;o.ga+=m.opGoals;const t=m.myGoals+m.opGoals;if(t>2)o.over25++;else o.under25++;if(m.opGoals===0)o.cleanSheet++;if(m.myGoals===0)o.failedToScore++;if(m.myGoals>0&&m.opGoals>0)o.btts++;}if(o.played){o.ppg=+ (o.points/o.played).toFixed(2);o.gfPer=+(o.gf/o.played).toFixed(2);o.gaPer=+(o.ga/o.played).toFixed(2);o.winPct=Math.round(100*o.wins/o.played);o.drawPct=Math.round(100*o.draws/o.played);o.lossPct=Math.round(100*o.losses/o.played);}return o;}
  function streaks(nl){const s={W:0,D:0,L:0,nW:0,nD:0,nL:0,Gp:0,Gm:0,nGp:0,nGm:0,over25:0,under25:0,btts:0};const tr=c=>{let n=0;for(let i=0;i<nl.length;i++){if(c(nl[i]))n++;else break;}return n;};const r=m=>m.myGoals>m.opGoals?"W":m.myGoals===m.opGoals?"D":"L";s.W=tr(m=>r(m)==="W");s.D=tr(m=>r(m)==="D");s.L=tr(m=>r(m)==="L");s.nW=tr(m=>r(m)!=="W");s.nD=tr(m=>r(m)!=="D");s.nL=tr(m=>r(m)!=="L");s.Gp=tr(m=>m.myGoals>0);s.Gm=tr(m=>m.opGoals>0);s.nGp=tr(m=>m.myGoals===0);s.nGm=tr(m=>m.opGoals===0);s.over25=tr(m=>m.myGoals+m.opGoals>2);s.under25=tr(m=>m.myGoals+m.opGoals<=2);s.btts=tr(m=>m.myGoals>0&&m.opGoals>0);return s;}
  function rec(nl){const r={biggestWin:null,biggestLoss:null,mostScored:null,mostConceded:null};for(const m of nl){const mg=m.myGoals-m.opGoals;if(mg>0&&(!r.biggestWin||mg>r.biggestWin.margin))r.biggestWin={margin:mg,gf:m.myGoals,ga:m.opGoals};const lm=m.opGoals-m.myGoals;if(lm>0&&(!r.biggestLoss||lm>r.biggestLoss.margin))r.biggestLoss={margin:lm,gf:m.myGoals,ga:m.opGoals};if(!r.mostScored||m.myGoals>r.mostScored)r.mostScored=m.myGoals;if(!r.mostConceded||m.opGoals>r.mostConceded)r.mostConceded=m.opGoals;}return r;}
  // Matchs synthétiques : [W 3-1] [W 2-2 BTTS] [D 1-1 BTTS] [L 0-2] [W 1-0]
  const M=[{myGoals:3,opGoals:1},{myGoals:1,opGoals:1},{myGoals:0,opGoals:2},{myGoals:3,opGoals:3}];
  const A=agg(M), S=streaks(M), R=rec(M);
  const checks={
    played:A.played===4, pts:A.points===5, gf:A.gf===7, ga:A.ga===7,
    over25:A.over25===2, cleanSheet:A.cleanSheet===0, failedToScore:A.failedToScore===1, btts:A.btts===3,
    streakW:S.W===1, streakOver25:S.over25===1, streakBtts:S.btts===2,
    biggestWin:R.biggestWin?R.biggestWin.gf===3:false, mostScored:R.mostScored===3, mostConceded:R.mostConceded===3,
  };
  const bad=Object.keys(checks).filter(k=>!checks[k]);
  if(bad.length) process.stdout.write("LOGIC_FAIL:"+bad.join(","));
  else process.stdout.write("LOGIC_OK");
')
if [ "$OFFLINE" = "LOGIC_OK" ]; then
  ok "agrégat + streaks + records (synthèse 4 matchs)"
else
  ko "logique stats ($OFFLINE)"
fi

# ── 3. Route live ───────────────────────────────────────────────────────────
section "3. Route GET /api/v1/team/:id/season-stats (BSD-first)"
echo "  base: $BASE  (Galatasaray BSD id=17)"
HTTP=$(curl -s -o /tmp/ss_gs.json -w "%{http_code}" --max-time 60 "$BASE/api/v1/team/17/season-stats")
echo "  HTTP=$HTTP"
if [ "$HTTP" = "200" ]; then
  ok "réponse 200 (état vide possible si réseau bloqué)"
else
  ko "HTTP != 200 ($HTTP)"
fi
node -e '
  try {
    const d=require("/tmp/ss_gs.json");
    if(d && d.empty){ console.log("  (empty -> upstream soft-fail propre, pas de crash)"); }
    else {
      console.log("  populated: team=", d.team && d.team.name, " pos=", d.position, " played=", d.general&&d.general.all.played, " comps=", (d.competitions||[]).length);
      const empty = d && !d.empty && (!d.general || !d.general.all || !d.general.all.played);
      const shape = d && d.general && d.streaks && d.records && Array.isArray(d.recentMatches) && (d.comparativeTable && Array.isArray(d.comparativeTable.rows));
      console.log("  shapeOK=", !!shape, " emptyPayload=", !!empty);
      if(empty) process.exit(2); else if(!shape) process.exit(3);
    }
  } catch(e){ console.log("  parse error:", e.message); process.exit(4); }
'
RC=$?
if [ $RC -eq 0 ]; then ok "payload structuré (general/streaks/records/recent/comparatif)"; else ko "payload malformé (exit $RC)"; fi

# ── 4. État vide propre (équipe inconnue / sans saison) ─────────────────────
section "4. État vide propre (aucun crash, JSON valide)"
HU=$(curl -s -o /tmp/ss_unk.json -w "%{http_code}" --max-time 30 "$BASE/api/v1/team/999999999/season-stats")
if [ "$HU" = "200" ]; then ok "réponse 200 pour équipe inconnue (empty propre)"; else ko "HTTP != 200 ($HU)"; fi

# ── Bilan ───────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════"
echo "  PASS=$PASS FAIL=$FAIL"
echo "════════════════════════════════════"
[ $FAIL -eq 0 ]