"""
Moteur de backtesting de stratégies de paris Pariscore.

4 stratégies:
  - value_betting:  Parier quand proba_modèle / proba_marché > threshold
  - favori_modere:  Parier sur le favori seulement si confiance élevée
  - contrarien:     Parier contre le favori (fade the public)
  - kelly_criterion: Taille de mise optimale via formule de Kelly
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from pathlib import Path

from src.models.train import FEATURE_COLUMNS
from src.features.pipeline import FeaturePipeline
from src.data.synthetic import generate_dataset


class BacktestEngine:
    """Moteur de backtesting de stratégies de paris.

    Génère des matchs synthétiques, applique le modèle de prédiction,
    simule les cotes marché, et évalue la performance de la stratégie.

    Usage:
        engine = BacktestEngine(model=my_model)
        result = engine.run(strategy="value_betting", threshold=1.10)
    """

    def __init__(self, model, feature_columns: list[str] | None = None):
        self.model = model
        self.feature_columns = feature_columns or FEATURE_COLUMNS.copy()

    # ── API publique ──────────────────────────────────────────────

    def run(
        self,
        strategy: str = "value_betting",
        threshold: float = 1.10,
        bankroll: float = 10000.0,
        min_odds: float = 1.50,
        max_odds: float = 5.00,
        n_matches: int = 1000,
    ) -> dict:
        """Exécute un backtesting complet.

        Args:
            strategy: Nom de la stratégie.
            threshold: Seuil de value (ratio proba_modèle / proba_marché).
            bankroll: Bankroll initiale.
            min_odds: Cote minimale acceptable.
            max_odds: Cote maximale acceptable.
            n_matches: Nombre de matchs synthétiques à générer.

        Returns:
            dict with keys:
              strategy, bankroll_initial, bankroll_final, roi_percent,
              sharpe_ratio, max_drawdown_percent, total_bets, win_rate,
              avg_odds, bankroll_history, bet_history, status
        """
        valid = {"value_betting", "favori_modere", "contrarien", "kelly_criterion"}
        if strategy not in valid:
            return {
                "status": "error",
                "detail": f"Stratégie inconnue: {strategy}. "
                           f"Choisir parmi {valid}",
            }

        matchups = self._generate_matches(n_matches)
        if matchups.empty:
            return {
                "status": "error",
                "detail": "Impossible de générer des matchups.",
            }

        bankroll_current = bankroll
        bankroll_history = [bankroll]
        bet_history: list[dict] = []
        peak = bankroll

        strategy_map = {
            "value_betting": self._value_betting,
            "favori_modere": self._favori_modere,
            "contrarien": self._contrarien,
            "kelly_criterion": self._kelly_criterion,
        }
        apply = strategy_map[strategy]

        for idx, (_, match) in enumerate(matchups.iterrows()):
            prob_a = self._predict(match.to_dict())
            prob_b = 1.0 - prob_a
            odds_a = self._generate_odds(prob_a)
            odds_b = self._generate_odds(prob_b)

            target = match.get("target", 1)
            actual_winner_won = target == 1

            if strategy in ("value_betting", "kelly_criterion"):
                bet = apply(
                    prob_a, prob_b, odds_a, odds_b,
                    threshold, min_odds, max_odds,
                    idx, bankroll_current,
                )
            else:
                bet = apply(
                    prob_a, prob_b, odds_a, odds_b,
                    threshold, min_odds, max_odds,
                    idx,
                )

            if bet is not None:
                if bet["side"] == "A":
                    bet_won = actual_winner_won
                else:
                    bet_won = not actual_winner_won

                bet["result"] = "win" if bet_won else "loss"
                if bet_won:
                    bet["pnl"] = round(bet["stake"] * (bet["odds"] - 1), 2)
                else:
                    bet["pnl"] = round(-bet["stake"], 2)

                bankroll_current += bet["pnl"]
                bet_history.append(bet)

            bankroll_history.append(round(bankroll_current, 2))
            if bankroll_current > peak:
                peak = bankroll_current

        return self._compute_metrics(
            strategy, bankroll, bankroll_current,
            bankroll_history, bet_history,
        )

    # ── Génération de matchs ──────────────────────────────────────

    def _generate_matches(self, n_matches: int) -> pd.DataFrame:
        """Génère des matchups via le pipeline synthétique.

        Tente d'abord generate_dataset + FeaturePipeline.
        Fallback sur des vecteurs aléatoires en cas d'échec.
        """
        try:
            df = generate_dataset(n_matches=n_matches, seed=42)
            pipeline = FeaturePipeline(min_matches_per_player=5)
            matchups = pipeline.run(df)
            if not matchups.empty:
                return matchups
        except Exception:
            pass

        return self._generate_random_matchups(n_matches)

    def _generate_random_matchups(self, n_matches: int) -> pd.DataFrame:
        """Fallback: vecteurs aléatoires simulant des features."""
        rng = np.random.default_rng(42)
        rows = []
        for i in range(n_matches):
            row = {col: rng.uniform(-1, 1) for col in self.feature_columns}
            row["match_id"] = f"SYNTH_{i:06d}"
            row["player_a_id"] = "A"
            row["player_b_id"] = "B"
            row["target"] = 1 if rng.random() > 0.4 else 0
            rows.append(row)
        return pd.DataFrame(rows)

    # ── Prédiction ────────────────────────────────────────────────

    def _predict(self, features: dict) -> float:
        """Prédit la probabilité que le joueur A gagne."""
        x = np.array([[
            features.get(col, 0.0)
            for col in self.feature_columns
        ]])
        return float(self.model.predict_proba(x)[0, 1])

    # ── Cotes simulées ────────────────────────────────────────────

    @staticmethod
    def _generate_odds(prob: float, noise_level: float = 0.05) -> float:
        """Génère une cote marché avec un bruit aléatoire.

        Simule un léger mispricing par rapport à la probabilité réelle.
        """
        market_prob = float(np.clip(
            prob + np.random.normal(0, noise_level),
            0.05, 0.95,
        ))
        return round(1.0 / market_prob, 4)

    # ── Stratégies ────────────────────────────────────────────────

    @staticmethod
    def _value_betting(
        prob_a: float, prob_b: float,
        odds_a: float, odds_b: float,
        threshold: float,
        min_odds: float, max_odds: float,
        idx: int,
        bankroll: float = 10000.0,
    ) -> dict | None:
        """Value betting: parier quand le modèle détecte une value.

        Ratio proba_modèle / proba_marché > threshold.
        Mise: 2% de la bankroll courante.
        """
        for prob, odds, side in [(prob_a, odds_a, "A"), (prob_b, odds_b, "B")]:
            market_prob = 1.0 / odds
            if prob / market_prob > threshold and min_odds <= odds <= max_odds:
                stake = round(0.02 * bankroll, 2)
                return {
                    "match_id": f"SYNTH_{idx:06d}",
                    "prob": round(prob, 4),
                    "odds": odds,
                    "side": side,
                    "stake": stake,
                }
        return None

    @staticmethod
    def _favori_modere(
        prob_a: float, prob_b: float,
        odds_a: float, odds_b: float,
        threshold: float,
        min_odds: float, max_odds: float,
        idx: int,
    ) -> dict | None:
        """Favori modéré: parier sur le favori si confiance > 65%.

        Conditions: prob_favori > 0.65 ET prob_favori > threshold.
        Mise: 2% de la bankroll de référence (10 000).
        """
        if prob_a >= prob_b:
            fav_prob, fav_odds, fav_side = prob_a, odds_a, "A"
        else:
            fav_prob, fav_odds, fav_side = prob_b, odds_b, "B"

        if fav_prob > 0.65 and fav_prob > threshold and min_odds <= fav_odds <= max_odds:
            return {
                "match_id": f"SYNTH_{idx:06d}",
                "prob": round(fav_prob, 4),
                "odds": fav_odds,
                "side": fav_side,
                "stake": round(0.02 * 10000, 2),
            }
        return None

    @staticmethod
    def _contrarien(
        prob_a: float, prob_b: float,
        odds_a: float, odds_b: float,
        threshold: float,
        min_odds: float, max_odds: float,
        idx: int,
    ) -> dict | None:
        """Contrarien: parier contre le favori (fade the public).

        Conditions: la proba marché du favori dépasse la proba modèle
        d'au moins 0.10 (marché surévalue le favori).
        Mise: 1% de la bankroll de référence.
        """
        if prob_a >= prob_b:
            fav_prob, dog_prob, fav_odds, dog_odds, dog_side = (
                prob_a, prob_b, odds_a, odds_b, "B"
            )
        else:
            fav_prob, dog_prob, fav_odds, dog_odds, dog_side = (
                prob_b, prob_a, odds_b, odds_a, "A"
            )

        market_prob_fav = 1.0 / fav_odds

        if market_prob_fav > fav_prob + 0.10 and min_odds <= dog_odds <= max_odds:
            return {
                "match_id": f"SYNTH_{idx:06d}",
                "prob": round(dog_prob, 4),
                "odds": dog_odds,
                "side": dog_side,
                "stake": round(0.01 * 10000, 2),
            }
        return None

    @staticmethod
    def _kelly_criterion(
        prob_a: float, prob_b: float,
        odds_a: float, odds_b: float,
        threshold: float,
        min_odds: float, max_odds: float,
        idx: int,
        bankroll: float,
    ) -> dict | None:
        """Kelly criterion: mise optimale fractionnelle.

        Formule: f* = (p * (odds-1) - (1-p)) / (odds-1)
        Cap à 25% de la bankroll (fractional Kelly).
        Ne parier que si f* > 0 (espérance positive).
        """
        for prob, odds, side in [(prob_a, odds_a, "A"), (prob_b, odds_b, "B")]:
            if min_odds <= odds <= max_odds:
                b = odds - 1
                q = 1.0 - prob
                f_star = (prob * b - q) / b if b > 0 else 0.0
                if f_star > 0:
                    f_star = min(f_star, 0.25)
                    stake = round(f_star * bankroll, 2)
                    return {
                        "match_id": f"SYNTH_{idx:06d}",
                        "prob": round(prob, 4),
                        "odds": odds,
                        "side": side,
                        "stake": stake,
                    }
        return None

    # ── Backtesting sur données réelles ───────────────────────────

    def run_on_real_data(
        self,
        strategy: str = "value_betting",
        threshold: float = 1.10,
        bankroll: float = 10000.0,
        min_odds: float = 1.50,
        max_odds: float = 5.00,
        data_path: str | Path = "data/generated_features.csv",
    ) -> dict:
        """Backtest sur le dataset generated_features.csv (vrais matchs).

        Itère chronologiquement sur les matchs, prédit prob_a avec le modèle,
        génère des odds réalistes (avec overround 3%), applique la stratégie,
        et enregistre les résultats.

        Args:
            strategy: Nom de la stratégie.
            threshold: Seuil de value.
            bankroll: Bankroll initiale.
            min_odds: Cote minimale.
            max_odds: Cote maximale.
            data_path: Chemin vers le CSV.

        Returns:
            Même dict que run().
        """
        valid = {"value_betting", "favori_modere", "contrarien", "kelly_criterion"}
        if strategy not in valid:
            return {
                "status": "error",
                "detail": f"Stratégie inconnue: {strategy}. "
                           f"Choisir parmi {valid}",
            }

        df = pd.read_csv(data_path)
        if df.empty:
            return {"status": "error", "detail": "Fichier de données vide."}

        df = df.sort_values("tourney_date").reset_index(drop=True)

        bankroll_current = bankroll
        bankroll_history = [bankroll]
        bet_history: list[dict] = []
        peak = bankroll

        strategy_map = {
            "value_betting": self._value_betting,
            "favori_modere": self._favori_modere,
            "contrarien": self._contrarien,
            "kelly_criterion": self._kelly_criterion,
        }
        apply = strategy_map[strategy]

        for idx, (_, match) in enumerate(df.iterrows()):
            prob_a = self._predict(match.to_dict())
            prob_b = 1.0 - prob_a
            odds_a, odds_b = self._realistic_odds(prob_a)

            target = match.get("target", -1)
            if target not in (0, 1):
                continue
            actual_winner_won = target == 1

            if strategy in ("value_betting", "kelly_criterion"):
                bet = apply(
                    prob_a, prob_b, odds_a, odds_b,
                    threshold, min_odds, max_odds,
                    idx, bankroll_current,
                )
            else:
                bet = apply(
                    prob_a, prob_b, odds_a, odds_b,
                    threshold, min_odds, max_odds,
                    idx,
                )

            if bet is not None:
                bet["match_id"] = str(match.get("match_id", f"REAL_{idx:06d}"))

                if bet["side"] == "A":
                    bet_won = actual_winner_won
                else:
                    bet_won = not actual_winner_won

                bet["result"] = "win" if bet_won else "loss"
                if bet_won:
                    bet["pnl"] = round(bet["stake"] * (bet["odds"] - 1), 2)
                else:
                    bet["pnl"] = round(-bet["stake"], 2)

                bankroll_current += bet["pnl"]
                bet_history.append(bet)

            bankroll_history.append(round(bankroll_current, 2))
            if bankroll_current > peak:
                peak = bankroll_current

        return self._compute_metrics(
            strategy, bankroll, bankroll_current,
            bankroll_history, bet_history,
        )

    @staticmethod
    def _realistic_odds(prob_a: float) -> tuple[float, float]:
        """Génère des odds avec overround bookmaker (~3%).

        Les bookmakers ajoutent une marge implicite pour garantir
        un profit quelle que soit l'issue. Cette méthode simule
        cela en gonflant les probabilités puis en re-normalisant.

        Args:
            prob_a: Probabilité estimée que le joueur A gagne.

        Returns:
            Tuple (odds_a, odds_b).
        """
        margin = 0.03
        market_prob_a = prob_a * (1 + margin)
        market_prob_b = (1 - prob_a) * (1 + margin)
        total = market_prob_a + market_prob_b
        return (
            round(1.0 / (market_prob_a / total), 4),
            round(1.0 / (market_prob_b / total), 4),
        )

    # ── Métriques ─────────────────────────────────────────────────

    @staticmethod
    def _compute_metrics(
        strategy: str,
        bankroll_initial: float,
        bankroll_final: float,
        bankroll_history: list[float],
        bet_history: list[dict],
    ) -> dict:
        """Calcule les métriques de performance du backtesting."""
        total_bets = len(bet_history)

        if total_bets == 0:
            return {
                "strategy": strategy,
                "bankroll_initial": bankroll_initial,
                "bankroll_final": bankroll_initial,
                "roi_percent": 0.0,
                "sharpe_ratio": 0.0,
                "max_drawdown_percent": 0.0,
                "total_bets": 0,
                "win_rate": 0.0,
                "avg_odds": 0.0,
                "bankroll_history": bankroll_history,
                "bet_history": [],
                "status": "ok",
                "note": "Aucun pari placé (conditions non remplies).",
            }

        wins = sum(1 for b in bet_history if b["result"] == "win")
        roi_percent = ((bankroll_final - bankroll_initial) / bankroll_initial) * 100
        win_rate = wins / total_bets
        avg_odds = float(np.mean([b["odds"] for b in bet_history]))

        # Ratio de Sharpe annualisé (252 jours)
        pnls = np.array([b["pnl"] for b in bet_history])
        returns = pnls / bankroll_initial
        std_ret = float(np.std(returns))
        sharpe_ratio = (
            float(np.mean(returns)) / std_ret * np.sqrt(252)
            if std_ret > 0 else 0.0
        )

        # Max drawdown
        running_max = np.maximum.accumulate(bankroll_history)
        drawdowns = (np.array(bankroll_history) - running_max) / running_max
        max_drawdown_percent = float(np.min(drawdowns) * 100)

        return {
            "strategy": strategy,
            "bankroll_initial": bankroll_initial,
            "bankroll_final": round(bankroll_final, 2),
            "roi_percent": round(roi_percent, 2),
            "sharpe_ratio": round(sharpe_ratio, 4),
            "max_drawdown_percent": round(max_drawdown_percent, 2),
            "total_bets": total_bets,
            "win_rate": round(win_rate, 4),
            "avg_odds": round(avg_odds, 4),
            "bankroll_history": bankroll_history,
            "bet_history": bet_history,
            "status": "ok",
        }
