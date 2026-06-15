# -*- coding: utf-8 -*-
import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
out = r'C:\Users\david\Documents\dev PariScore\ParisScorebis\multilang-module-guide.txt'

BOX_T = '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557'
BOX_B = '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d'
BOX_L = '\u2551'
SEP = '\u2550' * 70

def w(s=''):
    with open(out, 'a', encoding='utf-8') as f:
        f.write(s + '\n')

def section(title):
    w()
    w(SEP)
    w(title.upper())
    w(SEP)
    w()

def code_block(code, lang='html'):
    w('`' + lang)
    w(code)
    w('`')
    w()

# Reset file
with open(out, 'w', encoding='utf-8') as f:
    f.write(BOX_T + '\n')
    f.write(BOX_L + '   MULTILANGUAGE MODULE - PariScore -> moran65.com Adaptation     ' + BOX_L + '\n')
    f.write(BOX_L + '   Complete code + guide (English)                               ' + BOX_L + '\n')
    f.write(BOX_B + '\n')

w()
w('This module was extracted from PariScore and adapted for moran65.com.')
w('It is a complete client-side multilanguage system with:')
w('  - Automatic browser language detection')
w('  - localStorage persistence')
w('  - data-i18n attribute-based translation')
w('  - Runtime MutationObserver overlay for JS-generated content')
w('  - No external dependencies - pure vanilla JavaScript')
w()

# TOC
section('TABLE OF CONTENTS')
w('1.  Architecture overview')
w('2.  Core i18n engine (full script to copy)')
w('3.  Runtime overlay for dynamic JS content')
w('4.  Language selector UI')
w('5.  Locale JSON files structure')
w('6.  How to use data-i18n in your HTML')
w('7.  Next.js integration guide (for moran65.com)')
w('8.  Static HTML integration (alternative)')
w('9.  Using I18N.t() in JavaScript')
w('10. Adapting for moran65.com (Hebrew + English)')

# SECTION 1
section('1. ARCHITECTURE OVERVIEW')
w('The module is entirely client-side (JavaScript in the browser).')
w('It has 3 layers that work together:')
w()
w('  Layer 1: Core I18N Engine')
w('    - Fetches /locales/{lang}.json via fetch()')
w('    - Stores translations in a JS object (dict)')
w('    - Swaps [data-i18n] elements in the DOM')
w('    - Fires "i18n:changed" custom event')
w('    - Persists choice in localStorage (key: site_lang)')
w()
w('  Layer 2: Runtime Overlay (optional, for dynamic JS content)')
w('    - MutationObserver watches DOM for new nodes')
w('    - Scans ALL text nodes for French strings')
w('    - Replaces FR -> target language')
w('    - Handles JS-generated content (API results, modals, etc.)')
w()
w('  Layer 3: Locale JSON files')
w('    - /locales/fr.json  -> REFERENCE language (French)')
w('    - /locales/en.json  -> English translations')
w('    - /locales/de.json, es.json, it.json... (any language)')
w()
w('DATA FLOW:')
w('  1. Page loads')
w('  2. I18N checks localStorage for "site_lang"')
w('  3. Falls back to navigator.language (browser setting)')
w('  4. Falls back to "fr" (French)')
w('  5. Fetches /locales/{lang}.json')
w('  6. I18N.apply() swaps all [data-i18n] elements in DOM')
w('  7. Dispatches "i18n:changed" custom event')
w('  8. Runtime Overlay activates (if lang != fr):')
w('     a. Fetches both fr.json and {lang}.json')
w('     b. Builds map: French_string -> translated_string')
w('     c. Walks all DOM text nodes, replaces matches')
w('     d. Installs MutationObserver for future dynamic content')
w('  9. When user switches language: saves to localStorage, location.reload()')

# SECTION 2
section('2. CORE I18N ENGINE - Full Script to Copy')
w('Paste this script before </body> in your HTML page.')
w('It must run AFTER your language selector is in the DOM.')
w()

i18n_engine = '''<script>
/* --- i18n module -- multilanguage engine --- */
const I18N = (() => {
  const SUPPORTED = ['fr','en','es','de','it','pt','nl'];
  let dict = {}, current = 'fr';

  function _savedLang() {
    try { return localStorage.getItem('site_lang'); } catch(_) { return null; }
  }

  async function load(lang) {
    if (!SUPPORTED.includes(lang)) lang = 'fr';
    try {
      const r = await fetch('/locales/' + lang + '.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      dict = await r.json();
      current = lang;
      try { localStorage.setItem('site_lang', lang); } catch(_) {}
      document.documentElement.lang = lang;
      const sel = document.getElementById('lang-select');
      if (sel) sel.value = lang;
      apply();
      try { document.dispatchEvent(
        new CustomEvent('i18n:changed', { detail: { lang: current } })
      ); } catch(_) {}
    } catch(e) {
      if (lang !== 'fr') { console.warn('[i18n] fallback fr:', e.message); load('fr'); }
    }
  }

  // t(key) returns translation, t(key, {0:'val'}) interpolates variables
  function t(key, vars) {
    let s = dict[key] !== undefined ? dict[key] : key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function apply() {
    // data-i18n -> textContent
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      el.textContent = t(el.dataset.i18n);
    });
    // data-i18n-placeholder -> placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    // data-i18n-title -> title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
      el.title = t(el.dataset.i18nTitle);
    });
    // data-i18n-content -> content attribute (meta tags)
    document.querySelectorAll('[data-i18n-content]').forEach(function(el) {
      el.content = t(el.dataset.i18nContent);
    });
  }

  // Auto-detect on init
  const saved = _savedLang();
  const detected = saved || (navigator.language || 'fr').slice(0, 2);
  load(SUPPORTED.includes(detected) ? detected : 'fr');

  return {
    t: t,
    load: load,
    apply: apply,
    current: function() { return current; },
    SUPPORTED: SUPPORTED
  };
})();
</script>'''

code_block(i18n_engine, 'html')

w('PUBLIC API:')
w('  I18N.t("key")              -> returns translated string')
w('  I18N.t("key", {var:val})   -> with variable interpolation')
w('  I18N.load("en")             -> switch language, apply, dispatch')
w('  I18N.apply()                -> re-apply all [data-i18n] elements')
w('  I18N.current()              -> returns current language code')
w('  I18N.SUPPORTED              -> array of supported language codes')

# SECTION 3
section('3. RUNTIME OVERLAY - For JS-Injected Dynamic Content')
w('This is an OPTIONAL interim solution. It works alongside the I18N engine.')
w('While I18N.apply() only touches elements with data-i18n attributes,')
w('the overlay scans the ENTIRE DOM for French text and replaces it.')
w('It also installs a MutationObserver to auto-translate any new')
w('DOM nodes added by JavaScript (e.g., API fetch results, modals).')
w()
w('Place this script RIGHT AFTER the core I18N engine script:')
w()

overlay_code = '''<script>
/* --- i18n RUNTIME OVERLAY ---
   Translates rendered DOM text + attrs (title/placeholder/aria-label)
   from French to the active language using locale dicts.
   Covers static HTML AND JS-rendered content via MutationObserver.
   Language switch reloads to clean FR baseline, then overlay re-applies. */
(function () {
  var SUPPORTED = ['fr','en','es','de','it','pt','nl'];
  var ATTRS = ['title','placeholder','aria-label'];
  var SKIP = { SCRIPT:1, STYLE:1, TEXTAREA:1, NOSCRIPT:1, CODE:1, PRE:1, OPTION:1, SELECT:1 };
  var _map = null, _active = false, _obs = null, _pending = false, _queue = [];

  function _lang() {
    try { var s = localStorage.getItem('site_lang'); if (s) return s; } catch (_) {}
    return (navigator.language || 'fr').slice(0, 2);
  }

  function _eligible(t) {
    if (!t || t.length < 3) return false;
    if (!/[A-Za-z\\xC0-\\xFF]/.test(t)) return false;
    return true;
  }

  async function _build(lang) {
    var m = {};
    try {
      var fr = await fetch('/locales/fr.json').then(function(r) { return r.json(); });
      var tg = await fetch('/locales/' + lang + '.json').then(function(r) { return r.json(); });
      for (var k in fr) {
        var f = (fr[k] || '').trim(), e = (tg[k] || '').trim();
        if (f && e && f !== e && _eligible(f)) m[f] = e;
      }
    } catch (err) {
      console.warn('[i18n-overlay] map load failed:', err && err.message);
    }
    return m;
  }

  function _txt(tn) {
    var raw = tn.nodeValue; if (!raw) return;
    var key = raw.trim(); if (!key) return;
    var tr = _map[key]; if (tr === undefined) return;
    tn.nodeValue = raw.replace(key, tr);
  }

  function _attrs(el) {
    if (!el || el.nodeType !== 1 || !el.hasAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a), key = (v || '').trim(); if (!key) continue;
      var tr = _map[key]; if (tr === undefined) continue;
      el.setAttribute(a, v.replace(key, tr));
    }
  }

  function _walk(root) {
    if (!_map || !root) return;
    if (root.nodeType === 1) {
      _attrs(root);
      if (root.querySelectorAll) {
        var els = root.querySelectorAll('[title],[placeholder],[aria-label]');
        for (var j = 0; j < els.length; j++) _attrs(els[j]);
      }
    }
    var sr = (root.nodeType === 1 || root.nodeType === 9) ? root : root.parentNode;
    if (!sr || !sr.nodeType) return;
    var w = document.createTreeWalker(sr, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n) {
        var p = n.parentNode;
        if (!p || SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var batch = [], n;
    while ((n = w.nextNode())) batch.push(n);
    for (var i = 0; i < batch.length; i++) _txt(batch[i]);
  }

  function _flush() {
    _pending = false;
    var q = _queue; _queue = [];
    for (var i = 0; i < q.length; i++) _walk(q[i]);
  }

  function _observe() {
    if (_obs || !document.body) return;
    _obs = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var nd = added[j];
          if (nd.nodeType === 1 || nd.nodeType === 3) _queue.push(nd);
        }
      }
      if (!_pending && _queue.length) {
        _pending = true;
        if (window.requestAnimationFrame) requestAnimationFrame(_flush);
        else setTimeout(_flush, 16);
      }
    });
    _obs.observe(document.body, { childList: true, subtree: true });
  }

  async function activate() {
    if (_active) return;
    var lang = _lang();
    if (!lang || lang === 'fr' || SUPPORTED.indexOf(lang) === -1) return;
    _active = true;
    _map = await _build(lang);
    if (!_map || !Object.keys(_map).length) { _active = false; return; }
    if (document.body) { _walk(document.body); _observe(); }
    else document.addEventListener('DOMContentLoaded', function() { _walk(document.body); _observe(); });
  }

  document.addEventListener('i18n:changed', activate);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate);
  else activate();
})();
</script>'''

code_block(overlay_code, 'html')

w('KEY DESIGN CHOICE: French is the reference language. The overlay fetches')
w('BOTH fr.json AND the target language JSON, builds a French->target map,')
w('and replaces French text in the DOM with translations. When the user')
w('switches language, the page RELOADS (back to French), then the overlay')
w('re-applies the translation. This guarantees FR<->EN consistency.')

# SECTION 4
section('4. LANGUAGE SELECTOR UI')
w('Paste this in your navigation bar where you want the language switch:')
w()

selector_html = '''<select id="lang-select"
  onchange="switchLang(this.value)"
  title="Language"
  style="font-size:11px;background:var(--bg,#fff);color:var(--text,#333);
  border:1px solid var(--border,#ccc);border-radius:6px;padding:4px 7px;
  cursor:pointer;outline:none;">
  <option value="fr">&zwj;&zwj; FR</option>
  <option value="en">&zwj;&zwj; EN</option>
  <option value="es">&zwj;&zwj; ES</option>
  <option value="de">&zwj;&zwj; DE</option>
  <option value="it">&zwj;&zwj; IT</option>
  <option value="pt">&zwj;&zwj; PT</option>
  <option value="nl">&zwj;&zwj; NL</option>
</select>

<script>
/* Called by the <select> onchange - saves language and reloads */
function switchLang(v) {
  try { localStorage.setItem('site_lang', v); } catch (_) {}
  try { document.documentElement.lang = v; } catch (_) {}
  location.reload();
}
</script>'''

code_block(selector_html, 'html')

print('Sections 1-4 written')

with open(out, 'a', encoding='utf-8') as f:
    f.write('\n')

print('Done')
