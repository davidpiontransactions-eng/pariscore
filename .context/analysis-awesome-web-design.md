# Analyse Comparative : awesome-web-design vs Pariscore

> **Dépôt source**: [nicolesaidy/awesome-web-design](https://github.com/nicolesaidy/awesome-web-design) (2.8k ⭐, CC0-1.0)
> **Date d'analyse**: 2026-08-25
> **Objectif**: Identifier les ressources design adoptables pour améliorer notre config

---

## 1. Vue d'ensemble

| Aspect | awesome-web-design | Pariscore |
|--------|-------------------|-----------|
| **Nature** | Curated list (awesome list) | Application web sportive (Next.js 16 + Bun) |
| **Focus** | Ressources design web | Scraping, betting, mobile |
| **Format** | Markdown list | Full-stack app |
| **Contenu** | 500+ ressources | 60+ skills |
| **Mise à jour** | Community PRs | Active development |

---

## 2. Contenu de la List

### 2.1. Catégories

| Catégorie | Ressources | Description |
|-----------|------------|-------------|
| **Blog & News** | 11 | Actualités design |
| **Inspiration** | 8 | Galeries, portfolios |
| **Colors** | 9 | Palettes, gradients, tools |
| **Typography** | 8 | Fonts, pairings, scale |
| **Icons** | 9 | Icon sets, generators |
| **Images** | 6 | Stock photos, placeholders |
| **Guidelines** | 5 | Design principles |
| **Design Tools** | 6 | Figma, Sketch, etc. |
| **Prototype Tools** | 5 | Prototyping platforms |
| **Tutorials** | 6 | Learning resources |
| **Books** | 5 | Design books |
| **Productivity** | 5 | Productivity tools |
| **Slack Teams** | 4 | Communities |

### 2.2. Ressources Clés

| Catégorie | Ressource | Description | Utile pour Pariscore |
|-----------|-----------|-------------|---------------------|
| **Colors** | Coolors | Generate color palettes | ✅ Palette betting UI |
| **Colors** | Gradients.io | Curated gradients | ✅ Gradient cards |
| **Typography** | Fontpair | Google Font combinations | ✅ Font pairing |
| **Typography** | Type Scale | Preview type scales | ✅ Typography system |
| **Icons** | Material Icons | Free material icons | ✅ Icon system |
| **Guidelines** | Laws of UX | UX principles | ✅ UX improvements |
| **Guidelines** | Google Material Design | Material principles | ✅ Design system |

---

## 3. Patterns Avancés Identifiés

### 3.1. Curated List Format (++)

**Notre config** : Pas de curated list pour les ressources design.

**Leur approche** : Liste structurée avec :

```markdown
## Category

-   [Resource Name](link): Short description.
```

**+ Adoptable** : Créer une curated list pour nos ressources design internes.

---

### 3.2. Contribution Guidelines (++)

**Notre config** : CONTRIBUTING.md existant.

**Leur approche** : Guidelines spécifiques aux listes :

```markdown
- Only submit something unique and generally useful.
- Make an individual pull request for each suggestion.
- Use the following format: `[package](link): Description.`
- Additions should be added to the bottom of the relevant category.
- Keep descriptions short and simple, but descriptive.
```

**+ Adoptable** : Enrichir notre CONTRIBUTING.md avec des guidelines par type de contribution.

---

### 3.3. Design Resources Integration (++)

**Notre config** : DESIGN_CHARTER.md (tokens).

**Leur approche** : Ressources externes pour :
- **Colors** — Coolors, Adobe Color, Paletton
- **Typography** — Google Fonts, Fontpair, Type Scale
- **Icons** — Material Icons, Font Awesome
- **Images** — Pexels, Unsplash
- **Guidelines** — Laws of UX, Material Design

**+ Adoptable** : Intégrer ces ressources dans notre workflow design.

---

### 3.4. Inspiration Gallery (++)

**Notre config** : `.agents/design-md/` (74 DESIGN.md).

**Leur approche** : Galeries d'inspiration :
- Awwwards — Best web design trends
- Dribbble — Show and tell for designers
- Behance — Showcase & discover creative work
- One Page Love — Single Page websites

**+ Adoptable** : Ajouter des liens vers ces galeries dans notre DESIGN_CHARTER.md.

---

### 3.5. Design Tools Reference (++)

**Notre config** : Pas de liste d'outils design.

**Leur approche** : Liste des outils :
- Figma — Collaborative interface design
- Sketch — Digital design for Mac
- Adobe XD — Prototyping & wireframing
- Canva — Graphic design software

**+ Adoptable** : Créer une liste des outils recommandés pour contribuer à Pariscore.

---

### 3.6. Typography System (++)

**Notre config** : TailwindCSS typography.

**Leur approche** : Ressources typography complètes :
- Google Web Fonts — Open source fonts
- Fontpair — Font combinations
- Type Scale — Preview type scales
- Typewolf — Web typography info

**+ Adoptable** : Utiliser ces ressources pour définir notre typographie.

---

### 3.7. Color System (++)

**Notre config** : DESIGN_CHARTER.md (dark navy + vert néon).

**Leur approche** : Ressources couleurs :
- Coolors — Generate palettes
- Adobe Color CC — Color wheel
- Gradients.io — Curated gradients
- UI Gradients — Beautiful gradients

**+ Adoptable** : Utiliser ces outils pour enrichir notre palette.

---

### 3.8. Icon System (++)

**Notre config** : Lucide icons (shadcn/ui).

**Leur approche** : Ressources icônes :
- Material Icons — Free material icons
- Font Awesome — Iconic font
- Ionicons — Premium icon font
- The Noun Project — Icons for everything

**+ Adoptable** : Évaluer ces alternatives pour notre système d'icônes.

---

## 4. Ce que Nous Faisons Mieux

| Aspect | Notre avantage |
|--------|----------------|
| **Application** | Full-stack app vs curated list |
| **Design System** | DESIGN_CHARTER.md + tokens vs links |
| **Components** | 60+ React components vs resources |
| **MCP Servers** | 11 servers vs 0 |
| **Skills** | 60+ skills vs curated list |
| **Production** | App de production vs reference list |

---

## 5. Améliorations Recommandées pour Pariscore

### Priorité Haute (Impact immédiat)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 1 | **Design Resources doc** — Liens utiles | Faible | Élevé |
| 2 | **Contribution format** — Guidelines par type | Faible | Moyen |
| 3 | **Inspiration links** — Galeries recommandées | Faible | Moyen |

### Priorité Moyenne (Impact à terme)

| # | Amélioration | Effort | Impact |
|---|--------------|--------|--------|
| 4 | **Typography system** — Font pairing officiel | Moyen | Élevé |
| 5 | **Color palette** — Outils de génération | Moyen | Moyen |
| 6 | **Icon library** — Alternatives à Lucide | Moyen | Moyen |

---

## 6. Ressources à Intégrer

### Colors

| Ressource | Usage | Lien |
|-----------|-------|------|
| **Coolors** | Generate color palettes | https://coolors.co |
| **Adobe Color CC** | Color wheel + schemes | https://color.adobe.com |
| **Gradients.io** | Curated gradients | http://gradients.io |
| **UI Gradients** | Beautiful gradients | http://uigradients.com |

### Typography

| Ressource | Usage | Lien |
|-----------|-------|------|
| **Google Fonts** | Open source fonts | https://fonts.google.com |
| **Fontpair** | Font combinations | https://fontpair.co |
| **Type Scale** | Preview type scales | http://type-scale.com |
| **Typewolf** | Web typography info | https://typewolf.com |

### Icons

| Ressource | Usage | Lien |
|-----------|-------|------|
| **Material Icons** | Free material icons | https://material.io/icons |
| **Font Awesome** | Iconic font | https://fontawesome.io |
| **Ionicons** | Premium icon font | http://ionicons.com |
| **The Noun Project** | Icons for everything | https://thenounproject.com |

### Images

| Ressource | Usage | Lien |
|-----------|-------|------|
| **Pexels** | Free stock photos | https://pexels.com |
| **Unsplash** | High quality photos | https://unsplash.com |
| **Pixabay** | Photos & illustrations | https://pixabay.com |

### Guidelines

| Ressource | Usage | Lien |
|-----------|-------|------|
| **Laws of UX** | UX principles | https://lawsofux.com |
| **Material Design** | Google's design system | https://material.google.com |
| **iOS HIG** | Apple's design guidelines | https://developer.apple.com/ios/human-interface-guidelines |

### Inspiration

| Ressource | Usage | Lien |
|-----------|-------|------|
| **Awwwards** | Best web design trends | https://awwwards.com |
| **Dribbble** | Design showcase | https://dribbble.com |
| **Behance** | Creative portfolios | https://behance.net |
| **One Page Love** | Single page websites | https://onepagelove.com |

---

## 7. Code Snippets Adaptables

### DESIGN_RESOURCES.md

```markdown
# Design Resources — Pariscore

## Colors

- [Coolors](https://coolors.co) — Generate color palettes
- [Adobe Color CC](https://color.adobe.com) — Color wheel + schemes
- [Gradients.io](http://gradients.io) — Curated gradients

## Typography

- [Google Fonts](https://fonts.google.com) — Open source fonts
- [Fontpair](https://fontpair.co) — Font combinations
- [Type Scale](http://type-scale.com) — Preview type scales

## Icons

- [Material Icons](https://material.io/icons) — Free material icons
- [Lucide](https://lucide.dev) — Our current icon library
- [The Noun Project](https://thenounproject.com) — Icons for everything

## Guidelines

- [Laws of UX](https://lawsofux.com) — UX principles
- [Material Design](https://material.google.com) — Google's design system
- [Pariscore DESIGN_CHARTER.md](./DESIGN_CHARTER.md) — Our design tokens

## Inspiration

- [Awwwards](https://awwwards.com) — Best web design trends
- [Dribbble](https://dribbble.com) — Design showcase
- [Behance](https://behance.net) — Creative portfolios
```

### CONTRIBUTING.md Addition

```markdown
## Contribution Format

### Adding a Component

1. Create component in `src/components/<category>/`
2. Follow naming: `<descriptive-name>.tsx`
3. Update `COMPONENTS.md`
4. Add to `src/components/STRUCTURE.md`
5. Include screenshot in PR

### Adding a Skill

1. Create skill in `.opencode/skills/<skill-name>/`
2. Follow structure: `SKILL.md` + optional `index.ts`
3. Update `skills` list in AGENTS.md
4. Test with opencode and cline
5. Include usage example in PR

### Updating Design Tokens

1. Edit `DESIGN_CHARTER.md`
2. Update CSS variables in `globals.css`
3. Verify dark/light mode
4. Include before/after screenshots in PR
```

---

## 8. Conclusion

**awesome-web-design** est une excellente **curated list de ressources design**. Ses forces principales sont :

1. **Curated List Format** — Liste structurée et maintenue
2. **Contribution Guidelines** — Guidelines claires
3. **Design Resources** — 500+ ressources catégorisées
4. **Inspiration Gallery** — Liens vers Awwwards, Dribbble, Behance
5. **Design Tools** — Figma, Sketch, Adobe XD
6. **Typography System** — Google Fonts, Fontpair, Type Scale
7. **Color System** — Coolors, Adobe Color, Gradients
8. **Icon System** — Material Icons, Font Awesome

**Notre avantage** : Nous avons une application de production avec un design system complet (DESIGN_CHARTER.md), 60+ composants React, et 11 MCP servers. awesome-web-design est une liste de ressources, nous sommes une app complète.

**Recommandation** : Créer un `DESIGN_RESOURCES.md` avec les ressources utiles, et ajouter des liens dans notre DESIGN_CHARTER.md.

---

## 9. Intégration Recommandée

### Nouveaux Fichiers

```
DESIGN_RESOURCES.md      # Ressources design curatées
```

### Mise à Jour

```
DESIGN_CHARTER.md        # Ajouter section "External Resources"
```
