# Analyse Comparative Design — 5 Sites de Prédictions/Data Sportives

**Date : 20/08/2026** · Méthode : capture automatisée Playwright (1440×900 + mobile 390) + extraction tokens DOM (`.context/design-compare/`) · Cible : implémentation du meilleur sur PariScore

## Les 5 sites analysés

| Site | Positionnement | Fond | Typo | Densité data |
|------|---------------|------|------|--------------|
| **Sofascore** | Référence UX + data (dark/light, stats, heatmaps) | Light #EDF1F6 | Sofascore Sans 16px + Condensed | Moyenne (rows 27px) |
| **FotMob** | Référence UI/design (prix du design d'app) | Light #FAFAFA | Walsheim 16px/14px | Forte (rows 15px) |
| **Flashscore** | Référence data massive (résultats en direct) | Light #EEE + header navy | 13px (7000+ éléments) | Très forte |
| **Forebet** | Prédictions/odds (concurrent direct) | Light, quasi vide | system-ui | Faible |
| **WhoScored** | Stats avancées | Light | Lato 13px | Moyenne (rows 53px) |

## Ce que font les meilleurs (Sofascore + FotMob + Flashscore)

### 1. Graphisme & couleur
- **Mode clair + 1 seul accent** : fond gris neutre (#EDF1F6 / #FAFAFA / #EEE), texte noir, **un accent unique** — bleu (#375DF5 Sofascore / #1967D2 FotMob) — pour liens et éléments actifs, **rouge vif (#FF0046 Flashscore / #CB1818 Sofascore) réservé au LIVE**
- **Header sombre contrasté** : Flashscore utilise un header navy (#001E28) sur fond clair → très forte identité. C'est exactement l'inverse de PariScore (fond navy + accents)
- **Palette extraite** : gris dominants (#606060 ≈ 26-51%), blanc (#F8F8F8), noir — les accents colorés représentent <5% de l'écran
- **Aucune ombre portée** : cartes plates avec bordures fines ou séparateurs

### 2. Typographie (échelle type)
| Site | Échelle dominante |
|------|-------------------|
| Sofascore | 16px (3492) → 14px (1260) → 12px (572) — **3 crans hiérarchiques nets** |
| FotMob | 16px (5853) + 14px (5806) — deux niveaux presque égaux, 10px pour micro-labels |
| Flashscore | 13px (7009) — data ultra-dense |
| **PariScore actuel** | **16px (4648) → 11px (4110) → 12px (964)** — gros écart 16→11, pas de palier 14px |

### 3. Ergonomie
- **Header sticky compact** : FotMob 81px, PariScore 56px ✓ (déjà bon)
- **Navigation sport persistante** : tabs sport avec icônes + fond flouté du sport actif (Sofascore, 31 tabs ; FotMob 47)
- **Listes data denses avec hover** : rows 15-27px, séparateurs fins, hover row entier (pas de cartes flottantes)
- **Score ultra-lisible** : chiffres en font condensée/display, taille dominante dans la ligne
- **État live omniprésent** : pastille rouge + score animé
- **Contenu par page** : sections très longues (Flashscore 12 000px, Sofascore 7 200px) — scroll continu > pagination

## Ce que Forebet rate (à ne pas imiter)
- Page blanche presque vide (peu de données visibles), aucun design system, pas de hiérarchie — juste un produit fonctionnel data

## Comparatif direct avec PariScore

| Critère | Meilleurs (Sofa/FotMob/Flash) | PariScore | Écart |
|---------|-------------------------------|-----------|-------|
| Identité | Light + 1 accent + header sombre | Dark navy + vert néon (charte) | Design system solide — garder |
| Accent actif | Bleu partout (liens, onglets, active) | Vert néon présent mais 105/301 vs blanc | **Renforcer l'accent** |
| Échelle type | 16/14/12 + micro 10px | 16/11/12 — palier 14px absent | **Ajouter palier 14px**, limiter 11px |
| Cards | Plates, bordures fines, hover row | Cards 8px radius, sans ombre, empilées | **Densifier** (bordures + hover) |
| Onglets sport | Icône + fond sport actif flouté | ✅ déjà implémenté (SportTabs) | OK |
| Header | Sticky compact (56-81px) | Sticky 56px semi-transparent | OK |
| Live | Rouge vif + pastille | Vert néon (charte) — à conserver | OK |
| Densité liste | 15-27px entre rows | Cards empilées (plus de 27px) | **Réduire** |

## Le « meilleur » à implémenter sur PariScore

**Philosophie retenue** : conserver le dark navy + vert néon (charte = identité de marque, différentiation face aux 5 sites light), mais adopter les **patterns d'ergonomie et hiérarchie** des leaders :

1. **Échelle typographique à 4 paliers nets** (pattern Sofascore/FotMob) :
   - Titres/card : 14-16px (au lieu de 13-16px flous)
   - Data secondaire : 12-13px (au lieu de 11px massifs)
   - Micro-labels : 11px min (charte) — réduire le volume
2. **Accent vert néon renforcé sur les éléments actifs** : onglet actif, liens, badges live → vert ; texte neutre → blanc/gris (pattern accent unique)
3. **Cards → listes denses avec hover** : bordure fine au lieu d'empilement, hover row entier (pattern FotMob 15px)
4. **Score en font display (Archivo)** : déjà le cas pour les scores tennis ✓ — généraliser
5. **Séparateurs fins entre lignes de données** (pattern Flashscore)

## Implémentation prévue

| # | Changement | Fichiers | Risque |
|---|-----------|----------|--------|
| 1 | Échelle type : promouvoir data 11px→12/13px ciblé (cartes matchs, stats) | match-card.tsx + sous-composants | Faible |
| 2 | Accent vert sur onglet actif + liens (pattern accent unique) | sport-tabs.tsx | Faible |
| 3 | Densifier les matchs : border subtile + hover row (au lieu de cartes flottantes) | match-card.tsx | Moyen |
| 4 | Score display Archivo pour les scores (uniformiser) | match-card-header.tsx | Faible |

**Hors scope** (décision volontaire) : passer en light mode — la charte dark navy + vert néon est l'identité PariScore, la différence face aux concurrents light ; l'analyse montre que le light n'est pas un facteur de qualité en soi (Forebet est light et moche).