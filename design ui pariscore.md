# 🎨 Rapport d'Analyse UI & Charte Graphique : Stratégie Premium "Betmart"

Ce rapport décortique l'identité visuelle, la hiérarchie structurelle et les composants graphiques de l'image de référence `designui.jpg`. L'objectif est de transcrire ces règles en spécifications techniques et visuelles directement applicables pour harmoniser l'expérience de trading et d'analytics sportifs sur Pariscore.fr.

---

## 1. Palette de Couleurs & Équilibre Chromatique (Charte Master)

L'interface utilise une distribution stricte de type **60-30-10** (60% de couleur dominante, 30% de couleur secondaire, 10% d'accents) pour maximiser le focus sur les données sans fatiguer l'œil en environnement sombre.

### A. Les Fonds & Surfaces (60%)
* **Fond Principal (Master Background) :** `#0b0e17` à `#0e121e`. Un bleu nuit très sombre, presque noir, qui élimine le contraste agressif des noirs purs.
* **Surfaces des Encarts (Card Backgrounds) :** `#131722` à `#161c2a`. Un ton légèrement plus clair et bleuté pour détacher physiquement les blocs de données du fond.

### B. Les Textes & Frontières (30%)
* **Textes Principaux & Valeurs :** `#ffffff` (Bolds, Cotes, Noms d'équipes). High-contrast pour une lisibilité immédiate.
* **Textes Secondaires & Labels :** `#707e94` à `#94a3b8` (Gris technique / Slate). Utilisé pour la sous-navigation, les libellés de lignes et les indications temporelles.
* **Bordures subtiles (Borders) :** `rgba(255, 255, 255, 0.05)` à `0.08`. Une ligne ultra-fine d'un pixel pour délimiter les structures sans surcharger le design.

### C. Les Couleurs d'Accentuation & Signaux (10%)
* **Vert Néon "Action & Succès" :** `#00e676` ou `#10b981`. Utilisé pour les boutons d'action principaux (Sign Up, Register, Place Bet), les sélections actives et les variations positives (EV+).
* **Bleu Électrique "Sélection Contextuelle" :** `#0077ff` ou `#38bdf8`. Dédié au focus utilisateur (ex: l'onglet de sport sélectionné "Soccer", les montants de mise rapides "10$").
* **Orange/Rouge "Alerte & Direct" :** `#ff3d00` ou `#ef4444`. Exclusivement réservé aux indicateurs de criticités temporelles (le badge "LIVE" ou "1st half").

---

## 2. Typographie & Hiérarchie des Textes

Le tableau utilise une police sans-serif géométrique de type **Inter**, **Roboto** ou **Poppins**, hautement lisible en petite taille sur écran OLED/LCD.

* **KPI & Cotes Principales :** Style `Font-Weight: 800` (Extra-Bold), couleur blanche ou verte, taille imposante. Les nombres doivent sauter aux yeux.
* **Titres de Modules (ex: "Top Matches", "Live Matches") :** Style `Font-Weight: 700` (Bold), lettres capitales avec de légers icônes graphiques de couleur en préfixe (comme la couronne orange ou les ondes lives).
* **Données de Tableau (Noms des joueurs/équipes) :** Style `Font-Weight: 600` (Semi-Bold), texte blanc.
* **Métadonnées (Dates, Heures, Pays) :** Style `Font-Weight: 400` (Regular), taille réduite (11px-12px), couleur gris bleuté.

---

## 3. Anatomie des Encarts & Composants (Layout)

L'un des points forts de l'image `designui.jpg` est la **délimitation chirurgicale** de ses blocs. Aucun élément ne flotte de manière désordonnée.

### A. Les Cartes Horizontales (Match Rows)
Chaque ligne de match ou de prédiction est traitée comme un conteneur indépendant :
* **Structure :** Une boîte rectangulaire avec un `border-radius: 6px` ou `8px`.
* **Effet de profondeur :** Une fine bordure intérieure supérieure (`inset`) imitant un léger reflet de verre.
* **Agencement interne :** Alignement strict en grille (Grid/Flex). À gauche, les informations d'identification (Drapeau/Pays, Statut, Heure). Au centre, les acteurs (Noms des équipes/joueurs, scores intermédiaires). À droite, les zones d'action cliquables (les blocs de cotes).

### B. Les Blocs de Cotes (Odds Boxes)
* Elles agissent comme des micro-boutons encastrés.
* Le fond d'une boîte de cote non sélectionnée est plus sombre (`#0b0e17`) que la carte qui la contient, simulant un creux dans l'interface.
* **Hover state (Survol) :** Changement de couleur radical vers le Bleu Électrique ou le Vert Néon avec une lueur discrète (`box-shadow: 0 0 10px rgba(...)`).

### C. La Barre de Filtres & Sous-Navigation
* La barre de filtres (où se trouvent les sports ou les filtres "LIVE", "TOP") utilise des icônes minimalistes monochromes en fil de fer.
* L'élément actif supprime son fond sombre pour se parer d'un aplat de couleur vive (Bleu Électrique), ce qui crée un ancrage visuel immédiat pour l'utilisateur.

---

## 4. Extraction du Code CSS (Composants Clés)

### COMPOSANT A : LE SÉLECTEUR DE SPORTS HORIZONTAL
```css
.pariscore-sports-nav-container {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 8px !important;
    background: #131722 !important;
    padding: 8px 12px !important;
    border-radius: 8px !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
    overflow-x: auto;
}

.sport-nav-item {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    background: #0e121e !important;
    border: 1px solid rgba(255, 255, 255, 0.04) !important;
    border-radius: 6px !important;
    padding: 8px 16px !important;
    color: #94a3b8 !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    cursor: pointer;
    transition: all 0.2s ease !important;
}

.sport-nav-item.active {
    background: #0077ff !important;
    color: #ffffff !important;
    border-color: #0077ff !important;
    box-shadow: 0 4px 12px rgba(0, 119, 255, 0.3) !important;
}