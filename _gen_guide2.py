# -*- coding: utf-8 -*-
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
out = r'C:\Users\david\Documents\dev PariScore\ParisScorebis\multilang-module-guide.txt'

SEP = '\u2550' * 70
def w(s=''):
    with open(out, 'a', encoding='utf-8') as f:
        f.write(s + '\n')

def section(title):
    w(); w(SEP); w(title.upper()); w(SEP); w()

def code_block(code):
    w('--- CODE ---')
    w(code)
    w('--- END CODE ---')
    w()

# SECTION 5
section('5. LOCALE JSON FILES STRUCTURE')
w('Place these in /locales/ at the root of your website (or /public/locales/ for Next.js).')
w()
w('RULES:')
w('  - ALL language files must have the EXACT SAME keys')
w('  - French (fr.json) is the REFERENCE language')
w('  - Keys use dot-separated namespaces: "section.subsection.key"')
w('  - Variables use {0}, {1} or {name} syntax')
w('  - Files are plain JSON')
w()
w('Example fr.json (reference - French):')
code_block('''
{
  "nav.accueil": "Accueil",
  "nav.services": "Services",
  "nav.contact": "Contact",
  "nav.login": "Connexion",
  "nav.signup": "S'inscrire",

  "hero.title": "Bienvenue sur mon site",
  "hero.subtitle": "Decouvrez nos solutions sur mesure",
  "hero.cta": "Nous contacter",
  "hero.secondary": "En savoir plus",

  "section.stats.label": "Statistiques",
  "section.features.title": "Fonctionnalites",
  "section.how.title": "Comment ca marche",
  "section.how.step1": "Inscription rapide",
  "section.how.step2": "Configurez vos preferences",
  "section.how.step3": "Suivez vos resultats",
  "section.faq.title": "Questions frequentes",

  "form.name": "Nom",
  "form.email": "Email",
  "form.message": "Message",
  "form.submit": "Envoyer",
  "form.sending": "Envoi en cours...",
  "form.sent": "Message envoye !",
  "form.error": "Erreur lors de l'envoi",

  "footer.copyright": "{year} Moran65 - Tous droits reserves",
  "footer.follow": "Suivez-moi",
  "footer.contact_mail": "Contact: support@moran65.com",

  "seo.title": "Moran65 - {page}",
  "seo.description": "Site officiel de Moran65",

  "theme.toggle_night": "Mode Nuit",
  "theme.toggle_day": "Mode Jour",

  "modal.cancel": "Annuler",
  "modal.confirm": "Confirmer",
  "modal.close": "Fermer",
  "modal.save": "Enregistrer",

  "badge.live": "EN DIRECT",
  "badge.new": "NOUVEAU",
  "badge.hot": "POPULAIRE",

  "pwa.install": "Installer l'application",
  "pwa.install_btn": "Installer",
  "pwa.dismiss": "Plus tard"
}
''')

w('Example en.json (English - same keys, translated):')
code_block('''
{
  "nav.accueil": "Home",
  "nav.services": "Services",
  "nav.contact": "Contact",
  "nav.login": "Login",
  "nav.signup": "Sign up",

  "hero.title": "Welcome to my site",
  "hero.subtitle": "Discover our tailored solutions",
  "hero.cta": "Contact us",
  "hero.secondary": "Learn more",

  "section.stats.label": "Statistics",
  "section.features.title": "Features",
  "section.how.title": "How it works",
  "section.how.step1": "Quick signup",
  "section.how.step2": "Set your preferences",
  "section.how.step3": "Track your results",
  "section.faq.title": "Frequently Asked Questions",

  "form.name": "Name",
  "form.email": "Email",
  "form.message": "Message",
  "form.submit": "Send",
  "form.sending": "Sending...",
  "form.sent": "Message sent!",
  "form.error": "Error sending message",

  "footer.copyright": "{year} Moran65 - All rights reserved",
  "footer.follow": "Follow me",
  "footer.contact_mail": "Contact: support@moran65.com",

  "seo.title": "Moran65 - {page}",
  "seo.description": "Official site of Moran65",

  "theme.toggle_night": "Night mode",
  "theme.toggle_day": "Day mode",

  "modal.cancel": "Cancel",
  "modal.confirm": "Confirm",
  "modal.close": "Close",
  "modal.save": "Save",

  "badge.live": "LIVE",
  "badge.new": "NEW",
  "badge.hot": "HOT",

  "pwa.install": "Install the app",
  "pwa.install_btn": "Install",
  "pwa.dismiss": "Not now"
}
''')

w('CRITICAL RULE: If you add a new key to fr.json, you MUST add it to ALL')
w('other language files too. Missing keys will cause the French text to show')
w('as-is (which is fine for the overlay - it just wont find a match).')

# SECTION 6
section('6. HOW TO USE data-i18n IN YOUR HTML')
w()
w('Attribute reference:')
w('  data-i18n="key"             -> replaces textContent')
w('  data-i18n-placeholder="key" -> replaces placeholder attribute')
w('  data-i18n-title="key"       -> replaces title attribute')
w('  data-i18n-content="key"     -> replaces content attribute (meta tags)')
w()
w('Basic text translation:')
code_block('<h1 data-i18n="hero.title">Bienvenue sur mon site</h1>')
w('After switching language, textContent is replaced by hero.title from en.json')
w()
w('Input placeholder:')
code_block('<input type="text" data-i18n-placeholder="form.name" placeholder="Nom">')
w()
w('Tooltip / title:')
code_block('<button data-i18n-title="theme.toggle_night" title="Mode Nuit">Nuit</button>')
w()
w('Meta tags (SEO):')
code_block('<title data-i18n="seo.title">Moran65 - Accueil</title>')
code_block('<meta name="description" data-i18n-content="seo.description" content="Site officiel de Moran65">')
w()
w('With variable interpolation:')
w('  In your JSON: "footer.copyright": "{year} Moran65 - All rights reserved"')
w('  In your HTML: <footer data-i18n="footer.copyright">...</footer>')
w('  NOTE: For dynamic variables in data-i18n, call I18N.t() in JS (see section 9)')
w()
w('Combined example:')
code_block('''
<div class="card">
  <h3 data-i18n="section.features.title">Features</h3>
  <p data-i18n="section.features.sub">Everything you need</p>
  <input data-i18n-placeholder="form.email" placeholder="Email">
  <button data-i18n-title="badge.new" title="NEW">
    <span data-i18n="form.submit">Send</span>
  </button>
</div>
''')

# SECTION 7
section('7. NEXT.JS INTEGRATION GUIDE (for moran65.com)')
w('Since moran65.com runs on Next.js (App Router), here is how to integrate.')
w()
w('Step 1: Create the locale files')
w('  Place them in /public/locales/ (Next.js serves /public/ as static files)')
w()
w('  public/locales/fr.json  (reference)')
w('  public/locales/en.json  (English)')
w('  public/locales/he.json  (Hebrew - your current language)')
w()
w('Step 2: Create a Client Component for the language switcher')
code_block('''
// components/LangSwitcher.tsx
"use client";
import Script from "next/script";

const I18N_ENGINE = 
const I18N = (() => {
  const SUPPORTED = ["fr","en","he"];
  let dict = {}, current = "fr";
  function _savedLang() {
    try { return localStorage.getItem("site_lang"); } catch(_) { return null; }
  }
  async function load(lang) {
    if (!SUPPORTED.includes(lang)) lang = "fr";
    try {
      const r = await fetch("/locales/" + lang + ".json");
      if (!r.ok) throw new Error("HTTP " + r.status);
      dict = await r.json();
      current = lang;
      try { localStorage.setItem("site_lang", lang); } catch(_) {}
      document.documentElement.lang = lang;
      const sel = document.getElementById("lang-select");
      if (sel) sel.value = lang;
      document.querySelectorAll("[data-i18n]").forEach(function(el) {
        el.textContent = dict[el.dataset.i18n] !== undefined ? dict[el.dataset.i18n] : el.dataset.i18n;
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach(function(el) {
        el.placeholder = dict[el.dataset.i18nPlaceholder] !== undefined ? dict[el.dataset.i18nPlaceholder] : el.dataset.i18nPlaceholder;
      });
      document.querySelectorAll("[data-i18n-title]").forEach(function(el) {
        el.title = dict[el.dataset.i18nTitle] !== undefined ? dict[el.dataset.i18nTitle] : el.dataset.i18nTitle;
      });
      document.querySelectorAll("[data-i18n-content]").forEach(function(el) {
        el.content = dict[el.dataset.i18nContent] !== undefined ? dict[el.dataset.i18nContent] : el.dataset.i18nContent;
      });
      document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: current } }));
    } catch(e) {
      if (lang !== "fr") { console.warn("[i18n] fallback fr:", e.message); load("fr"); }
    }
  }
  const saved = _savedLang();
  const detected = saved || (navigator.language || "fr").slice(0, 2);
  load(SUPPORTED.includes(detected) ? detected : "fr");
  window.I18N = {
    t: function(k,v){var s=dict[k]!==undefined?dict[k]:k;if(v)for(var kk in v)s=s.split("{"+kk+"}").join(v[kk]);return s;},
    load: load,
    current: function(){return current;},
    SUPPORTED: SUPPORTED
  };
})();
;

export default function LangSwitcher() {
  return (
    <>
      <Script id="i18n-engine" strategy="afterInteractive">
        {I18N_ENGINE}
      </Script>
      <select
        id="lang-select"
        onChange={(e) => {
          const v = e.target.value;
          try { localStorage.setItem("site_lang", v); } catch (_) {}
          try { document.documentElement.lang = v; } catch (_) {}
          location.reload();
        }}
        defaultValue=""
        className="lang-select"
      >
        <option value="fr">FR</option>
        <option value="en">EN</option>
        <option value="he">HE</option>
      </select>
    </>
  );
}
''')

w()
w('Step 3: Add data-i18n attributes to your components')
w('  Go through each component and add data-i18n="key" to every text element.')
w('  The HTML source text stays as-is (Hebrew), and the overlay matches')
w('  French text from the locale files and replaces it.')
w()
w('Step 4: Handle RTL/LTR direction change')
w('  Listen for the i18n:changed event to toggle dir attribute:')
code_block('''
document.addEventListener("i18n:changed", function(e) {
  document.documentElement.dir = e.detail.lang === "he" ? "rtl" : "ltr";
});
''')
w()
w('  Alternatively, use CSS with lang attribute selectors:')
code_block('''
[lang="he"] .my-class { direction: rtl; }
[lang="en"] .my-class { direction: ltr; }
''')

# SECTION 8
section('8. STATIC HTML INTEGRATION (Alternative)')
w('If your site is pure static HTML (no server), you have 2 options:')
w()
w('Option A: Fetch JSON files from server')
w('  Simply drop the locales/ folder at your site root.')
w('  The fetch() will work like: GET https://your-site.com/locales/en.json')
w('  Works on: Apache, Nginx, Netlify, Vercel, GitHub Pages, any static host.')
w()
w('Option B: Inline translations directly in JavaScript (no external files)')
w('  Embed all language data inside the script:')
code_block('''
<script>
var LOCALES = {
  fr: {
    "nav.accueil": "Accueil",
    "hero.title": "Bienvenue"
  },
  en: {
    "nav.accueil": "Home",
    "hero.title": "Welcome"
  },
  he: {
    "nav.accueil": "",
    "hero.title": ""
  }
};
</script>
''')
w()
w('  Then modify the I18N engine to use LOCALES instead of fetch():')
code_block('''
async function load(lang) {
  if (!SUPPORTED.includes(lang)) lang = "fr";
  dict = LOCALES[lang] || LOCALES.fr;
  current = lang;
  try { localStorage.setItem("site_lang", lang); } catch(_) {}
  document.documentElement.lang = lang;
  // ... rest is identical
}
''')

# SECTION 9
section('9. USING I18N.t() IN JAVASCRIPT')
w('For dynamic content rendered by JavaScript:')
w()
w('Basic usage:')
code_block('''
var translated = I18N.t("hero.title");
console.log(translated);  // "Welcome" (if current lang is "en")
''')
w()
w('With variable interpolation:')
code_block('''
// JSON: "footer.copyright": "{year} Moran65 - All rights reserved"
var text = I18N.t("footer.copyright", { year: 2026 });
// Result: "2026 Moran65 - All rights reserved"
''')
w()
w('Re-rendering on language change:')
code_block('''
document.addEventListener("i18n:changed", function(e) {
  var lang = e.detail.lang;
  document.getElementById("my-content").innerHTML = I18N.t("hero.title");
});
''')
w()
w('Example: rendering HTML in JS:')
code_block('''
function renderCard(data) {
  return \'<div class="card">\'
    + \'<h3>\' + I18N.t("section.features.title") + \'</h3>\'
    + \'<p>\' + I18N.t("section.features.sub") + \'</p>\'
    + \'</div>\';
}

// Listen for language changes to re-render
document.addEventListener("i18n:changed", function() {
  document.getElementById("card-container").innerHTML
    = data.map(renderCard).join("");
});
''')

# SECTION 10
section('10. ADAPTING FOR moran65.com (Hebrew + English)')
w('Your site is currently Hebrew-only (Next.js with lang="he" dir="rtl").')
w('Here is the complete adaptation plan:')
w()
w('--- Step 1: Choose reference language ---')
w()
w('This module uses FRENCH as reference by default (the HTML is in French,')
w('the overlay matches French strings -> replaces with target language).')
w()
w('For moran65.com you have 2 choices:')
w()
w('OPTION A: Make HEBREW the reference (recommended)')
w('  - Keep all HTML in Hebrew as-is')
w('  - Create he.json as the "reference" file (all keys must be here)')
w('  - Create en.json as translations')
w('  - Modify the overlay _build() function to use Hebrew instead of French:')
code_block('''
async function _build(lang) {
  var m = {};
  try {
    var ref = await fetch("/locales/he.json")   // Hebrew as reference
      .then(function(r) { return r.json(); });
    var tg = await fetch("/locales/" + lang + ".json")
      .then(function(r) { return r.json(); });
    for (var k in ref) {
      var f = (ref[k] || "").trim(), e = (tg[k] || "").trim();
      if (f && e && f !== e && _eligible(f)) m[f] = e;
    }
  } catch (err) { console.warn("[i18n-overlay] map load failed:", err && err.message); }
  return m;
}
''')
w()
w('OPTION B: Make ENGLISH the reference')
w('  - Rewrite the HTML source in English')
w('  - Create en.json (reference) and he.json (translations)')
w('  - Same approach, different lang codes')
w()
w('--- Step 2: Create locale files ---')
w()
w('/locales/he.json (reference - based on current site content):')
code_block('''
{
  "nav.login": "",
  "nav.signup": "",
  "hero.title": " ",
  "hero.subtitle": "   .   .   ",
  "hero.cta": "    ",
  "hero.secondary": "    ?   ",
  "section.stats.teams": "   ",
  "section.stats.leagues": "   ",
  "section.stats.games": "   ",
  "section.stats.knockout": "    ",
  "section.how.step1": "   ",
  "section.how.step2": "   ,   ",
  "section.how.step3": "    ",
  "section.features.predictions": "   ",
  "section.features.bracket": "    ",
  "section.features.private": "   ",
  "section.features.schedule": "   ",
  "faq.q1": "   ?",
  "faq.q2": "    ?",
  "faq.q3": "      ?",
  "cta.final": "   .    .",
  "cta.final_btn": "    ",
  "footer.copyright": "2026 moran65.com",
  "footer.privacy": "  ",
  "footer.terms": "   ",
  "seo.title": "moran65.com -   2026",
  "seo.description": "    2026"
}
''')
w()
w('/locales/en.json (translations):')
code_block('''
{
  "nav.login": "Login",
  "nav.signup": "Sign up",
  "hero.title": "World Cup 2026 Predictions",
  "hero.subtitle": "Guess. Watch. Get it wrong together.",
  "hero.cta": "Sign up free now",
  "hero.secondary": "Already have an account? Login",
  "section.stats.teams": "Teams selecting",
  "section.stats.leagues": "Private leagues",
  "section.stats.games": "Planned games",
  "section.stats.knockout": "Knockout stages",
  "section.how.step1": "Quick signup",
  "section.how.step2": "Pick matches & predictor",
  "section.how.step3": "Follow your league",
  "section.features.predictions": "Winning predictions",
  "section.features.bracket": "Full bracket scoring",
  "section.features.private": "Private leagues",
  "section.features.schedule": "Planned games",
  "faq.q1": "Is it free?",
  "faq.q2": "What is the difference?",
  "faq.q3": "Why should I join now?",
  "cta.final": "The World Cup is coming. Register now.",
  "cta.final_btn": "Sign up free now",
  "footer.copyright": "2026 moran65.com",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Service",
  "seo.title": "moran65.com - World Cup 2026 Predictions",
  "seo.description": "A social prediction game for the 2026 World Cup"
}
''')
w()
w('--- Step 3: Add data-i18n attributes ---')
w('Go through every component and add data-i18n="key" to each text element:')
code_block('''
// Before (Hebrew):
<h1> 2026</h1>

// After (Hebrew stays, data-i18n added):
<h1 data-i18n="hero.title"> 2026</h1>
''')
w()
w('--- Step 4: Handle RTL/LTR automatically ---')
code_block('''
// Add to your i18n initialization:
document.addEventListener("i18n:changed", function(e) {
  document.documentElement.dir = e.detail.lang === "he" ? "rtl" : "ltr";
});
''')
w()
w('--- Summary Checklist for moran65.com ---')
w('  [ ] Create /public/locales/he.json (reference)')
w('  [ ] Create /public/locales/en.json (translations)')
w('  [ ] Modify overlay _build() to use he.json as reference instead of fr.json')
w('  [ ] Add data-i18n="key" to every text element in all components')
w('  [ ] Create LangSwitcher client component with the I18N engine')
w('  [ ] Handle RTL/LTR direction on language change')
w('  [ ] Test French is no longer needed (or add fr.json as a third language)')
w()

# FINAL
section('QUICK START CHECKLIST')
w('  [ ] Create /locales/fr.json (reference) or /locales/he.json for your site')
w('  [ ] Create /locales/en.json (same keys, translated)')
w('  [ ] Add more language files as needed')
w('  [ ] Copy the I18N engine script into your page/layout')
w('  [ ] Copy the language selector HTML into your nav')
w('  [ ] (Optional) Add the runtime overlay for dynamic content')
w('  [ ] Add data-i18n="key" to every translatable element in HTML')
w('  [ ] Add data-i18n-placeholder / data-i18n-title / data-i18n-content')
w('  [ ] In JavaScript, use I18N.t("key") for dynamic content')
w('  [ ] Listen for "i18n:changed" to re-render dynamic modules')
w('  [ ] Handle RTL/LTR if your languages have different directions')
w()

w('--- End of guide ---')

print('Sections 5-10 written successfully!')
