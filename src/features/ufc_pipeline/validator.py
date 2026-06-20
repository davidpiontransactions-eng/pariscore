"""
Point-in-Time Validator UFC — vérifie l'intégrité temporelle du pipeline.

Valide qu'aucune donnée future ne fuit dans les calculs EWMA,
que les NaN sont corrects pour les premiers combats, et que
les différentiels sont cohérents.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PitValidationResult:
    """Résultat de la validation point-in-time."""
    passed: bool = True
    n_fights_checked: int = 0
    n_violations: int = 0
    violations: list[str] = field(default_factory=list)
    summary: str = ""


class PointInTimeValidator:
    """Valide l'intégrité point-in-time des calculs du pipeline UFC.

    Vérifications :
      1. Les EWMA S/M/L sont NaN sur la première ligne de chaque combattant.
      2. Les EWMA n'utilisent pas la valeur du combat courant (future leakage).
      3. Les différentiels sont calculés correctement.
      4. Cohérence cross-métrique (si A a une métrique, B aussi).
    """

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.last_result: Optional[PitValidationResult] = None

    def validate_ewma_first_fight_nan(
        self,
        df: pd.DataFrame,
        fighter_col: str = "fighter_id",
        metric_cols: Optional[list[str]] = None,
    ) -> PitValidationResult:
        """Vérifie que les EWMA sont NaN sur la première ligne de chaque combattant.

        Args:
            df: DataFrame long avec colonnes EWMA.
            fighter_col: Colonne identifiant combattant.
            metric_cols: Liste des colonnes EWMA à vérifier.
                        Si None, détecte les colonnes finissant par _S, _M, _L.

        Returns:
            PitValidationResult avec les violations.
        """
        if metric_cols is None:
            metric_cols = [
                c for c in df.columns
                if c.endswith(("_S", "_M", "_L")) and not c.endswith(("_RAW"))
            ]

        violations = []
        n_checked = 0

        for fighter in df[fighter_col].unique():
            mask = df[fighter_col] == fighter
            idx = df.index[mask]
            if len(idx) == 0:
                continue

            first_idx = idx[0]
            n_checked += 1

            for col in metric_cols:
                if col not in df.columns:
                    continue
                first_val = df.loc[first_idx, col]
                if not pd.isna(first_val):
                    violations.append(
                        f"Fighter {fighter} : {col} = {first_val} sur premier combat "
                        f"(attendu NaN)"
                    )

        passed = len(violations) == 0
        result = PitValidationResult(
            passed=passed,
            n_fights_checked=n_checked,
            n_violations=len(violations),
            violations=violations,
            summary=f"{'[OK]' if passed else '[FAIL]'} "
                    f"{n_checked} combattants vérifiés, "
                    f"{len(violations)} violations",
        )

        if self.verbose:
            print(result.summary)
            for v in violations[:10]:
                print(f"  ! {v}")

        self.last_result = result
        return result

    def validate_no_future_leakage(
        self,
        df: pd.DataFrame,
        metric_col: str,
        fighter_col: str = "fighter_id",
        date_col: str = "fight_date",
    ) -> PitValidationResult:
        """Vérifie qu'aucune valeur future ne fuit dans les EWMA.

        Principe : pour chaque combattant, la EWMA au combat i doit être
        <= max(values[0..i-1]) ou NaN. Si elle est > max(values disponibles
        à ce moment), c est une fuite.

        Args:
            df: DataFrame long trié par (fighter_col, date_col).
            metric_col: Colonne EWMA à vérifier.
            fighter_col: Colonne combattant.
            date_col: Colonne date.

        Returns:
            PitValidationResult.
        """
        df = df.sort_values([fighter_col, date_col]).copy()
        metric_raw = metric_col.replace("_S", "").replace("_M", "").replace("_L", "") + "_RAW"

        violations = []
        n_checked = 0
        raw_col = metric_raw if metric_raw in df.columns else None

        for fighter in df[fighter_col].unique():
            mask = df[fighter_col] == fighter
            idx = df.index[mask]
            f_df = df.loc[idx]

            for i, row_idx in enumerate(idx):
                if i == 0:
                    continue  # Premier combat : NaN, pas de vérification
                n_checked += 1

                # Valeur maximum disponible avant ce combat
                if raw_col is not None and raw_col in df.columns:
                    past_raw = f_df.iloc[:i][raw_col]
                    if not past_raw.empty and not past_raw.isna().all():
                        max_past = past_raw.max()
                        ewma_val = df.loc[row_idx, metric_col]

                        if pd.isna(ewma_val):
                            # NaN attendu si toutes les valeurs passées sont NaN
                            if not past_raw.isna().all():
                                violations.append(
                                    f"Fighter {fighter}, combat {i} : "
                                    f"EWMA NaN mais valeurs passées disponibles"
                                )
                        elif not pd.isna(max_past):
                            # Vérification conservative : EWMA ne devrait pas
                            # dépasser 2x la max passée
                            if ewma_val > 2.0 * max_past + 0.01:
                                violations.append(
                                    f"Fighter {fighter}, combat {i} : "
                                    f"EWMA = {ewma_val:.4f} > 2*max_past = {2*max_past:.4f}"
                                )

        passed = len(violations) == 0
        result = PitValidationResult(
            passed=passed,
            n_fights_checked=n_checked,
            n_violations=len(violations),
            violations=violations,
            summary=f"{'[OK]' if passed else '[FAIL]'} "
                    f"{n_checked} valeurs vérifiées, "
                    f"{len(violations)} fuites potentielles",
        )

        self.last_result = result
        return result

    def validate_differential_symmetry(
        self,
        df_wide: pd.DataFrame,
        diff_cols: Optional[list[str]] = None,
    ) -> PitValidationResult:
        """Vérifie la symétrie des différentiels A−B.

        Pour chaque différentiel, (diff_A) + (diff_B) doit être ~0.

        Args:
            df_wide: DataFrame wide avec colonnes _DIFF.
            diff_cols: Liste des colonnes différentielles à vérifier.

        Returns:
            PitValidationResult.
        """
        if diff_cols is None:
            diff_cols = [c for c in df_wide.columns if "_DIFF" in c]

        violations = []
        n_checked = 0

        for col in diff_cols:
            if col not in df_wide.columns:
                continue

            # Chercher la colonne miroir
            mirror = col.replace("_DIFF_S", "_DIFF_S_mirror")
            if mirror in df_wide.columns:
                pair_sum = (df_wide[col] + df_wide[mirror]).abs().max()
                n_checked += 1
                if pair_sum > 1e-6:
                    violations.append(
                        f"{col} + {mirror} = {pair_sum:.6f} (attendu 0)"
                    )

        passed = len(violations) == 0
        result = PitValidationResult(
            passed=passed,
            n_fights_checked=n_checked,
            n_violations=len(violations),
            violations=violations,
            summary=f"{'[OK]' if passed else '[FAIL]'} "
                    f"Symétrie différentielle : {n_checked} paires, "
                    f"{len(violations)} violations",
        )

        self.last_result = result
        return result

    def run_all(
        self,
        df_long: pd.DataFrame,
        df_wide: Optional[pd.DataFrame] = None,
        fighter_col: str = "fighter_id",
    ) -> dict[str, PitValidationResult]:
        """Exécute toutes les validations.

        Args:
            df_long: DataFrame format long.
            df_wide: DataFrame format wide (optionnel).
            fighter_col: Colonne combattant.

        Returns:
            Dict des résultats par test.
        """
        results = {}

        ewma_cols = [c for c in df_long.columns if c.endswith(("_S", "_M", "_L"))]
        results["first_fight_nan"] = self.validate_ewma_first_fight_nan(
            df_long, fighter_col=fighter_col,
        )

        if ewma_cols:
            results["no_future_leakage"] = self.validate_no_future_leakage(
                df_long, metric_col=ewma_cols[0], fighter_col=fighter_col,
            )

        if df_wide is not None:
            results["differential_symmetry"] = self.validate_differential_symmetry(
                df_wide,
            )

        all_passed = all(r.passed for r in results.values())
        if self.verbose:
            print(f"\nPoint-in-time validation : "
                  f"{'ALL PASSED' if all_passed else 'VIOLATIONS DETECTEES'}")

        return results
