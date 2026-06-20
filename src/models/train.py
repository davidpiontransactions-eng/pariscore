"""
Entraînement du modèle Random Forest Pariscore.

Basé sur Dryja (2024) — Random Forest champion (RF > XGBoost
en calibrage probabiliste malgré une précision brute légèrement inférieure).

Paramètres validés:
  - 600 arbres (n_estimators)
  - max_depth=10
  - min_samples_leaf=4
  - Platt Scaling pour calibration
  - Time-aware expanding window CV (5 folds)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score, brier_score_loss, roc_auc_score, log_loss,
)
from sklearn.model_selection import TimeSeriesSplit
import joblib
from pathlib import Path


# Hyperparamètres validés (Dryja + tuning Session 1)
RF_PARAMS = {
    "n_estimators": 600,
    "max_depth": 10,
    "min_samples_leaf": 4,
    "max_features": "sqrt",
    "random_state": 42,
    "n_jobs": -1,
    "class_weight": "balanced",
}

# Feature columns attendues par le modèle
FEATURE_COLUMNS = [
    "serve_edge_A", "serve_edge_B",
    "clutch_A", "clutch_B",
    "h2h_context_score",
    "age_30_A", "age_30_B",
    "motivation_A", "motivation_B",
    "fatigue_A", "fatigue_B",
    "public_advantage",
    "srv_pts_won_pct_S_DIFF",
    "ret_pts_won_pct_S_DIFF",
    "srv_pts_won_S_A", "srv_pts_won_S_B",
    "ret_pts_won_S_A", "ret_pts_won_S_B",
]


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Prépare les features et la cible pour l'entraînement.

    Args:
        df: DataFrame des matchups (sortie de FeaturePipeline.run()).

    Returns:
        X: DataFrame avec les features sélectionnées.
        y: Série binaire (1 = joueur A gagne).
    """
    X = df[FEATURE_COLUMNS].copy()
    y = df["target"].copy()  # 1 = joueur A gagne, 0 = joueur B gagne

    # Remplacer les NaN par les médianes
    for col in X.columns:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median())

    return X, y


def train_random_forest(
    X: pd.DataFrame,
    y: pd.Series,
    n_splits: int = 5,
) -> tuple[RandomForestClassifier, dict]:
    """Entraîne un Random Forest avec validation temporelle.

    Args:
        X: Features.
        y: Cible.
        n_splits: Nombre de folds pour la TimeSeriesSplit.

    Returns:
        (modèle entraîné, métriques d'évaluation)
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    metrics = {"accuracy": [], "brier": [], "roc_auc": [], "log_loss": []}

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        # Modèle de base
        rf = RandomForestClassifier(**RF_PARAMS)

        # Calibration Platt
        calibrated = CalibratedClassifierCV(rf, method="sigmoid", cv=3)
        calibrated.fit(X_train.values, y_train.values)

        # Prédictions
        y_prob = calibrated.predict_proba(X_val.values)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)

        # Métriques
        metrics["accuracy"].append(accuracy_score(y_val, y_pred))
        metrics["brier"].append(brier_score_loss(y_val, y_prob))
        metrics["roc_auc"].append(roc_auc_score(y_val, y_prob))
        metrics["log_loss"].append(log_loss(y_val, y_prob))

        print(f"  Fold {fold + 1}/{n_splits} — "
              f"Acc: {metrics['accuracy'][-1]:.3f}, "
              f"Brier: {metrics['brier'][-1]:.3f}, "
              f"AUC: {metrics['roc_auc'][-1]:.3f}")

    # Entraînement final sur toutes les données
    final_rf = RandomForestClassifier(**RF_PARAMS)
    final_model = CalibratedClassifierCV(final_rf, method="sigmoid", cv=3)
    final_model.fit(X.values, y.values)

    # Feature importance
    importances = final_model.calibrated_classifiers_[0].estimator.feature_importances_
    feature_ranking = sorted(
        zip(FEATURE_COLUMNS, importances),
        key=lambda x: x[1], reverse=True,
    )

    print("\n=== Feature Importance ===")
    for name, imp in feature_ranking[:10]:
        print(f"  {name}: {imp:.3f}")

    # Résumé
    summary = {
        "accuracy_mean": np.mean(metrics["accuracy"]),
        "accuracy_std": np.std(metrics["accuracy"]),
        "brier_mean": np.mean(metrics["brier"]),
        "brier_std": np.std(metrics["brier"]),
        "roc_auc_mean": np.mean(metrics["roc_auc"]),
        "roc_auc_std": np.std(metrics["roc_auc"]),
        "log_loss_mean": np.mean(metrics["log_loss"]),
        "log_loss_std": np.std(metrics["log_loss"]),
        "feature_importance": dict(feature_ranking[:15]),
        "n_features": X.shape[1],
        "n_train_samples": X.shape[0],
    }

    return final_model, summary


def save_model(model, summary: dict, path: str | Path = "models") -> Path:
    """Sauvegarde le modèle et ses métadonnées."""
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)

    model_path = path / "pariscore_rf_v1.joblib"
    joblib.dump(model, model_path)

    # Métadonnées
    import json
    meta_path = path / "pariscore_rf_v1_meta.json"
    summary["model_file"] = str(model_path)
    with open(meta_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print(f"\n✅ Modèle sauvegardé: {model_path}")
    print(f"   Métadonnées: {meta_path}")
    return model_path


def load_model(path: str | Path = "models/pariscore_rf_v1.joblib"):
    """Charge un modèle entraîné."""
    return joblib.load(path)
