# Basketball Prediction & Analytics Competitor Research

**Date**: 2026-09-04  
**Purpose**: Competitive intelligence for ParisScore basketball expansion  
**Sources**: Primary methodology pages, academic papers, official documentation

---

## 1. FiveThirtyEight / ABC News — RAPTOR

### Methodology
- **RAPTOR** (Robust Algorithm using Player Tracking and On/Off Ratings) — all-in-one player metric
- Two components combined:
  - **Box score component** (`raptor_box_*`): Points above average per 100 possessions from box score stats
  - **On/off plus-minus component** (`raptor_onoff_*`): Points above average per 100 possessions from on/off data
- **Historical mode**: For pre-2014 seasons (no tracking data), uses box score estimates only
- **Modern mode** (2014+): Combines box score + on/off plus-minus using NBA player-tracking data
- **PREDATOR** (Predictive RAPTOR): Forward-looking version optimized for prediction rather than retrodiction
- **WAR** (Wins Above Replacement): Derived from RAPTOR for total player value

### Data Sources
- Basketball-Reference.com box scores (1976–present)
- NBA player-tracking data (2014–present)
- On/off lineup data

### Accuracy
- RAPTOR was the backbone of FiveThirtyEight's NBA game predictions (now archived)
- The methodology page stated RAPTOR was designed to be "the most accurate publicly available metric"
- Pre-538 shutdown, their game predictions had ~68-70% accuracy against spread

### Unique Insights
- Pace impact metric (player effect on team possessions/48min)
- Separate offensive/defensive decomposition
- Historical comparisons back to 1976 ABA-NBA merger

### ParisScore Lessons
- **Dual-component architecture** (box + on/off) is the gold standard
- PREDATOR's predictive orientation vs retrodictive — aligns with ParisScore's betting use case
- WAR translation makes analytics accessible to casual users
- Open data on GitHub (fivethirtyeight/data) — can study weights directly

---

## 2. ESPN — Basketball Power Index (BPI)

### Methodology
- **Team-level** rating system (not player-level like RAPTOR)
- Measures offensive and defensive strength against league averages
- In-season: uses margin of victory, offensive/defensive efficiency, strength of schedule, win quality
- Preseason: incorporates coach past performance, recruiting rankings, returning roster, player output
- Generates win probabilities for every game
- Used by NCAA selection committee for March Madness seeding

### Data Sources
- Game results and margins
- Offensive/defensive efficiency metrics
- Schedule strength data
- Preseason projections (recruiting, returning players)

### Accuracy
- Correctly predicted National Champion in first 3 years of existence (Kansas, UNC, Duke)
- Teams with 50-60% BPI win probability actually won 55.8% of the time (well-calibrated)
- One of the most accurate public systems for college basketball
- Criticism: overweighting of preseason expectations mid-season

### Unique Insights
- Preseason-to-season transition blending (unique to BPI)
- Used officially by NCAA for tournament selection
- Generates both spread and moneyline predictions
- Seed probability projections for March Madness

### ParisScore Lessons
- **Preseason blending** technique: how to incorporate preseason expectations that decay as real data accumulates
- Official institutional adoption creates trust/authority
- BPI's weakness (overweighting preseason) is a lesson — ParisScore should decay faster
- Dual NCAA + NBA applicability

---

## 3. The Ringer / Grantland

### Methodology
- No single proprietary model — primarily editorial/analytical content
- **Kirk Goldsberry** (Sprawlbball author, ex-Spurs VP strategic research) contributes analytics pieces
- Focus on spatial analysis (shot charts, court geometry)
- Emphasis on **Dean Oliver's Four Factors**: eFG%, turnover rate, offensive rebounding rate, FT rate
- Team title predictions based on historical precedent: top-3 offense AND top-4 defense = most likely champions
- AI/ML integration coverage: teams using AutoStats (tracking from broadcasts), SkillCorr (cross-league data)

### Data Sources
- NBA box scores, play-by-play
- Spatial/tracking data (Second Spectrum, AutoStats)
- Historical data since 2000 for title pattern analysis

### Unique Insights
- **Spatial analytics**: shot location quality, court geometry, defensive coverage mapping
- Historical precedent analysis (teams since 2000 with specific statistical profiles → championship rates)
- AI in draft scouting: language analysis of player interviews predicting NBA success (63% accuracy alone, 87% with context)
- Cross-league tracking data (college → G League → international)

### ParisScore Lessons
- **Spatial/contextual data** beyond traditional stats — ParisScore could integrate shot quality/location
- The "both ends of floor" heuristic is simple but powerful for user-facing predictions
- AI scouting from non-traditional data (interviews, language) — novel edge potential
- No single model = opportunity for ParisScore to own a unified framework

---

## 4. Cleaning the Glass

### Methodology
- Founded by **Ben Falk** (ex-VP Basketball Strategy, 76ers; ex-Analytics Manager, Trail Blazers)
- **Garbage time filtering**: removes non-competitive game situations by default
- **Heave filtering**: removes full-court/buzzer-beater shots from efficiency stats
- **Direct possession counting**: from play-by-play logs, not box score estimates
- Formula: `possessions = FGA - OREB + TO + 0.44 * FTA` (standard, but applied precisely)
- **Percentile-based interpretation**: 0 = worst, 100 = best — makes every stat immediately interpretable
- Lineup and on/off analysis with minimum playing time thresholds

### Unique Metrics
- **Four Factors breakdown** (Dean Oliver): eFG%, TO%, ORB%, FT Rate — offense and defense
- **Transition vs. halfcourt splits**: efficiency in fast break vs. set plays
- **Position groupings**: modern NBA position definitions (not traditional 1-5)
- **On/off adjusted stats**: with garbage time filtering
- **Shot location categories** that map to actual strategic zones
- **Lineup analysis**: plus/minus with proper context filters

### Data Sources
- NBA play-by-play data (primary source)
- Box score data (supplementary)
- No player-tracking data (as of 2026)

### Accuracy
- Used by NBA front offices, coaches, and agents
- Cited by Zach Lowe, Kevin Pelton, Kevin O'Connor (top analytics journalists)
- 95%+ subscriber renewal rate (high satisfaction)
- Contributed to FiveThirtyEight articles and ESPN reports

### Unique Insights
- **Context-first philosophy**: every stat includes interpretation guidance
- **Front-office quality**: same tools used by NBA teams available to fans
- **Transition vs. halfcourt** — most sites don't separate these, but they matter enormously for matchup analysis
- **Filtered efficiency** — the "clean" in Cleaning the Glass means removing noise that inflates/deflates stats

### ParisScore Lessons
- **Garbage time and heave filtering** is essential for accurate in-game and season stats
- Percentile interpretation (0-100 scale) is excellent UX — adopt this pattern
- **Transition/halftime splits** for matchup predictions would be a differentiator
- Subscription model ($7.50/mo) validates premium analytics willingness to pay
- Front-office-grade data at consumer price = value proposition

---

## 5. Dunks & Threes — Estimated Plus-Minus (EPM)

### Methodology
- Created by **Taylor Snarr** (ex-Utah Jazz analytics coordinator)
- **EPM = SPM Bayesian prior + RAPM** (Regularized Adjusted Plus-Minus)
- Two main components:
  1. **Statistical Plus-Minus (SPM)**: Uses "Estimated Skills" (machine-optimized player stats) to estimate impact
  2. **RAPM**: Ridge regression over all possessions since 2002 (5.5M+ possessions), with SPM as Bayesian prior
- **Estimated Skills**: Machine-learned projections for each stat category, individually optimized
  - Each stat has its own decay factor (how quickly past data loses relevance)
  - Uses Differential Evolution optimizer to find ideal decay weights
  - Accounts for: age curves, within-season trends, team/opponent strength, seasonality, back-to-backs
- **Predictive orientation**: trained to forecast next-game performance, not retrodict past
- **Career-wide data**: Uses player's entire career history, not just current season
- **Player-tracking data**: Integrated from 2013-14 onward (separate SPM model)

### Data Sources
- Box score data (18-year RAPM training: 2001-2019)
- Play-by-play data
- Player-tracking data (6-year RAPM training: 2017-2023)
- Career performance history for each player

### Accuracy
- RMSE of 12.1 for game predictions (with injury info) vs 12.25 for enhanced traditional ratings
- Outperforms RPM (ESPN's Real Plus-Minus) in retrodiction tests
- Outperforms RAPTOR and BPM in comparative analysis
- Used nightly for game predictions and Monte Carlo season simulations

### Unique Insights
- **Estimated Skills per stat**: individual stabilization curves for every statistical category
- **Decay-weighted career**: recent games matter more, but career trajectory matters
- **Team EPM**: sum of player EPM weighted by predicted minutes
- **Game predictions → season simulations**: full pipeline from individual metrics to playoff probabilities
- **Injury-adjusted predictions**: active/inactive player awareness improves RMSE

### ParisScore Lessons
- **Individual stat stabilization curves** (Estimated Skills) — the most sophisticated approach to "how much sample do I need?"
- **Career-wide decay weighting** is superior to single-season analysis
- **Differential Evolution optimization** for hyperparameters — automated tuning
- **Bayesian prior (SPM) + noisy signal (RAPM)** combination is the proven architecture
- **Injury-aware predictions** as a feature, not an afterthought
- RMSE benchmark (12.1) gives ParisScore a concrete accuracy target

---

## 6. Hashtag Basketball

### Methodology
- **Fantasy-focused** — not prediction/betting oriented
- Crowdsourced rankings (community voting on player comparisons)
- **Advanced Schedule Grid**: games per week by team — critical for H2H fantasy
- Custom rankings based on league settings (category vs points leagues)
- Player scouting with matchup analysis
- Trade analyzer, waiver wire rankings, mock draft simulator

### Data Sources
- NBA schedule data
- Player performance statistics
- League-specific settings (Yahoo, ESPN, Fantrax, Sleeper)

### Unique Insights
- **Schedule optimization**: which teams play more/less in given weeks
- **League-specific customization**: rankings adapt to your league's stat categories
- **Trade impact analysis**: how a trade changes your league standings
- **Form/trend tracking**: recent performance weighted for pickup decisions

### ParisScore Lessons
- **Schedule density awareness** is valuable for betting (rest days, back-to-backs)
- **League-specific customization** pattern — ParisScore could offer surface-specific views
- Community/crowdsourced rankings as a complementary signal
- Fantasy analytics ≠ betting analytics — different use cases, different metrics

---

## 7. Academic Approaches

### 7a. Markov Chain Models

**Key Papers**:
- **Kvam & Sokol (2006)**: "A logistic regression/Markov chain model for NCAA basketball" — Naval Research Logistics
  - Combined logistic regression (pre-game win probability) with Markov chain (in-game state transitions)
  - States: possession outcomes, score differentials
  - Applied to March Madness predictions
- **Shi & Song (2021)**: "A discrete-time and finite-state Markov chain based in-play prediction model for NBA basketball matches"
  - In-play (live) prediction using Markov chains
  - Gamma process model for total points
  - Bookmaker betting line adjustment
- **Yan & Bin (2026)**: "Developing and Analyzing a Markov Chain-Based Model for Evaluating the Dynamic Evolution of Tactical States in Basketball Games" (ACM)
  - Models tactical state transitions (offensive/defensive sequences)
  - "Memoryless" property aligns with possession-based basketball
  - Quantifies team strategic preferences and tendencies

**ParisScore Lessons**:
- Markov chains are ideal for **live/in-play basketball predictions** — possessions are natural states
- Combining pre-game models (regression/Elo) with in-game models (Markov) is the cutting edge
- Tactical state modeling could differentiate ParisScore for live betting

### 7b. Elo Rating Systems

**FIBA World Ranking System** (revised November 2025):
- Each team accumulates **Game Rating Points** from every FIBA official game
- Formula components:
  - **Base Factor** (B = 10): ensures comparable scale
  - **Region Factor** (R): Africa 0.69, Americas 0.93, Asia/Oceania 0.68, Europe 1.00
  - **Competition Stage Factor** (S): varies by tournament stage (0.15 for pre-qual to 8.0 for World Cup final)
  - **Winning Factor** (W = 1.25): multiplier for winners
  - **Opponent Rating Factor** (O = 1 + 0.0001 × TL): stronger opponents = more points
  - **Away Game Factor** (A = 1.1): home/away adjustment
  - **Margin of Victory Factor** (M): 1.05 for 15+ point wins, 1.20 for 30+ point wins
- **Discounting**: 0.66 multiplier before each major event to prevent indefinite growth
- Removed from ranking if inactive for 8+ years

**BasketballPredict.org**: ELO + Glicko model for international basketball
- Win probabilities for FIBA national team competitions, Olympics, Australian NBL

**ParisScore Lessons**:
- FIBA's new system is an **Elo variant with rich contextual multipliers** — directly applicable
- **Region factors** for international competition quality differences
- **Stage factors** weighting tournament importance — knockout games count more
- **Margin of victory** with caps (prevents running up the score incentives)
- **Discounting mechanism** prevents historical accumulation from dominating

### 7c. Logistic Regression

**Kvam & Sokol (2006)**: Combined logistic regression with Markov chains
- Logistic regression for pre-game win probability based on team ratings
- Markov chain for in-game state transitions
- Applied to NCAA tournament bracket predictions

**Academic consensus**: Logistic regression remains a strong baseline for basketball prediction
- Feature engineering (efficiency differentials, strength of schedule) matters more than model complexity
- Often comparable to neural networks for game-level predictions

**ParisScore Lessons**:
- Logistic regression is a strong, interpretable baseline — don't over-engineer
- Feature engineering > model complexity for game outcomes
- Combination with Markov for live predictions is the frontier

---

## 8. Betting-Focused Sites

### Action Network
- **Methodology**: Blend of multiple expert models (not a single algorithm)
- Each expert builds their own power ratings/score models
- Projections for spread, moneyline, over/under for every game
- PRO Report compares projections to sportsbook lines → edge detection (percentage difference)
- Letter grading system for bet quality
- Factors: advanced stats, recent play, offensive/defensive advantages, player values, injury news, home court, rest
- **Action Labs**: back-testing, system building, real-time odds comparison

### The Athletic (NYT)
- **Methodology**: Offensive and defensive projections for every team
  - Estimates points scored/allowed vs. average opponent on neutral court
  - Adjusts for opponent, location, team health
  - Simulates tournament 200,000 times for probability distributions
- 10+ years of advanced metrics, opponent-adjusted
- Women's NCAA tournament projections (notable: rare coverage)

### Polymarket / Prediction Markets
- **FIBA Women's World Cup**: 500+ live prediction markets
- Market-driven probabilities (crowd wisdom)
- Real-time odds movement reflecting news/information

### FIBA Women's Specific
- **Oddspedia**: FIBA Women's World Cup odds aggregator
- **FIBA Game Predictor**: 1xBet-powered prediction tool (sponsor integration)
- **SportsHistori, RG.org, Ballislife**: Expert picks and odds analysis
- USA overwhelming favorite (-360 to -670 depending on book)
- Market disagreement on France, Belgium, Australia creates value opportunities

**ParisScore Lessons**:
- **Expert blend > single model**: Action Network's approach acknowledges model uncertainty
- **Line comparison across books** is a service, not a model — valuable feature
- **Women's basketball is underserved**: FIBA Women's World Cup has betting markets but almost no analytical coverage → opportunity
- **Simulation-based probabilities** (200K simulations) provide confidence intervals, not just point estimates
- **Edge detection** (model vs. market) is the core betting feature

---

## 9. Comparative Summary

| Source | Level | Type | Data | Unique Strength | Accuracy Metric | Monetization |
|--------|-------|------|------|-----------------|-----------------|--------------|
| FiveThirtyEight RAPTOR | Player | Retrodictive+Predictive | Box+On/Off+Tracking | Historical depth (1976) | ~68-70% vs spread | Free (archived) |
| ESPN BPI | Team | Predictive | Efficiency+SOS+Preseason | Official NCAA adoption | 55.8% calibration | Free (ESPN) |
| The Ringer | Editorial | Analysis | Tracking+Spatial | Shot chart/spatial analytics | N/A | Ad-supported |
| Cleaning the Glass | Team/Player | Descriptive | Play-by-play | Garbage time filtering, percentiles | N/A | $7.50/mo |
| Dunks & Threes EPM | Player | Predictive | Box+PBP+Tracking | Skill stabilization curves | RMSE 12.1 | Subscription |
| Hashtag Basketball | Fantasy | Ranking | Schedule+Stats | Schedule optimization | N/A | $2.50/mo |
| FIBA Ranking | Team | Rating | Game results | Contextual multipliers (region, stage, margin) | N/A | Free |
| Action Network | Betting | Predictive | Expert blend | Line comparison/edge detection | N/A | PRO subscription |
| The Athletic | Betting/Editorial | Predictive | 10yr advanced metrics | 200K simulations, Women's coverage | N/A | Subscription |

---

## 10. Key Takeaways for ParisScore

### Architecture Decisions
1. **Dual-component player metrics** (box + on/off) is the proven standard — both RAPTOR and EPM use this
2. **Bayesian prior (SPM) + noisy signal (RAPM)** is the mathematical backbone — implement this
3. **Individual stat stabilization curves** (EPM's Estimated Skills) are the differentiator for prediction accuracy
4. **Career-wide decay weighting** outperforms single-season analysis

### Feature Opportunities
1. **Women's basketball analytics** — massively underserved market (FIBA Women's World Cup 2026 happening NOW)
2. **Live/in-game predictions** using Markov chains on possession outcomes
3. **Garbage time and heave filtering** — simple but impactful accuracy improvement
4. **Transition vs. halfcourt splits** for matchup predictions
5. **Injury-aware predictions** as first-class feature (EPM shows 0.15 RMSE improvement)

### Accuracy Targets
- EPM game prediction RMSE: **12.1** (with injury info)
- BPI calibration: **actual win% within 5% of predicted probability**
- RAPTOR vs spread: **~68-70%**

### Data Strategy
- Play-by-play data is the foundation (possession-level analysis)
- Player-tracking data (2014+) adds significant predictive power
- Preseason projections provide early-season signal but must decay quickly
- **Open data**: FiveThirtyEight data on GitHub, FIBA ranking formulas are public — study and adapt

### Monetization Validation
- Cleaning the Glass: $7.50/mo, 95%+ renewal rate
- Dunks & Threes: subscription model for EPM
- Hashtag Basketball: $2.50/mo for premium tools
- Action Network: PRO subscription for line comparisons
- Premium basketball analytics has proven willingness to pay
