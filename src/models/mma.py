"""Modele UFC pour SportModelRegistry.

Wrappe UFCPipeline en modele sklearn-compatible.
Phase MVP : baseline basee sur EWMA differential.
"""

from __future__ import annotations

import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin


class UfcBaselineModel(BaseEstimator, ClassifierMixin):
    """Baseline UFC basee sur EWMA Strike Differential + True Talent."""

    def __init__(self, strike_weight: float = 0.15, td_weight: float = 0.10,
                 talent_weight: float = 0.30, intercept: float = 0.0):
        self.strike_weight = strike_weight
        self.td_weight = td_weight
        self.talent_weight = talent_weight
        self.intercept = intercept

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        log_odds = self.intercept * np.ones(X.shape[0])
        if X.shape[1] >= 1:
            log_odds += self.strike_weight * X[:, 0]
        if X.shape[1] >= 2:
            log_odds += self.td_weight * X[:, 1]
        if X.shape[1] >= 3:
            log_odds += self.talent_weight * X[:, 2]
        prob_a = 1.0 / (1.0 + np.exp(-log_odds))
        return np.column_stack([1.0 - prob_a, prob_a])
