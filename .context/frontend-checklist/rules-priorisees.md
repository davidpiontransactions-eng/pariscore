# Front-End Checklist — Règles priorisées pour PariScore

> Source : [thedaviddias/Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist) — 390 règles.
> Cette liste condense les règles **Critical** et **High** applicables à PariScore (vanilla JS, HTML statique, pas de React/TS).
> Pour le détail complet d'une règle : utilise le MCP `frontendchecklist` → `get_rule <slug>`.

---

## 🔴 CRITICAL (site-breaking / sécurité)

### HTML
| Règle | Slug | Vérif PariScore |
|-------|------|-----------------|
| Doctype HTML5 | `doctype` | `<!DOCTYPE html>` en ligne 1 de pariscore.html |
| Charset UTF-8 | `charset` | `<meta charset="UTF-8">` comme 1er élément du `<head>` |
| Viewport responsive | `viewport` | `<meta name="viewport" content="width=device-width, initial-scale=1">` |

### JavaScript
| Règle | Slug | Vérif PariScore |
|-------|------|-----------------|
| Jamais `eval()` / `innerHTML` non sécurisé | `avoid-eval` | ⚠️ **Vérifier** — pariscore.html utilise massivement `innerHTML`. Le XSS `_jsStr()` doit protéger les onclick |

### Performance
| Règle | Slug | Vérif PariScore |
|-------|------|-----------------|
| Largest Contentful Paint < 2.5s | `largest-contentful-paint` | ⚠️ pariscore.html = 8500 lignes → LCP probablement dégradé |

### Accessibility
| Règle | Slug | Vérif PariScore |
|-------|------|-----------------|
| Labels associés aux champs | `form-labels` | Vérifier les `<input>` des modales (login, paramètres) |
| Pas de `aria-hidden` sur `<body>` | `aria-hidden-body` | Vérifier |
| Navigation clavier complète | `keyboard-navigation` | ⚠️ Modales tennis, spider charts — test Tab/Enter |
| Tous les inputs ont un nom accessible | `aria-input-field-name` | Vérifier |
| Pas de contenu clignotant (seizures) | `flashing-content` | OK (pas d'animations agressives) |

---

## 🟠 HIGH (impact majeur UX/perf/a11y/SEO)

### HTML
| Règle | Slug | Note |
|-------|------|------|
| Scripts en `defer`/`async` | `defer-async` | ⚠️ pariscore.html = inline JS (pas applicable directement, mais vérifier les `<script src>`) |
| Éléments sémantiques HTML5 | `html5-semantic-elements` | `<header>`, `<main>`, `<section>`, `<footer>` |
| Attribut `lang` sur `<html>` | `lang-attribute` | `<html lang="fr">` |
| IDs uniques | `unique-id` | ⚠️ Vérifier les IDs générés dynamiquement |
| Subresource Integrity (SRI) | `subresource-integrity` | Si CDN externe utilisé |
| Types de input sémantiques | `input-types` | `type="email"`, `type="number"`, etc. |
| Validation de formulaires accessible | `form-validation` | |
| HTML conforme W3C | `w3c-compliant` | Validator.w3.org |

### CSS
| Règle | Slug | Note |
|-------|------|------|
| Pas de CSS inline/embarqué | `embedded-or-inline-css` | ⚠️ pariscore.html a probablement du `<style>` inline |
| CSS critique inline | `css-critical` | Above-the-fold |
| CSS non-bloquant | `css-non-blocking` | |
| Minification CSS | `css-minification` | |
| CSS custom properties (design tokens) | `css-custom-properties` | Variables CSS pour thème |
| Focus indicators visibles | `focus-styles` | ⚠️ Ne jamais `outline: none` sans alternative |
| Unités relatives (rem/em) | `responsive-units` | Au lieu de `px` fixes |
| Animations sur transform/opacity | `animation-performance` | GPU, pas layout-trigger |
| Ordre CSS avant JS | `css-order` | |
| Spécificité CSS basse et plate | `specificity-management` | Éviter `!important` |
| Dark mode (`prefers-color-scheme`) | `dark-mode-css` | |
| Supprimer le CSS inutilisé | `unused-css` | |

### JavaScript
| Règle | Slug | Note |
|-------|------|------|
| Pas de JS inline | `javascript-inline` | ⚠️ pariscore.html = massivement inline (archi vanilla) |
| Gestion d'erreurs (`try-catch`) | `error-handling` | Pattern IIFE `.catch(err)` |
| Debounce/throttle | `debounce-throttle` | Scroll, resize, input |
| Prévenir les memory leaks | `memory-leaks` | Event listeners oubliés, timers |
| `const`/`let` au lieu de `var` | `const-let` | ⚠️ PariScore = ES5 (`var`) |
| Minification JS | `javascript-minification` | |
| `JSON.parse` avec try/catch | `json-safety` | |
| Validation runtime des données externes | `runtime-validation` | API responses |
| Cross-origin sécurisé (CORS) | `cross-origin-security` | |
| DOM read/write batchés | `dom-performance` | Layout thrashing |
| Code splitting / lazy load | `code-splitting` | ⚠️ HTML inline = pas applicable |
| Console nettoyée en prod | `console-cleanup` | |

### Performance
| Règle | Slug | Note |
|-------|------|------|
| LCP < 2.5s | `largest-contentful-paint` | |
| CLS (Cumulative Layout Shift) | `cumulative-layout-shift` | Images sans dimensions |
| INP (Interaction to Next Paint) | `interaction-to-next-paint` | |
| WebPageTest | `webpagetest` | |
| Lighthouse audit | `lighthouse` | |
| Service worker (offline) | `service-worker` | PWA |
| Préchargement (`preload`) | `preload` | |
| Préconnexion (`preconnect`) | `preconnect` | API football, Odds API |
| Minimiser chaînes de requêtes critiques | `critical-request-chains` | |
| Lazy load non-critique au viewport | `import-on-visibility` | |
| Lazy load sur interaction | `import-on-interaction` | |

### Accessibility (sélection — 95 règles au total)
| Règle | Slug | Note |
|-------|------|------|
| Texte alternatif images | `alt-text` | Logos, icônes, graphiques |
| Contraste couleurs WCAG | `color-contrast` | AA: 4.5:1 texte normal |
| Skip to main content | `skip-link` | `<a href="#main">` |
| ARIA correct | `aria-allowed-attr` | |
| Landmarks (header, main, nav, footer) | `landmark-roles` | |
| Focus visible modales | `focus-trap` | Modales tennis |
| Déscription liens | `link-purpose` | Pas "cliquez ici" |
| Responsive (zoom 200%) | `reflow` | Pas de scroll horizontal |

### SEO (sélection — 94 règles au total)
| Règle | Slug | Note |
|-------|------|------|
| `<title>` unique par page | `title` | |
| Meta description | `meta-description` | |
| URL canonique | `canonical-url` | |
| Open Graph | `open-graph` | Facebook, partage |
| Sitemap.xml | `sitemap` | |
| robots.txt | `robots-txt` | |
| Données structurées (JSON-LD) | `structured-data` | |
| HTTPS forcé | `https` | |
| Core Web Vitals | `core-web-vitals` | |

### Security (sélection — 22 règles au total)
| Règle | Slug | Note |
|-------|------|------|
| HTTPS partout | `https` | |
| CSP (Content-Security-Policy) | `content-security-policy` | ⚠️ Important pour pariscore.html |
| En-têtes de sécurité | `security-headers` | HSTS, X-Frame-Options |
| `rel="noopener"` liens externes | `noopener` | `target="_blank"` |
| Pas de secrets dans le JS client | `no-secrets-client` | ⚠️ Clés API |
| Validation côté serveur | `server-validation` | server.js |

### Images
| Règle | Slug | Note |
|-------|------|------|
| `width`/`height` sur `<img>` | `image-dimensions` | Anti CLS |
| `loading="lazy"` | `image-lazy-loading` | |
| `srcset`/`sizes` (responsive) | `responsive-images` | |
| Format moderne (WebP/AVIF) | `modern-image-formats` | |
| `alt` text | `alt-text` | |

---

## 📡 Comment accéder aux 390 règles complètes

### Via le MCP (recommandé)
```
# Dans ZCode/OpenCode, le MCP frontendchecklist expose 11 outils :
list_categories              → Liste les 11 catégories avec compteurs
search_rules "modal"         → Cherche par mot-clé
get_rule "avoid-eval"        → Détail complet d'une règle
review_code "<HTML>"         → Audit un snippet de code
audit_url "https://..."      → Audit une URL publique
get_workflow "accessibility" → Workflow d'audit guidé
```

### Via le site
- Browse : https://frontendchecklist.io/rules
- Catégories : html, css, javascript, performance, accessibility, seo, security, images, testing, privacy, i18n
