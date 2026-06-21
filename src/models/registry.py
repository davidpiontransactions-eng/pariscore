"""ModelRegistry sport-agnostic.

Permet d'enregistrer et d'interroger des modèles de prédiction
pour différents sports (tennis, UFC, etc.) via une interface unifiée.

Utilisation:
    registry = SportModelRegistry()
    registry.register("tennis", tennis_entry)
    prob = registry.predict("tennis", features)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Optional

import numpy as np

logger = logging.getLogger("pariscore.registry")


@dataclass
class ModelEntry:
    """Entrée du registry pour un sport.

    Attributes:
        sport: Identifiant du sport ("tennis", "ufc", ...).
        model: Modèle sklearn-compatible (pip install scikit-learn).
            Doit exposer predict_proba(X) -> array of shape (n_samples, 2).
        pipeline: Pipeline de features sport-specific.
            Doit exposer transform(raw_data: dict) -> dict.
        feature_columns: Liste ordonnée des colonnes attendues par le modèle.
        calibrator: Calibrateur optionnel (PlattScaling, etc.).
            Doit exposer calibrate(prob: float) -> float.
        factor_extractor: Fonction optionnelle qui génère les key factors.
            Reçoit features: dict -> retourne list[dict].
        model_loaded: True si le modèle a été chargé avec succès.
        model_version: Version sémantique du modèle.
        loaded_at: Timestamp du chargement.
        metadata: Dict libre pour métadonnées supplémentaires.
    """
    sport: str
    model: Any = None
    pipeline: Any = None
    feature_columns: list[str] = field(default_factory=list)
    calibrator: Optional[Any] = None
    factor_extractor: Optional[Callable] = None
    model_loaded: bool = False
    model_version: str = "0.0.0"
    loaded_at: Optional[datetime] = None
    metadata: dict = field(default_factory=dict)


class SportModelRegistry:
    """Registry thread-safe pour tous les modèles sportifs.

    Singleton accessible via MODEL_REGISTRY.
    Thread-safe car toutes les opérations sont des lectures/écritures atomiques
    sur un dict (GIL-protégé en CPython).
    """

    def __init__(self):
        self._entries: dict[str, ModelEntry] = {}

    # ── Registration ──

    def register(self, sport: str, entry: ModelEntry) -> None:
        """Enregistre un modèle pour un sport.

        Args:
            sport: Identifiant unique du sport.
            entry: ModelEntry avec modèle et pipeline chargés.
        """
        if sport in self._entries:
            logger.warning(f"Registry : remplacement du modèle existant pour '{sport}'")
        self._entries[sport] = entry
        logger.info(f"Registry : modèle '{sport}' enregistré (v{entry.model_version})")

    def unregister(self, sport: str) -> None:
        """Supprime un modèle du registry."""
        self._entries.pop(sport, None)
        logger.info(f"Registry : modèle '{sport}' retiré")

    # ── Consultation ──

    def get(self, sport: str) -> Optional[ModelEntry]:
        """Retourne l'entrée du registry pour un sport."""
        return self._entries.get(sport)

    def list_sports(self) -> list[str]:
        """Liste tous les sports enregistrés."""
        return list(self._entries.keys())

    @property
    def loaded_sports(self) -> list[str]:
        """Liste des sports dont le modèle est chargé."""
        return [s for s, e in self._entries.items() if e.model_loaded]

    # ── Prédiction ──

    def predict(self, sport: str, features: dict) -> float:
        """Prédit la probabilité via le modèle du sport.

        Args:
            sport: Identifiant du sport.
            features: Dictionnaire des features (doit contenir les clés
                     de feature_columns).

        Returns:
            Probabilité calibrée [0, 1].
            Retourne 0.5 (neutre) si le modèle n'est pas disponible.
        """
        entry = self.get(sport)
        if not entry or not entry.model_loaded or entry.model is None:
            logger.warning(f"Registry : modèle '{sport}' non chargé, fallback 0.5")
            return 0.5

        try:
            # Extraire les features dans l'ordre des colonnes du modèle
            cols = entry.feature_columns
            x = np.array([[(0.0 if features.get(col) is None else features[col]) for col in cols]], dtype=np.float64)

            # Prédiction
            prob = float(entry.model.predict_proba(x)[0, 1])

            # Calibration optionnelle
            if entry.calibrator is not None:
                prob = entry.calibrator.calibrate(prob)

            return np.clip(prob, 0.0, 1.0)

        except Exception as e:
            logger.error(f"Registry : erreur predict('{sport}') : {e}")
            return 0.5

    def predict_batch(self, sport: str, features_list: list[dict]) -> list[float]:
        """Prédit les probabilités pour une liste de vecteurs de features."""
        return [self.predict(sport, f) for f in features_list]

    # ── Métriques ──

    def summary(self) -> dict:
        """Retourne un résumé de tous les modèles enregistrés."""
        return {
            "total_sports": len(self._entries),
            "loaded_sports": self.loaded_sports,
            "entries": {
                sport: {
                    "model_loaded": e.model_loaded,
                    "model_version": e.model_version,
                    "n_features": len(e.feature_columns),
                    "loaded_at": e.loaded_at.isoformat() if e.loaded_at else None,
                }
                for sport, e in self._entries.items()
            },
        }


# ── Instance globale (singleton) ──

MODEL_REGISTRY = SportModelRegistry()
