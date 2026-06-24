/**
 * ═══════════════════════════════════════════════════════════════
 *  P_BETS v2 Generator — VPS Backend
 *  Called by server.js: require('./tools/p-bets-generator')
 *
 *  5-expert brainstorm engine:
 *    1. Sports Betting Expert  — bet types, odds, risk classification
 *    2. Data Scientist          — ELO→prob, confidence intervals, edge
 *    3. Journalist              — narrative, context, storytelling
 *    4. Communication Director  — clear CTA, hierarchy, trust signals
 *    5. UI Designer             — structured output for card rendering
 *
 *  Exports: generatePBetsFromOrchestrator(fixtureId, sqldb, bsdFetch, tennisCtx)
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function eloToProb(eloA, eloB) { return 1 / (1 + Math.pow(10, -(eloA - eloB) / 400)); }

function classifyRisk(prob, confidence) {
  if (prob >= 0.65 && confidence >= 7) return 'SÛR';
  if (prob >= 0.50 && confidence >= 6) return 'MODÉRÉ';
  if (prob >= 0.40 && confidence >= 5) return 'INTÉRESSANT';
  if (prob >= 0.30) return 'VALEUR';
  return 'SPÉCULATIF';
}

function analyzeForm(l5) {
  if (!l5) return { winRate: 0.5, momentum: 0 };
  var wins = (l5.match(/W/g) || []).length;
  var total = l5.length;
  var winRate = total > 0 ? wins / total : 0.5;
  var momentum = 0;
  for (var i = 0; i < l5.length; i++) { momentum += l5[i] === 'W' ? (i + 1) / total : 0; }
  return { winRate: winRate, momentum: momentum };
}

function generateNarrative(p1, p2, surface) {
  var elo1 = Number(p1.elo) || 1500, elo2 = Number(p2.elo) || 1500;
  var form1 = analyzeForm(p1.l5), form2 = analyzeForm(p2.l5);
  var fav = elo1 >= elo2 ? p1.name : p2.name;
  var favForm = elo1 >= elo2 ? form1 : form2;
  var diff = Math.abs(elo1 - elo2);
  if (diff > 100) {
    return fav + ', net favori (ELO ' + Math.max(elo1, elo2) + ' vs ' + Math.min(elo1, elo2) + '), aborde ce match sur ' + surface + ' avec ' + Math.round(favForm.winRate * 100) + '% de victoires sur ses 5 derniers. Son adversaire devra produire une performance exceptionnelle.';
  }
  return 'Match très ouvert entre ' + (p1.name || 'J1') + ' et ' + (p2.name || 'J2') + ' sur ' + surface + '. Écart ELO minimal (' + diff + ' pts). Forme récente et stats de service seront déterminantes.';
}

function generateBets(p1, p2, surface) {
  var elo1 = Number(p1.elo) || 1500, elo2 = Number(p2.elo) || 1500;
  var form1 = analyzeForm(p1.l5), form2 = analyzeForm(p2.l5);
  var sf1 = (p1.surfaceWinPct || 50), sf2 = (p2.surfaceWinPct || 50);
  var sfAvg = (sf1 + sf2) / 2;

  var bp = eloToProb(elo1, elo2);
  bp *= sf1 / sfAvg;
  bp += (form1.winRate - form2.winRate) * 0.15 + (form1.momentum - form2.momentum) * 0.06;
  bp = clamp(bp, 0.15, 0.85);
  var bp2 = 1 - bp;

  var n1 = p1.name || 'Joueur 1', n2 = p2.name || 'Joueur 2';
  var avgH = ((p1.holdPct || 82) + (p2.holdPct || 82)) / 2;
  var avgB = 100 - avgH;
  var expSets = (bp > 0.7 || bp2 > 0.7) ? 3 : ((bp > 0.55 || bp2 > 0.55) ? 3.5 : 4);
  var gps = 9.5 + (avgB / 100) * 3;
  var expG = Math.round(expSets * gps);
  var expBrk = Math.round(expSets * 4 * (avgB / 100) * 1.8);

  var fP = Math.max(bp, bp2), fN = bp >= bp2 ? n1 : n2, dN = bp >= bp2 ? n2 : n1;
  var fE = Math.max(elo1, elo2), dE = Math.min(elo1, elo2);
  var wO = Math.round((1 / fP) * 100) / 100, wC = clamp(fP * 10 + 1.5, 4, 9.5), wE = ((fP * wO) - 1) * 100;

  var oL = expG - 2, oP = clamp(0.55 - (avgH - 82) * 0.01, 0.35, 0.65);
  var oO = Math.round((1 / oP) * 100) / 100, oC = clamp(oP * 8 + 1, 4, 8), oE = ((oP * oO) - 1) * 100;

  var domP = clamp(Math.max(bp, bp2) - 0.1, 0.25, 0.6), domN = bp > bp2 ? n1 : n2, wkN = bp > bp2 ? n2 : n1;
  var hO = Math.round((1 / domP) * 100) / 100, hC = clamp(domP * 8 + 1.5, 4, 8.5), hE = ((domP * hO) - 1) * 100;

  var brP = clamp(0.48 + (avgB - 18) * 0.02, 0.3, 0.7), brL = Math.max(3, expBrk - 1);
  var brO = Math.round((1 / brP) * 100) / 100, brC = clamp(brP * 7 + 1, 3.5, 8), brE = ((brP * brO) - 1) * 100;

  var coP = clamp(fP * (1 - oP + 0.15) * 0.85, 0.12, 0.45);
  var coO = Math.round((1 / coP) * 100) / 100, coC = clamp(coP * 6 + 2, 3, 7.5), coE = ((coP * coO) - 1) * 100;

  var bets = [
    { type:'VICTOIRE', designation:'Victoire '+fN, odds:wO, probability_pct:Math.round(fP*100), confidence:Math.round(wC*10)/10, edge_pct:Math.round(wE*10)/10, risk:classifyRisk(fP,wC), recommended:true, sources:['ELO','FORME','SURFACE'], rationale:fN+' possède un avantage ELO significatif ('+fE+' vs '+dE+') combiné à une meilleure forme récente. Sur '+surface+', le différentiel de conservation de service confirme cette domination attendue.' },
    { type:'OVER', designation:'Over '+oL+'.5 jeux', odds:oO, probability_pct:Math.round(oP*100), confidence:Math.round(oC*10)/10, edge_pct:Math.round(oE*10)/10, risk:classifyRisk(oP,oC), recommended:false, sources:['HOLD%','ELO','SURFACE'], rationale:'Avec un taux de conservation moyen de '+avgH.toFixed(0)+'%, les deux joueurs conservent fréquemment leur service, poussant le total de jeux au-dessus de la ligne.' },
    { type:'HANDICAP', designation:domN+' -1.5 set', odds:hO, probability_pct:Math.round(domP*100), confidence:Math.round(hC*10)/10, edge_pct:Math.round(hE*10)/10, risk:classifyRisk(domP,hC), recommended:false, sources:['ELO','FORME','DYNAMIQUE'], rationale:"L'écart ELO et la dynamique de forme favorisent "+domN+" pour remporter en 3 sets. "+wkN+" pourrait résister ponctuellement mais manque de régularité sur les points clés." },
    { type:'BREAK', designation:'Over '+brL+'.5 breaks', odds:brO, probability_pct:Math.round(brP*100), confidence:Math.round(brC*10)/10, edge_pct:Math.round(brE*10)/10, risk:classifyRisk(brP,brC), recommended:false, sources:['HOLD%','SURFACE','ELO'], rationale:'Taux de break de '+avgB.toFixed(0)+'% par joueur sur '+surface+' implique ~'+expBrk+' breaks. La proximité ELO garantit des jeux de retour serrés.' },
    { type:'COMBO', designation:fN+' + Under '+(oL+4)+'.5 jeux', odds:coO, probability_pct:Math.round(coP*100), confidence:Math.round(coC*10)/10, edge_pct:Math.round(coE*10)/10, risk:classifyRisk(coP,coC), recommended:false, sources:['ELO','HOLD%','FORME'], rationale:'Combinaison victoire de '+fN+' avec un match plus court. Si le favori domine dès le début, les sets pourraient se conclure rapidement (6-4, 6-3).' }
  ];
  bets.sort(function(a,b){ return (b.confidence-a.confidence)||(b.probability_pct-a.probability_pct); });
  bets.forEach(function(b,i){ b.recommended = i===0; });
  return bets;
}

function enrichFromDB(target, row, surface) {
  var s = (surface||'').toLowerCase();
  var elo = row.elo||1500, surfW=null, hold=null;
  if (s.includes('terre')||s.includes('clay')) { elo=row.elo_clay||elo; surfW=row.clay_win_pct; hold=row.clay_hold_pct; }
  else if (s.includes('gazon')||s.includes('grass')) { elo=row.elo_grass||elo; surfW=row.grass_win_pct; hold=row.grass_hold_pct; }
  else { elo=row.elo_hard||elo; surfW=row.hard_win_pct; hold=row.hard_hold_pct; }
  return { name:target.name||row.name, country_code:target.country_code||row.country_code||null, rank:target.rank||row.rank||null, points:target.points||row.points||null, elo:elo, l5:target.l5||row.l5||null, surfaceWinPct:surfW?Math.round(surfW*100):(target.surfaceWinPct||null), holdPct:hold?Math.round(hold*100):(target.holdPct||null) };
}

async function generatePBetsFromOrchestrator(fixtureId, sqldb, bsdFetch, tennisCtx) {
  var p1={}, p2={}, surface='Dur', tournament='Tournoi ATP', round='8e de finale';

  if (tennisCtx && tennisCtx.p1 && tennisCtx.p2) {
    p1.name = tennisCtx.p1; p2.name = tennisCtx.p2;
    surface = tennisCtx.surface || surface;
    tournament = tennisCtx.tour ? tennisCtx.tour+' Tour' : tournament;
  }

  if (sqldb) {
    try {
      var players = sqldb.prepare('SELECT slug,name,gender,country,country_code,rank,points,elo,l5,l5_win_rate,hard_win_pct,clay_win_pct,grass_win_pct,hard_hold_pct,clay_hold_pct,grass_hold_pct,elo_hard,elo_clay,elo_grass FROM tennis_players_live ORDER BY rank IS NULL,rank ASC LIMIT 20').all();
      if (players && players.length >= 2) {
        if (p1.name && p2.name) {
          var p1n=p1.name.toLowerCase(), p2n=p2.name.toLowerCase();
          for (var i=0;i<players.length;i++) {
            var pl=players[i], pln=pl.name.toLowerCase();
            if (pln.includes(p1n)||p1n.includes(pln)) p1=enrichFromDB(p1,pl,surface);
            if (pln.includes(p2n)||p2n.includes(pln)) p2=enrichFromDB(p2,pl,surface);
          }
        }
        if (!p1.elo && players.length>=2) { p1=enrichFromDB(p1,players[0],surface); p2=enrichFromDB(p2,players[1],surface); }
      }
    } catch(e) { console.warn('[p-bets-generator] DB error:', e.message); }
  }

  if (!p1.elo) p1.elo=1500; if (!p2.elo) p2.elo=1500;
  if (!p1.holdPct) p1.holdPct=82; if (!p2.holdPct) p2.holdPct=82;
  if (!p1.l5) p1.l5='WLWLW'; if (!p2.l5) p2.l5='LWLWL';
  if (!p1.surfaceWinPct) p1.surfaceWinPct=55; if (!p2.surfaceWinPct) p2.surfaceWinPct=55;

  var bets = generateBets(p1, p2, surface);
  var matchCtx = {
    p1: { name:p1.name, country_code:p1.country_code, rank:p1.rank, points:p1.points, elo:p1.elo, l5:p1.l5, surfaceWinPct:p1.surfaceWinPct, holdPct:p1.holdPct },
    p2: { name:p2.name, country_code:p2.country_code, rank:p2.rank, points:p2.points, elo:p2.elo, l5:p2.l5, surfaceWinPct:p2.surfaceWinPct, holdPct:p2.holdPct },
    tournament:tournament, round:round, surface:surface,
    narrative: generateNarrative(p1, p2, surface)
  };

  // Return v2 format with match context
  return { match: matchCtx, bets: bets };
}

module.exports = { generatePBetsFromOrchestrator: generatePBetsFromOrchestrator };