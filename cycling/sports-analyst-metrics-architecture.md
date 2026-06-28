# Architecture des métriques avancées — Prédiction cycliste PariScore

> Document d'architecture — Juin 2026
> Auteur : Sports Scientist & Data Analyst, PariScore
> Version : 1.0

---

## Table des matières

1. [ELO Spécifique par terrain](#métrique-elo-spécifique-par-terrain)
2. [VAM (Velocità Ascensionale Media)](#métrique-vam)
3. [W/kg Estimé](#métrique-wkg-estimé)
4. [Team Support Index](#métrique-team-support-index)
5. [Fatigue / Form Index (L30)](#métrique-fatigue--form-index-l30)

---

## Métrique: ELO Spécifique par terrain

- **Définition**: Système de rating bayésien adapté au cyclisme, où chaque coureur possède un score ELO distinct pour chaque type de profil de course (Montagne, Sprint, Contre-la-montre, Pavés/Classiques, Vallonné/Puncheur). Contrairement à un ELO global unique (qui dilue les spécialités), cette approche maintient 5 ratings orthogonaux mis à jour indépendamment selon le profil de la course.

- **Formule**:
  ```
  ELO_post = ELO_pre + K · I · (S − E)
  
  Où:
  - S = résultat observé (1 = victoire, 0.5 = podium, 0.33 = top-5, 0 = other)
  - E = probabilité attendue = 1 / (1 + 10^((ELO_adversaire − ELO_coureur) / 400))
  - K = K-factor variable = K_base × Multiplicateur_importance
  
  K_base = 32 (étapes standard)
  K_base = 48 (courses World Tour)
  K_base = 64 (Monuments / Grands Tours)
  
  Multiplicateur_importance:
  - Étape plate: 0.5
  - Étape montagne: 1.5 (pour ELO montagne)
  - Étape CLM: 2.0 (pour ELO CLM)
  - Classique pavés: 1.5 (pour ELO pavés)
  - GC final: 3.0
  ```
  
  Le système TrueSkill (Microsoft) peut remplacer ELO pur pour capturer l'incertitude :
  ```
  µ_post = µ_pre + (σ²_pre / c) · (S − P(win))
  σ_post = σ_pre · max(0, 1 − σ²_pre / c²)
  
  Où c² = σ²_pre + σ²_adversaire + β² (β = bruit de performance)
  Rating = µ − 3·σ (classement conservateur à 99% CI)
  ```

- **Sources données**:
  - ProCyclingStats (PCS) : historique complet des résultats par course
  - Classification des profils d'étape : PCS classe chaque étape (flat, hilly, mountain, TT)
  - Calendrier UCI World Tour / Pro Series
  - CyclingStage.com : profils détaillés pour validation
  - FirstCycling.com : données de profil alternatives

- **Méthode d'extraction**:
  1. Scraper PCS pour l'historique complet des résultats (5 saisons glissantes)
  2. Classer chaque course dans l'une des 5 catégories de terrain
  3. Initialiser ELO initial = 1500 + (points UCI × 0.5) pour les nouveaux coureurs
  4. Itérer sur chaque résultat chronologiquement
  5. Mettre à jour l'ELO du terrain correspondant uniquement
  6. Pour les coureurs nouveaux ou revenant de blessure, appliquer un ELO_fallback = moyenne pondérée des ELOs existants + régression vers 1500

- **Précision attendue**: 
  - Concordance avec les classements réels : ~60-65% pour top-10 sur Grand Tour
  - Comparable au NDCG@10 observé par Kholkine et al. (2021) : 0.75-0.80
  - Meilleure que l'ELO global unique (estimate : +8-12% de précision)
  - Limitations : ne capture pas la forme récente ni la fatigue ; nécessite combinaison avec L30

- **Application PariScore**:
  - Prédiction de classement GC : combinaison pondérée ELO_montagne (0.6) + ELO_CLM (0.3) + ELO_general (0.1)
  - Prédiction vainqueur classique : ELO_pavés / ELO_valloné selon profil
  - Match bets H2H : différence d'ELO terrain → probabilité implicite
  - Détection de spécialistes : coeff de Gini sur les 5 ELOs → score de versatilité

- **Valeur stratégique** (1-5): **5**
  - Métrique fondamentale, orthogonalise les forces des coureurs
  - Applicable à tous les types de paris (GC, étape, H2H, classements secondaires)
  - Combinable avec toutes les autres métriques

- **Implémentation**:
  ```python
  class CyclingEloSystem:
      def __init__(self):
          self.elos = {}  # rider_id -> {terrain: EloState}
          self.K_BASE = {'worldtour': 48, 'monument': 64, 'default': 32}
          self.TERRAIN_WEIGHT = {'flat': 0.5, 'mountain': 1.5, 'tt': 2.0, 
                                 'cobble': 1.5, 'hilly': 1.0}
      
      def expected_score(self, elo_a, elo_b):
          return 1 / (1 + 10**((elo_b - elo_a) / 400))
      
      def observed_score(self, position, field_size):
          if position == 1: return 1.0
          if position <= 3: return 0.8
          if position <= 5: return 0.6
          if position <= 10: return 0.4
          if position <= 20: return 0.2
          return 0.0
      
      def update(self, rider_id, terrain, position, field_size, 
                 race_importance='default', opponents_elo=None):
          K = self.K_BASE[race_importance] * self.TERRAIN_WEIGHT[terrain]
          S = self.observed_score(position, field_size)
          opp_avg = opponents_elo or 1500
          E = self.expected_score(self.elos[rider_id][terrain], opp_avg)
          delta = K * (S - E)
          self.elos[rider_id][terrain] += delta
          return delta
  
      def trueskill_update(self, team_ratings, rank):
          """Alternative TrueSkill pour intégrer effet d'équipe."""
          # µ_post = µ_pre + (σ²_pre / c) · (rank_surprise)
          pass
  ```

---

## Métrique: VAM

- **Définition**: Velocità Ascensionale Media — mètres de dénivelé positif grimpés par heure. C'est la métrique standard pour comparer la capacité des grimpeurs indépendamment de la pente. VAM = vitesse verticale pure.

- **Formule**:
  ```
  VAM = (dénivelé_total_ascension_mètres) / (temps_ascension_heures)
  
  Exemple: col de 1200m grimpé en 40 min → VAM = 1200 / 0.667 = 1800 m/h
  
  Relation empirique W/kg:
  W/kg ≈ VAM / 100   (règle générale)
  
  Normalisation scientifique (Frontiers 2025):
  W/kg_normalisé = W/kg / (masse_corporelle^0.32)
  → VAM_normalisée = VAM / (masse^0.32) × 100
  ```

- **Sources données**:
  - ProCyclingStats : temps des coureurs au sommet des cols (KOM timing)
  - FirstCycling.com : profils d'étape détaillés, distances et dénivelés par col
  - Strava segments : temps des pros sur les cols (via Strava API, segments publics)
  - CyclingStage.com : profils altimétriques SVG (extraction des pentes)
  - OpenStreetMap / Veloviewer : données altimétriques des cols
  - PCS KOM classification : points montagne par col (cat. 1-4, HC)

- **Méthode d'extraction**:
  1. **Pipeline extraction VAM post-course**:
     - Scraper PCS pour les temps de passage aux KOM sur chaque col classé
     - Associer chaque KOM à sa catégorie et son dénivelé (base de données de cols)
     - Calculer VAM = dénivelé / temps
  2. **Pipeline Strava**:
     - Identifier les segments de cols (via liste prédéfinie des cols WT)
     - Filtrer les efforts des coureurs pros (comptes vérifiés ou tagged)
     - Extraire le temps et la puissance publiée (si disponible)
  3. **Pipeline temps estimé**:
     - Si temps direct indisponible, estimer via vitesse moyenne et pente
     - t = distance_col / v_moyenne ; VAM = dénivelé / t
  4. **Base de données de cols**:
     - Préconstruire une table des cols WT (nom, altitude, pente_moy, distance, dénivelé)
     - Sources : cols-cyclisme.com, Climbfinder, OSM

- **Précision attendue**:
  - VAM direct (temps chronométré) : ±2% si timing PCS fiable
  - VAM estimé (via vitesse moyenne) : ±5-8%
  - Équivalence W/kg via VAM/100 : ±0.3 W/kg (valable pour pentes >5%)
  - Limitation : VAM ne capture pas l'efficacité aérodynamique, la drafting, ou la tactique
  - Frontières de validité : pentes <3% → VAM sous-estime W/kg (aéro domine)

- **Application PariScore**:
  - **Comparaison de grimpeurs** : VAM normalisé par masse^0.32 → classement objectif
  - **Prédiction d'attaque** : écart de VAM entre deux coureurs → probabilité de distancer
  - **Valeur sur étapes montagne** : VAM attendu vs opposition → probabilité top-3
  - **Détection de pic de forme** : VAM récent ≥ VAM historique × 1.05 → surperformance probable
  - **Maillot KOM** : VAM cumulé sur cols classés → favori montagne
  - **Prédiction temps sur col** : VAM estimé → temps d'ascension → time gaps

- **Valeur stratégique** (1-5): **4**
  - Métrique la plus robuste pour évaluer la capacité grimpeur
  - Applicable directement aux étapes montagne (majorité des décisions en GC)
  - Dépend de données parfois indisponibles ; nécessite heuristiques d'inférence

- **Implémentation**:
  ```python
  class VAMEstimator:
      def __init__(self):
          self.cols_db = {}  # col_id -> {name, elevation_gain, distance, avg_gradient}
          self.rider_vam = {}  # rider_id -> [{col_id, vam, date, race}]
      
      def compute_vam(self, elevation_gain_m, time_s):
          """VAM direct depuis temps chronométré."""
          return elevation_gain_m / (time_s / 3600)
      
      def estimate_from_speed(self, gradient_pct, speed_kmh):
          """Estimation W/kg puis VAM depuis vitesse et pente."""
          # Puissance nécessaire pour vitesse v sur pente p
          # P = (m·g·sin(θ) + 0.5·ρ·CdA·v² + m·g·Crr·cos(θ)) · v
          g, rho, Crr = 9.81, 1.2, 0.004
          theta = atan(gradient_pct / 100)
          v_ms = speed_kmh / 3.6
          CdA = 0.35  # moyenne peloton, descend à 0.25 en descente
          
          P_kg = (g * sin(theta) + 0.5 * rho * CdA * v_ms**2 + g * Crr * cos(theta)) * v_ms
          # P_kg en W/kg, VAM ≈ P_kg * 100 (empirique pour pentes >5%)
          return P_kg * 100 * (1 + 0.02 * max(0, 8 - gradient_pct))  
          # Correction pour pentes faibles (aéro)
      
      def normalized_vam(self, vam, mass_kg):
          """VAM normalisé par masse corporelle (Frontiers 2025)."""
          wkg = vam / 100
          return wkg / (mass_kg ** 0.32)
      
      def predict_climb_time(self, col_id, wkg_estimated, mass_kg=70):
          """Prédiction du temps d'ascension pour un col donné."""
          col = self.cols_db[col_id]
          power = wkg_estimated * mass_kg
          g = 9.81
          theta = atan(col['avg_gradient'] / 100)
          v = power / (mass_kg * g * sin(theta) + 0.5 * 1.2 * 0.35 * 1 + mass_kg * 9.81 * 0.004)
          time_h = col['distance'] / (v * 3.6)
          return time_h * 3600  # secondes
  ```

---

## Métrique: W/kg Estimé

- **Définition**: Estimation du rapport puissance/poids (W/kg) d'un coureur à partir de données observables (temps d'ascension, masse corporelle, pente). Permet d'inférer la puissance spécifique sans capteur direct. C'est le proxy le plus important de la performance grimpeur.

- **Formule**:
  ```
  Modèle physique complet (inverse du temps sur col connu):
  
  P_requise = P_gravité + P_aéro + P_roulement
  
  P_gravité = m · g · sin(arctan(pente/100)) · v
  P_aéro    = 0.5 · ρ · CdA · v³  
  P_roulement = m · g · Crr · cos(arctan(pente/100)) · v
  
  W/kg = P_requise / m
  
  Où:
  - m = masse coureur + vélo (kg) — estimation ~8kg pour le vélo
  - g = 9.81 m/s²
  - ρ = densité air ~1.2 kg/m³ (dépend altitude)
  - CdA = coefficient traînée × surface frontale (~0.30-0.40 m²)
  - Crr = coefficient résistance roulement (~0.003-0.005)
  - v = vitesse ascensionnelle (m/s) = distance_col / temps
  
  Simplification pratique (pentes >7%):
  W/kg ≈ VAM / 100
  car P_aéro devient négligeable (<10% de P_totale)
  
  Raffinement pour pentes modérées (3-7%):
  W/kg = (VAM/100) / (0.92 - 0.008 × pente + 0.015 × altitude_km)
  ```

- **Sources données**:
  - **Masse des coureurs** : PCS profils coureurs (poids déclaré, parfois obsolète)
  - **Temps d'ascension** : PCS KOM stage timing, FirstCycling, Strava segments
  - **Profils de col** : Climbfinder, cols-cyclisme.com, OpenStreetMap (altitude SRTM)
  - **Vitesse de course** : PCS résultats étape (temps + distance → vitesse moyenne)
  - **CdA par défaut** : littérature (0.30-0.40 selon position, vent)
  - **Météo altitude** : densité air via API météo (température, pression)

- **Méthode d'extraction**:
  1. **Phase offline (base de cols)**:
     - Constituer une base de 200+ cols WT avec : nom, distance, dénivelé, pente_moy, altitude_max
     - Pour chaque col, précalculer les coefficients physiques
     - Indexer par code course + étape PCS
  2. **Phase scraping temps**:
     - Scraper PCS après chaque étape montagne pour les temps de passage
     - Cross-check avec Strava (segments publics)
     - Si pas de temps explicite, estimer via speed_to_power
  3. **Phase estimation**:
     - Pour chaque coureur : W/kg_col = back-calcul depuis temps/pente
     - Moyenne glissante sur 5 derniers cols grimpés
     - Filtre : garder seulement pentes >4% pour minimiser erreur aéro
  4. **Ajustement masse**:
     - Si W/kg estimé mais masse connue → puissance absolue
     - Si masse obsolète (PCS pas mis à jour) → intervalle de confiance large

- **Précision attendue**:
  - Cols >7%, temps connu : ±0.2 W/kg (très bonne estimation)
  - Pentes 4-7% : ±0.3 W/kg
  - Pentes <4% : ±0.5 W/kg (aéro domine, trop d'inconnues)
  - Masse non mise à jour : erreur systématique ~5%
  - Effet drafting non mesuré : peut sous-estimer de 0.1-0.3 W/kg (coureur abrité)
  - **Valeur-clé** : meilleure métrique disponible pour comparer grimpeurs sans données Strava privées

- **Application PariScore**:
  - **Prédiction pur-sang grimpeur** : classer les coureurs par W/kg estimé → favoritisme montagne
  - **Évolution de forme** : W/kg sur 5 cols sur 2 semaines → détection montée en régime ou fatigue
  - **Poids du maillot leader** : GC leader → W/kg effectif (pression + responsabilité)
  - **H2H montagne** : écart de W/kg → probabilité de prendre du temps
  - **Détection anomalie** : W/kg > 6.5 en col >20min → possible dopage ou donnée erronée
  - **Calibration modèle physique** : VAM → W/kg → temps attendu sur col → time gaps

- **Valeur stratégique** (1-5): **5**
  - Proxy le plus direct de la capacité grimpeur (facteur discriminant #1 en GC)
  - Alimente directement VAM, prédiction de temps, et comparaisons H2H
  - Peut être recoupé avec l'ELO montagne pour validation croisée

- **Implémentation**:
  ```python
  class PowerEstimator:
      def __init__(self):
          self.rider_mass = {}  # rider_id -> mass_kg (from PCS)
          self.bike_mass = 8.0  # kg, standard
          self.cols_db = {}     # col_id -> ColProfile
          self.results_cache = {} # rider_id -> [(col_id, wkg, date)]
      
      def back_calc_power(self, col, time_s, mass_kg, altitude_m=0):
          """
          Back-calculate W/kg from climb time.
          Martin et al. (1998) model.
          """
          g = 9.81
          grade = col.avg_gradient / 100
          theta = atan(grade)
          v = col.distance * 1000 / time_s  # m/s
          
          # Air density correction for altitude
          T = 288.15 - 0.0065 * altitude_m  # Standard lapse rate
          P = 101325 * (1 - 0.0065 * altitude_m / 288.15) ** 5.2561
          rho = P / (287.058 * T)
          
          # CdA estimation from grade (more aero on flats, less climbing)
          CdA = 0.32 - 0.08 * (grade / 0.15) if grade < 0.15 else 0.24
          
          total_mass = mass_kg + self.bike_mass
          
          # Power components
          P_gravity = total_mass * g * sin(theta) * v
          P_aero = 0.5 * rho * CdA * v**3
          P_rolling = total_mass * g * 0.004 * cos(theta) * v
          
          # Add drive train loss (~2.5%)
          P_total = (P_gravity + P_aero + P_rolling) / 0.975
          
          return P_total / mass_kg  # W/kg
      
      def estimate_from_strava(self, segment_effort):
          """
          Estimate W/kg from a Strava segment effort.
          Handles Strava's estimated power if available.
          """
          if segment_effort.get('watts'):
              mass = segment_effort.get('athlete_weight', self.rider_mass.get(
                  segment_effort['rider_id'], 70))
              return segment_effort['watts'] / mass
          # Fallback to time-based estimation
          return self.back_calc_power(...)
      
      def rolling_wkg(self, rider_id, window=5):
          """Rolling average of last N climb efforts."""
          efforts = self.results_cache.get(rider_id, [])
          recent = sorted(efforts, key=lambda x: x[2], reverse=True)[:window]
          return mean([e[1] for e in recent])
      
      def form_signal(self, rider_id):
          """Détection de forme : W/kg récent vs historique."""
          recent = self.rolling_wkg(rider_id, window=3)
          hist = self.rolling_wkg(rider_id, window=20)
          ratio = recent / hist if hist > 0 else 1.0
          return {
              'form_signal': ratio,
              'in_form': ratio > 1.03,
              'declining': ratio < 0.97,
              'peak_wkg': max(e[1] for e in self.results_cache.get(rider_id, []))
          }
  ```

---

## Métrique: Team Support Index

- **Définition**: Score composite évaluant la capacité d'une équipe à soutenir son leader dans les phases décisives d'une course. Contrairement aux sports individuels, le cyclisme est un sport d'équipe où la force collective est souvent déterminante — surtout en Grand Tour (contrôle du peloton, contre-la-montre par équipe, poursuite d'échappée).

- **Formule**:
  ```
  TSI = Σ (w₁·R + w₂·U + w₃·C + w₄·H)
  
  Où:
  
  R (Roster depth) = nombre d'équipiers terminant dans le top-50 / 8
  U (UCI weight) = Σ points_UCI_équipiers / max_UCI_possible
  C (Collective history) = ratio_taux_victoire_équipe / baseline (0.5-2.0)
  H (Historical synergy) = corrélation classement leader / classement équipe (5 dernières éditions)
  
  Poids ajustables:
  w₁ = 0.30 (profondeur effectif)
  w₂ = 0.25 (qualité individuelle équipiers)  
  w₃ = 0.25 (habitude de gagner)
  w₄ = 0.20 (synergie historique)
  
  Version contextuelle (prédiction GC vs classique):
  TSI_GC = TSI × 1.2 (force collective cruciale sur 3 semaines)
  TSI_one_day = TSI × 0.8 (plus individuel, moins d'impact équipe)
  ```

- **Sources données**:
  - ProCyclingStats : composition d'équipe par course, résultats complets
  - Classement UCI World Tour par équipe
  - PCS results archive : historique des résultats collectifs
  - Startlists PCS : composition exacte de l'équipe pour la course
  - FirstCycling.com : données d'effectif alternatives
  - Résultats de course : position de l'équipe au classement par équipe

- **Méthode d'extraction**:
  1. **Roster depth (R)**:
     - Scraper le classement de l'étape/course
     - Compter les équipiers du leader dans le top-50
     - Normaliser par 8 (taille équipe WT)
  2. **UCI weight (U)**:
     - Pour chaque équipier : points UCI individuels
     - Somme des points pour les équipiers (exclure le leader)
     - Normaliser par la somme max théorique (somme des top-10 WT)
  3. **Collective history (C)**:
     - Ratio : victoires de l'équipe / nombre de courses sur les 2 dernières saisons
     - Normaliser par le ratio moyen du peloton
  4. **Historical synergy (H)**:
     - Sur les 5 dernières participations à la même course, corrélation entre:
       - Classement du leader
       - Classement par équipe (best 3 riders)
     - Forte corrélation → équipe qui se mobilise bien pour son leader
  5. **Mise à jour incrémentale** après chaque course:
     - TSI récent = TSI calculé sur la course (juste avant)
     - TSI rolling = EMA (exponential moving average, α=0.3)

- **Précision attendue**:
  - Discrimination claire entre top-teams (UAE, Visma, INEOS TSI > 0.7) et teams secondaires (TSI < 0.4)
  - Corrélation modérée avec le résultat GC (R² ≈ 0.3-0.4 seul, plus fort combiné à ELO)
  - Meilleur prédicteur pour les courses où la tactique collective est cruciale (Grands Tours, classiques pavés)
  - Faible valeur ajoutée pour les courses où l'individu domine (CLM, étapes de montagne raides)

- **Application PariScore**:
  - **Correction de probabilité GC** : élever la probabilité des leaders avec TSI > 0.7, abaisser ceux avec TSI < 0.4
  - **Détection leader isolé** : TSI bas mais ELO haut → vulnérabilité en 3e semaine
  - **Prédiction classement par équipe** : TSI moyen de l'équipe → favori classement équipe
  - **H2H contextualisé** : leader avec TSI fort vs TSI faible → avantage accru sur longue distance
  - **Market team GC** : TSI est le principal input pour ce marché spécifique

- **Valeur stratégique** (1-5): **3**
  - Bon métrique contextuelle mais pas suffisante seule
  - Plus utile pour les paris GC longs que pour les paris d'étape
  - Données disponibles mais extraction plus lourde (startlists + results)

- **Implémentation**:
  ```python
  class TeamSupportIndex:
      def __init__(self):
          self.team_rosters = {}     # race_id -> team_id -> [rider_ids]
          self.rider_uci_points = {} # rider_id -> points
          self.team_victory_rate = {} # team_id -> wins / races
          self.historical_results = {} # (team_id, race_id) -> [leader_pos, team_pos]
      
      def compute_r(self, rider_ids, stage_result):
          """Roster depth: teammates in top-50."""
          in_top50 = sum(1 for r in rider_ids 
                        if stage_result.get(r, 999) <= 50)
          return min(in_top50 / 8, 1.0)
      
      def compute_u(self, rider_ids, leader_id):
          """UCI weight of supporting riders."""
          teammates = [r for r in rider_ids if r != leader_id]
          total_pts = sum(self.rider_uci_points.get(r, 0) for r in teammates[:7])
          max_pts = sum(sorted(self.rider_uci_points.values(), reverse=True)[:7])
          return total_pts / max_pts if max_pts > 0 else 0
      
      def compute_c(self, team_id):
          """Collective winning history."""
          rate = self.team_victory_rate.get(team_id, 0)
          baseline = 0.08  # ~8% win rate average for WT teams
          return min(rate / baseline, 2.0)  # cap at 2.0
      
      def compute_h(self, team_id, race_id):
          """Historical synergy: leader vs team ranking correlation."""
          results = self.historical_results.get((team_id, race_id), [])
          if len(results) < 3:
              return 0.5  # neutral for new pairs
          leader_ranks = [r[0] for r in results]
          team_ranks = [r[1] for r in results]
          # High correlation (both improve together) -> synergy
          corr = pearson_corr(leader_ranks, team_ranks)
          # We want high positive corr: leader does well, team does well
          return max(0, corr)  # negative corr = 0 (team doesn't help)
      
      def compute_tsi(self, team_id, rider_ids, leader_id, stage_result, 
                     race_id, race_type='gc'):
          R = self.compute_r(rider_ids, stage_result)
          U = self.compute_u(rider_ids, leader_id)
          C = self.compute_c(team_id)
          H = self.compute_h(team_id, race_id)
          
          tsi = 0.30*R + 0.25*U + 0.25*C + 0.20*H
          
          # Context adjustment
          if race_type == 'gc':
              tsi *= 1.2
          elif race_type == 'one_day':
              tsi *= 0.8
          
          return min(tsi, 1.0)
  ```

---

## Métrique: Fatigue / Form Index (L30)

- **Définition**: Indice composite estimant la fatigue accumulée par un coureur sur les 30 derniers jours (L30 = Last 30 days). Modélise la charge d'entraînement et de course récente comme proxy de la forme du jour, basé sur le principe du modèle Banister (CTL - ATL = TSB). En cyclisme pro, la fatigue cumulée est le facteur #1 de défaillance tardive en Grand Tour.

- **Formule**:
  ```
  Fatigue_Index = w₁·D + w₂·E + w₃·A + w₄·C
  
  Où:
  
  D (Days raced) = nombre de jours de course L30 / 30
  E (Elevation)  = Σ dénivelé_positif_L30 / 50000  (normalisé sur 50km de D+)
  A (Altitude exposure) = Σ heures >2000m L30 / 100
  C (CTL proxy) = moyenne_glissante_42j dénivelé_journalier - moyenne_glissante_7j
  
  Poids:
  w₁ = 0.35 (fréquence des courses)
  w₂ = 0.30 (charge de dénivelé)
  w₃ = 0.15 (stress altitude — stages en altitude)
  w₄ = 0.20 (déséquilibre charge aiguë/chronique)
  
  Interprétation:
  FI < 0.25 : frais, reposé
  FI 0.25-0.50 : légère fatigue, pic de forme possible
  FI 0.50-0.75 : fatigue modérée, risque de baisse
  FI > 0.75 : fatigue élevée, risque d'abandon ou contre-performance
  
  Taux de variation quotidien (ΔFI) :
  ΔFI > +0.05/jour : surcharge rapide → risque brûlure 3e semaine
  ΔFI stable ou négatif : bonne gestion de la charge
  ```

- **Sources données**:
  - ProCyclingStats : calendrier complet des coureurs (courses auxquelles ils ont participé)
  - Résultats d'étape PCS : distance parcourue, temps de course
  - FirstCycling.com : données de distance par étape alternative
  - Données Strava (si accessibles) : activités d'entraînement entre les courses
  - Profils d'étape : dénivelé total par étape (source CyclingStage)
  - Altitude des courses : cols, stages en altitude (>2000m)

- **Méthode d'extraction**:
  1. **Calendrier coureur**:
     - Scraper PCS pour le calendrier des 60 derniers jours de chaque coureur
     - Lister toutes les courses avec date, distance, type
  2. **Charge par course**:
     - Distance : disponible PCS (distance de l'étape)
     - Dénivelé : charger depuis la base de profils d'étape (source externe)
     - Intensité : classer chaque course (WT=1.0, Pro=0.8, .2=0.6, National=0.4)
     - Score de charge = distance × intensité × (1 + 0.3 × denivelé/1000)
  3. **Rolling windows**:
     - CTL_proxy = EMA 42 jours du score de charge quotidien
     - ATL_proxy = EMA 7 jours du score de charge quotidien
     - TSB_proxy = CTL_proxy - ATL_proxy (forme)
  4. **Si données Strava disponibles**:
     - Ajouter l'entraînement réel (pas seulement les courses)
     - TSS (Training Stress Score) si puissance dispo
     - Sinon, rTSS (rScore = normalized_speed × normalized_grade × duration)
  5. **Ajustement altitude**:
     - Pour chaque jour avec course >2000m : stocker heures d'exposition
     - Contre-performances post-altitude : facteur de correction (fatigue décalée de +3 jours)

- **Précision attendue**:
  - Corrélation modérée avec performance réelle (R² ≈ 0.25-0.35) — la fatigue est un facteur parmi d'autres
  - Bonne détection des extrêmes : coureurs avec FI > 0.75 abandonnent 2× plus souvent
  - Forte valeur prédictive en 3e semaine de Grand Tour (discrimination claire entre coureurs soutenables et en limite)
  - Limitation : sans données d'entraînement réel (Strava), la charge est sous-estimée
  - Limitation : ne capture pas la qualité du sommeil, la nutrition, ou les chutes

- **Application PariScore**:
  - **Prédiction 3e semaine GT** : FI > 0.6 avant dernière semaine → baisser probabilité GC de 20%
  - **Valeur sur étapes tardives** : FI bas pour leader préservé → top-10 probable
  - **Détection abandon** : FI > 0.8 + historique d'abandons → risque élevé
  - **Comparaison H2H contextuelle** : leader A FI=0.3 vs leader B FI=0.7 → A favori même si ELO inférieur
  - **Prédiction pic forme** : FI baissant (ΔFI < 0) + CTL élevé → coureur qui entre en pic de forme
  - **Calibration cotes GC** : ajustement à la baisse des leaders avec calendrier surchargé (ex: Doublé Giro + TdF)

- **Valeur stratégique** (1-5): **4**
  - Métrique essentielle que presque aucun modèle public n'intègre correctement
  - Différenciateur clé sur Grands Tours (3 semaines = course de gestion de fatigue)
  - Complémentaire à ELO (qui est atemporel) et VAM (instantané)

- **Implémentation**:
  ```python
  class FatigueFormIndex:
      def __init__(self):
          self.rider_calendar = {}  # rider_id -> [{date, race_id, distance_m, 
                                    #            elevation_m, intensity, type}]
          self.cols_db = {}  # col_id -> {altitude, gradient, ...}
      
      def load_rider_calendar(self, rider_id, days=60):
          """Fetch rider's race calendar from PCS."""
          # Scraper PCS pour les courses du coureur
          pass
      
      def _daily_stress(self, entry):
          """Single day race stress score."""
          base = entry['distance_km'] * entry['intensity']
          hill_bonus = 0.3 * entry['elevation_m'] / 1000
          altitude_malus = 0.1 * max(0, (entry.get('max_altitude', 0) - 2000) / 1000)
          return base * (1 + hill_bonus + altitude_malus)
      
      def _ema(self, values, alpha):
          """Exponential moving average."""
          ema = [values[0]]
          for v in values[1:]:
              ema.append(alpha * v + (1 - alpha) * ema[-1])
          return ema[-1] if ema else 0
      
      def compute(self, rider_id, reference_date):
          """Compute Fatigue Index for a rider."""
          calendar = self.rider_calendar.get(rider_id, [])
          recent = [e for e in calendar 
                   if e['date'] >= reference_date - timedelta(days=60)]
          
          # Days raced in L30
          l30 = [e for e in recent if e['date'] >= reference_date - timedelta(days=30)]
          days_raced = len(set(e['date'] for e in l30))
          
          # D (Days raced ratio)
          D = min(days_raced / 30, 1.0)
          
          # E (Elevation load)
          total_elev = sum(e['elevation_m'] for e in l30)
          E = min(total_elev / 50000, 1.0)
          
          # A (Altitude exposure)
          high_alt_hours = sum(e.get('hours_above_2000m', 0) for e in l30)
          A = min(high_alt_hours / 100, 1.0)
          
          # C (CTL - ATL proxy via Banister model)
          daily_stress = []
          for d in range(60):
              day = reference_date - timedelta(days=d)
              stress = sum(
                  self._daily_stress(e) for e in recent if e['date'] == day
              )
              daily_stress.append(stress)
          
          daily_stress.reverse()  # chronological
          
          if len(daily_stress) < 42:
              ctl = mean(daily_stress) if daily_stress else 0
              atl = mean(daily_stress[-7:]) if len(daily_stress) >= 7 else 0
          else:
              ctl = self._ema(daily_stress, 2/(42+1))
              atl = self._ema(daily_stress, 2/(7+1))
          
          tsb = (ctl - atl) / max(ctl, 1)
          # Normalize TSB: negative = fatigued, positive = fresh
          C = max(0, -tsb)  # 0 = fresh, higher = fatigued
          
          FI = 0.35*D + 0.30*E + 0.15*A + 0.20*C
          
          # ΔFI (trend over last 7 days)
          fi_7d_ago = self.moving_avg(recent, reference_date - timedelta(days=7), 14)
          delta_fi = (FI - fi_7d_ago) / 7 if fi_7d_ago else 0
          
          return {
              'FI': FI,
              'delta_FI': delta_fi,
              'components': {'days_raced': D, 'elevation': E, 
                           'altitude': A, 'tsb_fatigue': C},
              'days_raced_l30': days_raced,
              'total_elev_l30': total_elev,
              'interpretation': self._interpret(FI)
          }
      
      def _interpret(self, fi):
          if fi < 0.25: return 'Frais, reposé'
          if fi < 0.50: return 'Légère fatigue, pic possible'
          if fi < 0.75: return 'Fatigue modérée, risque de baisse'
          return 'Fatigue élevée, risque abandon'
      
      def moving_avg(self, entries, anchor_date, window):
          """Compute average FI over a past window."""
          relevant = [e for e in entries 
                     if anchor_date - timedelta(days=window) <= e['date'] <= anchor_date]
          return len(relevant) / window  # simplified
  ```

---

## Synthèse — Intégration des métriques

### Matrice de corrélation attendue

| Métrique | ELO terrain | VAM | W/kg | TSI | L30 |
|----------|-------------|-----|------|-----|-----|
| ELO terrain | 1.00 | 0.45 | 0.50 | 0.20 | -0.10 |
| VAM | 0.45 | 1.00 | 0.85 | 0.05 | -0.25 |
| W/kg | 0.50 | 0.85 | 1.00 | 0.05 | -0.20 |
| TSI | 0.20 | 0.05 | 0.05 | 1.00 | 0.05 |
| L30 | -0.10 | -0.25 | -0.20 | 0.05 | 1.00 |

→ Les métriques sont suffisamment orthogonales (faible multi-colinéarité) pour être combinées.

### Pondération recommandée par type de prédiction

| Prédiction | ELO terrain | VAM | W/kg | TSI | L30 |
|------------|-------------|-----|------|-----|-----|
| GC Grand Tour | 0.30 | 0.20 | 0.15 | 0.20 | 0.15 |
| Étape montagne | 0.25 | 0.30 | 0.30 | 0.05 | 0.10 |
| Étape sprint | 0.50 | 0.00 | 0.00 | 0.30 | 0.20 |
| Classique pavés | 0.40 | 0.00 | 0.00 | 0.35 | 0.25 |
| CLM | 0.50 | 0.00 | 0.30 | 0.05 | 0.15 |
| H2H | 0.40 | 0.20 | 0.15 | 0.10 | 0.15 |

### Pipeline d'inférence complet

```python
class CyclingPredictionPipeline:
    def __init__(self):
        self.elo = CyclingEloSystem()
        self.vam = VAMEstimator()
        self.power = PowerEstimator()
        self.tsi = TeamSupportIndex()
        self.fatigue = FatigueFormIndex()
    
    def predict_rider(self, rider_id, race_profile):
        """
        Score de probabilité pour un coureur sur une course donnée.
        Retourne un score [0, 100] et les composantes.
        """
        weights = self._get_weights(race_profile['type'])
        
        elo_score = self.elo.score_for_terrain(
            rider_id, race_profile['terrain'])  # [0, 100]
        vam_score = self.vam.normalized_score(
            rider_id, race_profile['cols'])      # [0, 100]
        wkg_score = self.power.form_signal(
            rider_id)['relative_score']           # [0, 100]
        tsi_score = self.tsi.compute_tsi(          # [0, 1] -> [0, 100]
            rider_id, race_profile['team']...) * 100
        fatigue_score = (1 - self.fatigue.compute(  # Inversé: 0 = fatigue
            rider_id)['FI']) * 100
        
        final = (weights['elo'] * elo_score +
                 weights['vam'] * vam_score +
                 weights['wkg'] * wkg_score +
                 weights['tsi'] * tsi_score +
                 weights['fatigue'] * fatigue_score)
        
        return {
            'total_score': final,
            'components': {
                'elo': elo_score,
                'vam': vam_score,
                'wkg': wkg_score,
                'tsi': tsi_score,
                'fatigue': fatigue_score
            }
        }
```

### Sources de données complètes

| Source | Données | Accès | Coût |
|--------|---------|-------|------|
| **ProCyclingStats** | Résultats, startlists, profils, points UCI, masse | Scraping web | Gratuit |
| **FirstCycling.com** | Profils étape, altitude, calendrier | Scraping web | Gratuit |
| **Strava API** | Activités, segments, puissance, FC | API OAuth | Freemium |
| **CyclingStage.com** | Profils altimétriques SVG, favoris | Scraping web | Gratuit |
| **Climbfinder** | Base de cols (pente, distance, altitude) | Scraping web | Gratuit |
| **OpenStreetMap** | Données altimétriques SRTM | API Overpass | Gratuit |
| **Cols-cyclisme.com** | Référentiel cols France+Europe | Scraping web | Gratuit |

---

*Document généré par l'équipe Sports Science, PariScore — Juin 2026*
