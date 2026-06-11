# Pulsante Statistiche — PariScore

## Panoramica

PariScore integra **quattro livelli** di pulsanti/display statistici. Ogni livello serve un contesto diverso: hero page, barra piattaforma, dashboard live, tennis live.

Documentazione completa del pulsante 📊 STATS e di tutti i sistemi statistici di PariScore.

---

## 1. Hero Stats (Home Page)

Posizionato nella sezione hero della home page. Mostra 3 KPI macro di credibilità sociale.

**Codice HTML:**
```html
<div class="hero-stats">
  <div>
    <div class="hero-stat-num">+14.2%</div>
    <div class="hero-stat-label">ROI medio Pro (30g)</div>
  </div>
  <div>
    <div class="hero-stat-num">2M+</div>
    <div class="hero-stat-label">Alerti inviati</div>
  </div>
  <div>
    <div class="hero-stat-num">12 k+</div>
    <div class="hero-stat-label">Scommettitori attivi</div>
  </div>
</div>
```

**CSS:**
```css
.hero-stats {
  display: flex; gap: 32px; margin-top: 40px;
  padding-top: 32px; border-top: 1px solid var(--border);
}
.hero-stat-num {
  font-family: var(--font-head); font-size: 26px; font-weight: 800; color: var(--text);
}
.hero-stat-label { font-size: 12px; color: var(--text3); margin-top: 2px; }
```

**Statistiche:** ROI medio, alerti inviati, scommettitori attivi.

---

## 2. Stats Bar — Piattaforma

Barra orizzontale sotto l'hero. Mostra la capacità operativa di PariScore.

**Codice HTML:**
```html
<div class="stats-bar">
  <div class="stats-bar-inner">
    <div class="stat-item">
      <div class="stat-num">3 200<span>+</span></div>
      <div class="stat-lbl">Lega coperte</div>
    </div>
    <div class="stat-item">
      <div class="stat-num">20<span>+</span></div>
      <div class="stat-lbl">Bookmaker seguiti</div>
    </div>
    <div class="stat-item">
      <div class="stat-num">50<span>k+</span></div>
      <div class="stat-lbl">Partite analizzate/anno</div>
    </div>
    <div class="stat-item">
      <div class="stat-num">47</div>
      <div class="stat-lbl">Alerti oggi</div>
    </div>
  </div>
</div>
```

**Statistiche:** leghe coperte, bookmaker seguiti, partite analizzate/anno, alert oggi.

---

## 3. Statistiche Live — Calcio

Pannello `live-stats-panel` nel dashboard live. Aggiornato in tempo reale via WebSocket (~30s).

**Statistiche disponibili:**

| Chiave | Etichetta | Calcolo |
|--------|-----------|---------|
| `possession` | Possesso | `pos.home / (pos.home + pos.away) * 100`% |
| `da` | Attacchi Pericolosi | `da.home` vs `da.away` |
| `shots` | Tiri | `sh.home` vs `sh.away` |
| `sot` | Tiri in porta | `sot.home` vs `sot.away` |
| `corners` | Calci d'angolo | `co.home` vs `co.away` |
| `xg` | xG | `live_xg.home` vs `live_xg.away` (formattato 2 decimali) |
| `cards` | Cartellini | `(gialli + rossi*2)` per squadra |
| `passes` | Passaggi | valore assoluto (se >99 → centinaia) |
| `pass_accuracy` | Precisione passaggi | `%` |
| `dangerous_attacks` | Attacchi pericolosi | valore assoluto |

**Codice raccolta statistiche:**
```javascript
function _renderStatsFlash(m) {
  var el = document.getElementById('ld-stats-body');
  if (!el) return;
  var ls = m.live_stats||{}, pos=m.live_possession||{}, sh=m.live_shots||{};
  var sot=m.live_shots_on_target||{}, co=m.live_corners||{}, da=m.live_dangerous_attacks||{};
  var stats=[
    {key:'possession', label:'Possesso', h:pos.home||ls.possessionHome||50, a:pos.away||ls.possessionAway||50, unit:'%', pct:true},
    {key:'da',         label:'Att. Peric.', h:da.home||ls.dangerousAttacksHome||0, a:da.away||ls.dangerousAttacksAway||0},
    {key:'shots',      label:'Tiri',       h:sh.home||0, a:sh.away||0},
    {key:'sot',        label:'In porta',   h:sot.home||ls.shotsOnTargetHome||0, a:sot.away||ls.shotsOnTargetAway||0},
    {key:'corners',    label:'Angoli',     h:co.home||0, a:co.away||0},
  ];
  // Primo rendering
  if (!el.querySelector('[data-stat]')) {
    el.innerHTML = stats.map(function(s) {
      var tot = s.pct ? 100 : Math.max(s.h+s.a, 1);
      var hPct = Math.round(s.h/tot*100);
      return '<div class="ld-stat-row" data-stat="'+s.key+'">'
        +'<div><div class="ld-stat-val-h" data-vh>'+s.h+(s.unit||'')+'</div>'
        +'<div class="ld-stat-bar-h"><div class="ld-stat-bar-h-fill" data-bh style="width:'+hPct+'%;"></div></div></div>'
        +'<div class="ld-stat-label">'+s.label+'</div>'
        +'<div style="text-align:right;"><div class="ld-stat-val-a" data-va>'+s.a+(s.unit||'')+'</div>'
        +'<div class="ld-stat-bar-a"><div class="ld-stat-bar-a-fill" data-ba style="width:'+(100-hPct)+'%;"></div></div></div>'
        +'</div>';
    }).join('');
    return;
  }
  // Aggiornamenti in-place
  stats.forEach(function(s) {
    var row = el.querySelector('[data-stat="'+s.key+'"]');
    if (!row) return;
    var tot = s.pct ? 100 : Math.max(s.h+s.a, 1);
    var hPct = Math.round(s.h/tot*100);
    row.querySelector('[data-vh]').textContent = s.h+(s.unit||'');
    row.querySelector('[data-bh]').style.width = hPct+'%';
    row.querySelector('[data-va]').textContent = s.a+(s.unit||'');
    row.querySelector('[data-ba]').style.width = (100-hPct)+'%';
  });
}
```

---

## 4. Pulsante Statistiche Tennis (Live) — 📊 STATS

Il pulsante `📊 STATS` appare su ogni partita tennis in diretta.

**Codice HTML del pulsante:**
```html
<button class="tn-stats-btn"
  onclick="event.stopPropagation();_tnToggleLiveStats('${matchId}')"
  title="Statistiche live dettagliate">
  📊 STATS
</button>
```

**CSS:**
```css
.tn-stats-btn {
  font-size:9px; padding:2px 5px;
  background:rgba(41,182,246,0.12); color:var(--blue,#29b6f6);
  border:1px solid rgba(41,182,246,0.28); border-radius:3px;
  cursor:pointer; line-height:1.5; white-space:nowrap;
}
.tn-stats-btn:hover { background:rgba(41,182,246,0.22); }
.tn-stats-btn.active { background:rgba(41,182,246,0.22); border-color:rgba(41,182,246,0.6); }
```

**Toggle JavaScript:**
```javascript
function _tnToggleLiveStats(matchId) {
  const panel = document.getElementById('tnlsp-' + matchId);
  if (!panel) return;
  const btn = document.querySelector(`.tn-live-row[data-tennis-id="..."] .tn-stats-btn`);
  if (!panel.hidden) {
    panel.hidden = true;
    if (btn) btn.classList.remove('active');
    return;
  }
  if (panel.dataset.rendered !== String(matchId)) {
    const m = (window._tennisLastFetch || []).find(x => String(x.id) === String(matchId));
    if (!m) return;
    panel.innerHTML = _tnRenderLiveStatsTable(m);
    panel.dataset.rendered = String(matchId);
  }
  panel.hidden = false;
  if (btn) btn.classList.add('active');
}
```

**Statistiche Tennis Mostrate:**
```javascript
const rows = [
  row('Aces',                    s.p1_aces,       s.p2_aces,      true),       // alto = meglio
  row('Doppi falli',             s.p1_df,         s.p2_df,        false),      // basso = meglio
  row('% 1° servizio',          s.p1_first_pct,  s.p2_first_pct, true, '%'),
  row('% punti vinti 1° srv',   s.p1_first_won,  s.p2_first_won, true, '%'),
  row('Break salvati',           s.p1_bp_saved,   s.p2_bp_saved,  true),
  row('% punti vinti in risp.',  s.p1_ret_won,    s.p2_ret_won,   true, '%'),
  row('% punti vinti totali',    s.p1_total_pts,  s.p2_total_pts, true, '%'),
];
```

**Helper row():**
```javascript
const row = (label, v1, v2, hib, sfx) => {
  const n1 = Number(v1)||0, n2 = Number(v2)||0, tie = n1===n2;
  const p1w = tie ? false : (hib ? n1>n2 : n1<n2); // hib=true → alto=vince
  const p2w = tie ? false : !p1w;
  const c1 = tie?'':(p1w?'tn-sv':'tn-sv-lo');      // verde=buono, rosso=cattivo
  const d1 = v1!=null ? String(v1)+(sfx||'') : '—';
  const d2 = v2!=null ? String(v2)+(sfx||'') : '—';
  return `<tr><td class="${c1}">${d1}</td>
    <td class="slbl">${label}</td>
    <td class="${c2}">${d2}</td></tr>`;
};
```

**Cerchi Servizio/Ritorno SVG:**
```javascript
const circ = (pct, clr) => {
  const r=20, cx=26, cy=26;
  const C = (2*Math.PI*r).toFixed(2);
  const off = (C - (pct/100)*C).toFixed(2);
  return `<div class="tn-stats-circ">
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="rgba(255,255,255,0.07)" stroke-width="5"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${clr}" stroke-width="5"
        stroke-dasharray="${C}" stroke-dashoffset="${off}"
        transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
    </svg>
    <div class="tn-stats-circ-lbl">${pct}%</div>
  </div>`;
};
// 4 cerchi: Servizio J1 (verde), Servizio J2 (blu), Risposta J1 (arancione), Risposta J2 (rosso)
```

**Statistiche per-set (Aces/DF):**
```javascript
function _tnRenderPerSetStats(m) {
  if (!m || !Array.isArray(m.sets)) return '';
  const hasData = m.sets.some(s => s.p1_aces != null || s.p2_aces != null);
  if (!hasData) return '';
  // Tabella: Set | A | DF | A | DF (per giocatore)
  const dataRows = m.sets.map((s, i) => {
    return `<tr>
      <td>S${i+1}</td>
      <td style="color:#00e676">${s.p1_aces??'—'}</td>
      <td style="color:#ff4d4d">${s.p1_df??'—'}</td>
      <td style="color:#00e676">${s.p2_aces??'—'}</td>
      <td style="color:#ff4d4d">${s.p2_df??'—'}</td>
    </tr>`;
  }).join('');
}
```

---

## 5. Colonne Statistiche Tabella Match

Nella tabella principale dei match, colonne dati storici:

| Colonna | Descrizione | Calcolo |
|---------|-------------|---------|
| **PPG** | Punti per partita | `(W*3 + D*1) / totale_partite` |
| **Ris.** | Risultato atteso | Poisson / decisività modello |
| **BTTS** | Both Teams To Score | `bestModelProb(m, 'btts')` |
| **O2.5** | Over 2.5 gol | `bestModelProb(m, 'over25')` |
| **xG** | Expected Goals | Media gol segnati / subiti |
| **Edge** | Valore atteso | `(prob_aggiustata - 1/cote) * 100` |

---

## 6. PowerScore V44 — Calcolo Completo

Indice composito 0-100 con 4 pilastri:

```javascript
function calcPowerScoreV44Detailed(formStr, stats, xgVal, opponentRank) {
  const T = Math.min((formStr || '').length, 5);
  if (T === 0) { // fallback
    const ppg = stats?.ppg || 0;
    return { total: Math.min(100, Math.max(10, Math.round(ppg/3*100))) };
  }

  // Pilastro A — Forma recente (max 40)
  let totalPts = 0, maxPts = 0;
  for (let i = 0; i < T; i++) {
    const R = formStr[i] === 'W' ? 3 : formStr[i] === 'D' ? 1 : 0;
    const Wt = 1.0 - i * 0.2;         // decadimento temporale
    const rank = opponentRank || 10;
    const Wopp = rank <= 2 ? 1.5 : rank <= 4 ? 1.3 : rank <= 6 ? 1.15
                : rank <= 8 ? 1.05 : rank <= 12 ? 0.95 : 0.85;
    totalPts += R * Wt * Wopp;
    maxPts += 3 * Wt * Wopp;
  }
  const pillerA = maxPts > 0 ? (totalPts / maxPts) * 40 : 20;

  // Pilastro B — Slancio ultime 3 (max 25)
  const last3 = formStr.slice(0, Math.min(3, T));
  const wins3 = (last3.match(/W/g) || []).length;
  const draws3 = (last3.match(/D/g) || []).length;
  const pillerB = wins3 >= 3 ? 25 : wins3 >= 2 ? (draws3>0?22:20)
    : wins3 >= 1 ? (draws3>=2?14 : draws3>=1?12 : 10)
    : draws3 >= 2 ? 8 : draws3 >= 1 ? 5 : 2;

  // Pilastro C — xG + difesa + efficienza (max 20)
  const xgSc = Math.min(10, Math.max(0, ((xgVal||stats?.avgScored||1)/3.5)*10));
  const defSc = (stats?.avgConceded||2) < 0.6 ? 6 : (stats?.avgConceded||2) < 1.0 ? 4
    : (stats?.avgConceded||2) < 1.4 ? 2 : 0;
  const effSc = Math.min(4, (xgVal||1) / Math.max((xgVal||1)+(stats?.avgConceded||1),1) * 4 * 2);
  const pillerC = Math.min(20, xgSc + defSc + effSc);

  // Pilastro D — Ranking avversario (max 15)
  const oRank = opponentRank || 10;
  const pillerD = oRank <= 2 ? 15 : oRank <= 4 ? 12 : oRank <= 6 ? 9
    : oRank <= 8 ? 6 : oRank <= 12 ? 4 : 2;

  const total = Math.min(100, Math.max(5, Math.round(pillerA+pillerB+pillerC+pillerD)));
  return { total, pillerA, pillerB, pillerC, pillerD };
}
```

---

## 7. Confidence Score (0-100)

```javascript
function calcConfidenceScore(m, p, accuracy) {
  // 1. Decisività modello (0-40)
  const decisiveness = Math.min(40, Math.max(0, (topPro - 33) / 47 * 40));
  // 2. Volume dati (0-25)
  const volume = Math.min(15, games/20*15) + (m.stats?.isReal ? 10 : 0);
  // 3. Convergenza modello↔mercato (0-20)
  const shieldBonus = m.shield ? 20 : 0;
  // 4. Calibrazione storica (0-15)
  const calib = accRate != null ? Math.min(15, Math.max(0, (accRate-45)/35*15)) : 5;
  return Math.min(100, Math.max(0, decisiveness + volume + shieldBonus + calib));
}
```

---

## 8. Indice di Volatilità (0-100)

```javascript
function calcVolatility(m, p) {
  const hw = p.homeWin||0, dr = p.draw||0, aw = p.awayWin||0;
  const spread = Math.abs(hw - aw);
  const spreadVol = Math.max(0, 1 - spread/70) * 55; // spread basso = alta volatilità
  const drawVol = Math.min(25, dr/35*25);             // pareggio alto = incertezza
  // + concentrazione score
  return Math.round(spreadVol + drawVol + concentrationScore);
}
```

---

## Riepilogo Calcoli

| Statistica | Formula |
|------------|---------|
| **PPG** | `(W*3 + D*1) / totale_partite` |
| **PowerScore** | `A(forma) + B(slancio) + C(xG/difesa) + D(ranking avversario)` |
| **Confidence** | `decisività + volume + convergenza + calibrazione` |
| **Volatilità** | `spread favorito + peso pareggio + concentrazione score` |
| **Edge %** | `(prob_modello - 1/cote) * 100` |
| **BTTS / O2.5** | `bestModelProb(m, 'btts'/'over25')` |
| **Barre live %** | `(squadra_home / totale) * 100` |
| **Cerchi tennis** | `(valore / 100) * circonferenza SVG` |
