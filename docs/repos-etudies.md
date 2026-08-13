# Repos étudiés — ParisScore

> Registre des dépôts externes étudiés et installés pour l'écosystème
> OpenCode / Cline / ParisScore. Une section par repo : descriptif,
> points forts pour nous, installation, statut.

---

## 1. cathrynlavery/diagram-design

| Champ | Valeur |
|---|---|
| URL | https://github.com/cathrynlavery/diagram-design |
| Auteur | Cathryn Lavery (fondatrice BestSelf.co, littlemight.com) |
| Licence | MIT |
| Popularité | ~8,6k stars, ~560 forks, 56 commits (créé 2026-04) |
| Version installée | 2.2 |
| Statut | ✅ INSTALLÉ — OpenCode + Cline + ParisScore |

### Descriptif détaillé

Un **skill agent** (Claude Code / Codex / Pi / OpenCode) qui génère des
**diagrammes de qualité éditoriale** en HTML autonome avec SVG inline —
**sans build step, sans JavaScript, sans images externes**. L'auteure l'a
construit parce que les diagrammes produits par Claude étaient des « boîtes
arrondies génériques » qui ne ressemblaient à rien du site.

**27 types de diagrammes**, chacun en 3 variantes (minimal light, minimal
dark, full-editorial) :

- **Structure** : Architecture, High-Level, IT current-state (modernisation),
  Nested (hiérarchie par containment), Tree, Org chart, Layer stack,
  Medallion (stockage multi-tiers), Data flow, DP integration, DP security matrix
- **Logique** : Flowchart, Swimlane, Process, State machine, Sequence
- **Analyse** : ER / data model, Timeline, Quadrant, Consultant 2×2, Radar/Spider,
  Venn, Pyramid/funnel, Gantt, Bar chart, Line chart, Scatter plot
- **V2.0+** : Loop / Flywheel (avec hub mémoire partagée, write-backs en pointillés)

**Design system opinionné** (le cœur du projet) :

- 1 couleur d'accent, 1–2 éléments focaux max par diagramme (densité cible 4/10)
- 3 familles de polices : Instrument Serif (titres), Geist sans (noms de noeuds),
  Geist Mono (sublabels techniques : ports, URLs, types)
- Border-radius max 10px, pas d'ombres, tous les écarts divisibles par 4
  (« c'est ce qui évite le rendu AI-generated »)
- 55 icônes monochrome IT/cloud en `currentColor` (Tabler Icons MIT +
  Simple Icons CC0)

**Branding en 60 secondes** : l'agent lit votre site web (ou un dossier de
design-system, ou un autre skill), extrait palette + fonts, les mappe sur des
rôles sémantiques (`paper`, `ink`, `muted`, `accent`, `link`) et écrit
`references/style-guide.md`. **Vérification WCAG AA de contraste automatique**
(ink sur paper aux tailles 9–12px). Gate de premier run : refuse de livrer
des diagrammes avec le skin par défaut dans un projet brandé sans demander
onboarding / tokens manuels / défaut explicite.

**Accessibilité par défaut** : chaque SVG inline a `role="img"`,
`aria-labelledby` résolvant, `<title>`/`<desc>` enfants, IDs préfixés par
variante (multi-export sans collision), icônes décoratives masquées aux AT.

**Import de diagrammes existants** (point fort) :

- **draw.io / diagrams.net** : `.drawio`, `.drawio.xml`, `.drawio.png`
  (diagramme embarqué), `.drawio.svg` — y compris payloads compressés base64.
  Extraction via `scripts/drawio_extract.py` → IR structuré.
- **Mermaid** : `.mmd`, `.mermaid`, blocs fenced dans le Markdown, parsing
  texte pur (pas de renderer JS). Extraction via `scripts/mermaid_extract.py`.
- **4 dials de sortie** : Format (html/svg/png/html+png), Size (doc-inline,
  slide-16x9, social-og, print-a4…), Detail (faithful≤24 noeuds / balanced≤12 /
  simplified≤7), Audience (engineer / mixed / executive — change le wording,
  pas le compte).
- **Fidelity ledger** : chaque import se termine par un rapport de ce qui a
  été fusionné, collapse ou supprimé (ex. « 12 noeuds source → 8 dessinés »).
- Ce qui ne passe jamais : coordonnées source, palette source, fonts source,
  « spaghetti de connecteurs diagonaux » draw.io.

**Export** : `/diagram-design:export` → SVG (extrait le noeud `<svg>` + fonts
Google injectées, s'ouvre dans Figma/Illustrator) ou PNG (rasterisation
Playwright 2×, `pip install playwright && playwright install chromium`).

**Architecture du skill** : progressive disclosure — `SKILL.md` est un index
léger (philosophie, sélection de type, checklist, design system) ; chaque type
vit dans `references/type-*.md` chargé seulement quand nécessaire (37 fichiers
de référence au total). Ajout d'un type = un fichier `type-<nom>.md` + câblage.

### Les + pour nous (ParisScore)

1. **Documentation d'architecture immédiate** : le monolithe legacy
   (`server.js` 7578 lignes, `pariscore.html` 8507 lignes, migration Next.js
   en cours) est un terrain parfait pour des diagrammes Architecture,
   IT current-state et Data flow — enfin lisibles pour la migration.
2. **Hit avec l'existant** : le pipeline Rankings (scrape soccerstats → JSON
   CDN Vercel), le système de stratégies (STRATEGIES ↔ STRATEGIES_UI) et les
   flux API (API-Football, Odds API, Gemini) peuvent être schématisés en
   flowcharts / sequence / data-flow dans les `.context/` et `docs/`.
3. **Gantt natif** : le planning `pariscore-predict-planning` (Gantt hors
   repo) peut être régénéré proprement côté docs au lieu de fichiers SVG
   maintenus à la main.
4. **Import Mermaid existant** : le graphe Graphify (`.graphify/`) et tout
   diagramme Mermaid des docs peuvent être redessinés au style éditorial sans
   refaire le contenu — avec le fidelity ledger pour connaître les pertes.
5. **Alignement design system** : onboarding URL → `https://pariscore.fr`
   (dark navy + vert néon `#00e676`) → tous les diagrammes prennent les tokens
   du site automatiquement, cohérents avec `DESIGN_CHARTER.md` / shadcn.
6. **WCAG AA + a11y par défaut** : cohérent avec l'audit a11y déjà mené sur le
   projet (skills accessibility) — pas de diagrammes inaccessibles.
7. **Zéro dépendance de build** : HTML autonomes directement ouvrés dans le
   navigateur — parfaits pour être commités dans le repo et servis dans Vercel.
8. **Anti-AI-slop** : le design system est exactement le standard « Hallmark /
   anti-slop » déjà adopté côté frontend (pas d'ombres, grille 4px, accent
   unique) — les diagrammes ne jureront plus avec l'UI.
9. **Multi-agent unifié** : un seul dossier partagé (clone unique + junctions)
   pour OpenCode, Cline et les agents de `.agents/` — même source de vérité
   que la mécanique skills existante.
10. **Export PNG/SVG pour contenus** : le site a des pages de stratégies et
    insights — les diagrammes peuvent devenir des visuels social-og ou des
    images de blog, exportés en PNG 2×.

### Installation faite (editable install, clone + junctions)

```text
Clone unique      : C:\Users\David\ZCodeProject\diagram-design
                     (vue "éditable" : style-guide.md personnalisable survivra aux updates git pull)

OpenCode (projet) : C:\Users\David\ZCodeProject\pariscore\.opencode\skills\diagram-design   (junction)
Agents            : C:\Users\David\ZCodeProject\pariscore\.agents\skills\diagram-design     (junction)
Cline             : C:\Users\David\.cline\skills\diagram-design                             (junction)
                     → toutes → C:\Users\David\ZCodeProject\diagram-design\skills\diagram-design
```

### Usage

```text
# Onboarding branding (1 fois) — palette + fonts de pariscore.fr
"onboard diagram-design to https://pariscore.fr"

# Diagramme direct
"Make me an architecture diagram: Next.js 16 app router, API routes, Prisma/SQLite, SWR CDN rankings."

# Import + redraw
/diagram-design:import platform.drawio --size=slide-16x9 --detail=simplified --audience=executive
/diagram-design:import-mermaid architecture.mmd --detail=balanced

# Export (nécessite Playwright pour PNG : pip install playwright && playwright install chromium)
/diagram-design:export docs/archi.html --png-only --scale=3
```

### Notes

- 📌 Au premier diagramme généré dans le projet, le skill s'arrête et demande
  onboarding. Répondre (a) avec l'URL du site.
- 📌 Mettre à jour : `git -C C:\Users\David\ZCodeProject\diagram-design pull`
  (les junctions suivent automatiquement — c'est l'intérêt du clone).
- 📌 Désinstaller : supprimer les 3 junctions (le clone peut rester ou être
  supprimé).
- Exemple de rendu à consulter : ouvrir
  `C:\Users\David\ZCodeProject\diagram-design\skills\diagram-design\assets\index.html`
  (galerie 27 diagrammes, onglets light/dark/editorial).

---

<!-- Ajouter ci-dessous : ## 2. <repo> — même structure -->