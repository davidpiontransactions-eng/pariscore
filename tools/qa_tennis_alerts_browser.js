/* tools/qa_tennis_alerts_browser.js — QA sprint alertes-tennis (Tier client)
 * Smoke test Playwright headless du module client réel (extrait de pariscore.app.js) :
 * handler SSE tennis_alert, toast, highlight carte (survit au re-rendu), son Web Audio
 * (3 intensités), toggle ON/OFF localStorage, badge nav, purge TTL, anti-XSS.
 * Aucun serveur requis : page.setContent + injection du module avec stubs.
 * Usage : node tools/qa_tennis_alerts_browser.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('@playwright/test');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pariscore.app.js'), 'utf8');
const START = SRC.indexOf('window._tnAlertUI = window._tnAlertUI || {');
const END = SRC.indexOf('else _tnAlertSyncSoundUI();') + 'else _tnAlertSyncSoundUI();'.length;
if (START === -1 || END <= START) {
  console.error('FAIL: module alertes tennis introuvable dans pariscore.app.js');
  process.exit(1);
}
const moduleCode = SRC.slice(START, END);

const STUBS = `
window._escTennis = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
window.openTennisDetail = function(id){ window.__openedMatch = id; };
window.showToast = function(msg, type){ window.__lastShowToast = msg; };
`;

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<a id="nav-alertes" href="javascript:void(0)"><span>Alertes</span><span id="tn-sound-off-badge">son coupé</span></a>
<section id="alertes"><button type="button" data-tn-sound-toggle>OFF</button><span id="tn-sound-state"></span></section>
<div id="tennis-live-tbody">
  <div class="tn-live-row tennis-row-clickable" role="row" data-tennis-id="m-100">
    <span class="tn-live-cell"></span>
    <span class="tn-live-cell">Cincinnati · Central</span>
    <span class="tn-live-cell">ATP</span>
  </div>
</div>
</body></html>`;

let pass = 0, fail = 0;
function check(cond, label) {
  if (cond) { pass++; console.log('  PASS ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

(async () => {
  // Mini-serveur local : origine http réelle indispensable pour localStorage
  // (page.setContent crée une origine opaque → SecurityError sur localStorage).
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto(url);
  await page.addScriptTag({ content: STUBS });
  await page.addScriptTag({ content: moduleCode });

  console.log('[1] Boot : défaut OFF + badge nav');
  const boot = await page.evaluate(() => ({
    enabled: window._tnAlertUI.soundEnabled,
    badgeVisible: document.getElementById('tn-sound-off-badge').style.display !== 'none',
    btnText: document.querySelector('[data-tn-sound-toggle]').textContent,
    toggles: document.querySelectorAll('[data-tn-sound-toggle]').length,
  }));
  check(boot.enabled === false, 'son désactivé par défaut (localStorage tn_sound_enabled)');
  check(boot.badgeVisible, 'badge « son coupé » visible sur onglet Alertes');
  check(/OFF/.test(boot.btnText) && boot.toggles === 1, 'toggle synchronisé en OFF');

  console.log('[2] Toggle ON → persistance + badge masqué');
  await page.evaluate(() => window.psToggleTennisSound());
  const on = await page.evaluate(() => ({
    enabled: window._tnAlertUI.soundEnabled,
    storage: localStorage.getItem('tn_sound_enabled'),
    badgeVisible: document.getElementById('tn-sound-off-badge').style.display !== 'none',
    btnText: document.querySelector('[data-tn-sound-toggle]').textContent,
    aria: document.querySelector('[data-tn-sound-toggle]').getAttribute('aria-pressed'),
    audioCtx: !!window._tnAlertUI.audioCtx,
  }));
  check(on.enabled === true && on.storage === '1', 'toggle ON persisté localStorage=1');
  check(!on.badgeVisible, 'badge nav masqué une fois ON');
  check(/ON/.test(on.btnText) && on.aria === 'true', 'toggle synchronisé en ON (aria-pressed)');
  check(on.audioCtx, 'AudioContext créé dans le geste utilisateur (unlock)');

  console.log('[3] Alerte jaune : toast + highlight + état re-rendu');
  await page.evaluate(() => window._tnAlertHandle({
    id: 'm-100', metric: 'dr_diff', level: 'yellow', value: 0.22,
    match: { player1: 'Djokovic', player2: 'Alcaraz' },
    msg: 'Écart DR 0.22 → Djokovic domine, parier sur le dominant',
  }));
  const yellow = await page.evaluate(() => {
    const row = document.querySelector('.tn-live-row[data-tennis-id="m-100"]');
    const toast = document.querySelector('.tn-alert-toast');
    const state = window._tnAlertUI.active.get('m-100');
    return {
      rowYellow: row.classList.contains('tn-alert-yellow'),
      cardBadge: !!row.querySelector('.tn-alert-badge'),
      toastExists: !!toast,
      toastText: toast ? toast.querySelector('.tn-alert-toast-head').textContent : '',
      toastBtn: toast ? toast.querySelector('.tn-alert-toast-btn').textContent : '',
      stateOk: !!state && state.level === 'yellow' && state.metric === 'dr_diff',
      rowClsFn: window._tnAlertRowCls('m-100').trim(),
      badgeFn: window._tnAlertBadgeHtml('m-100'),
    };
  });
  check(yellow.rowYellow, 'carte match bordure jaune immédiate');
  check(yellow.cardBadge, 'badge métrique ajouté sur la carte');
  check(yellow.toastExists && /Djokovic vs Alcaraz/.test(yellow.toastText), 'toast haut de page avec P1 vs P2');
  check(/parier sur le dominant/.test(yellow.toastText), 'toast contient le conseil');
  check(yellow.toastBtn === 'Voir le match', 'bouton « Voir le match »');
  check(yellow.stateOk, 'état conservé (survit au re-rendu)');
  check(yellow.rowClsFn === 'tn-alert-yellow', 'renderTennisLive ré-applique la classe');
  check(/Écart DR/.test(yellow.badgeFn), 'renderTennisLive ré-applique le badge');

  console.log('[4] Bouton « Voir le match » → openTennisDetail');
  await page.evaluate(() => document.querySelector('.tn-alert-toast-btn').click());
  const opened = await page.evaluate(() => window.__openedMatch);
  check(opened === 'm-100', 'openTennisDetail appelé avec l\'id du match');

  console.log('[5] Alerte critique : classe critical + son 3 pocs sans erreur');
  await page.evaluate(() => window._tnAlertHandle({
    id: 'm-100', metric: 'bppi_spike', level: 'critical', value: 27,
    match: { player1: 'Djokovic', player2: 'Alcaraz' },
    msg: 'Spike pression break +27 pts → Alcaraz met la pression',
  }));
  const crit = await page.evaluate(() => {
    const row = document.querySelector('.tn-live-row[data-tennis-id="m-100"]');
    return {
      critical: row.classList.contains('tn-alert-critical') && !row.classList.contains('tn-alert-yellow'),
      stateLvl: window._tnAlertUI.active.get('m-100').level,
      soundPlays: (() => { try { window._tnAlertPlaySound('critical'); window._tnAlertPlaySound('red'); window._tnAlertPlaySound('yellow'); return true; } catch (e) { return false; } })(),
    };
  });
  check(crit.critical, 'carte passe en critical (pulse rouge)');
  check(crit.stateLvl === 'critical', 'état mis à jour vers critical');
  check(crit.soundPlays, 'synthèse Web Audio 3 intensités sans exception (headless)');

  console.log('[6] Anti-XSS : payload piégé');
  await page.evaluate(() => window._tnAlertHandle({
    id: 'm-666', metric: 'dr_diff', level: 'red', value: 0.4,
    match: { player1: '<img src=x onerror=alert(1)>', player2: 'Vil<strong>ain</strong>' },
    msg: 'Écart DR <script>window.__xss=1</script> 0.40',
  }));
  const xss = await page.evaluate(() => {
    window._tnAlertHighlightCard('m-666', { metric: 'dr_diff', level: 'red' });
    const toasts = document.querySelectorAll('.tn-alert-toast');
    const last = toasts[toasts.length - 1];
    return {
      xssFired: window.__xss === 1,
      imgInjected: !!document.querySelector('.tn-alert-toast img'),
      scriptInjected: !!last.querySelector('script'),
      rawTextVisible: last.textContent.includes('<script>'),
      toastCount: toasts.length,
    };
  });
  check(!xss.xssFired && !xss.imgInjected && !xss.scriptInjected, 'aucune exécution/injection depuis payload SSE');
  check(xss.rawTextVisible, 'texte malicieux affiché comme texte (textContent)');

  console.log('[7] Pile toasts plafonnée à 5 + purge TTL');
  const cap = await page.evaluate(() => {
    for (let i = 0; i < 8; i++) {
      window._tnAlertHandle({ id: 'cap-' + i, metric: 'set_overs', level: 'yellow', value: 0.8, match: { player1: 'A', player2: 'B' }, msg: 'x' });
    }
    const n = document.getElementById('tn-alert-toast-stack').children.length;
    window._tnAlertUI.active.set('old-match', { metric: 'dr_diff', level: 'yellow', value: 0.3, ts: Date.now() - 6 * 60 * 1000 });
    window._tnAlertPurgeStale();
    return { n, oldPurged: !window._tnAlertUI.active.has('old-match') };
  });
  check(cap.n <= 5, 'pile toasts plafonnée (max 5, trouvé ' + cap.n + ')');
  check(cap.oldPurged, 'entrées > 5 min purgées (TTL)');

  console.log('[8] Notification desktop : refus silencieux sans permission');
  const notif = await page.evaluate(() => {
    try {
      window._tnAlertDesktopNotify({ id: 'x', match: { player1: 'A', player2: 'B' }, msg: 'm' });
      return 'no-crash';
    } catch (e) { return 'crash:' + e.message; }
  });
  check(notif === 'no-crash', 'notification ignorée sans permission (pas de crash)');

  console.log('[9] Zéro erreur page sur tout le scénario');
  check(pageErrors.length === 0, 'aucune pageerror (' + pageErrors.join(' | ') + ')');

  await browser.close();
  server.close();
  console.log('');
  console.log(pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERREUR QA:', e); process.exit(1); });
