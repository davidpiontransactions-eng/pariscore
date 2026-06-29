"""
Chargeur de données tennis (Sackmann / TennisMyLife).

Sources:
  - https://github.com/JeffSackmann/tennis_atp (original, 404 depuis 2026)
  - https://stats.tennismylife.org/ (fork MIT, ATP IDs, 1968-2026)
  - 50 000+ matchs ATP avec statistiques détaillées

Compatible avec les deux formats. Détection automatique.
"""

from __future__ import annotations

import pandas as pd
from pathlib import Path
from typing import Optional


# Colonnes minimales requises du dataset Sackmann
REQUIRED_COLUMNS = [
    "match_id", "tourney_id", "tourney_name", "surface",
    "tourney_date", "round",
    "winner_id", "winner_name", "winner_hand", "winner_ht", "winner_ioc",
    "loser_id", "loser_name", "loser_hand", "loser_ht", "loser_ioc",
    "score", "minutes",
    "w_ace", "w_df", "w_svpt", "w_1stIn", "w_1stWon", "w_2ndWon", "w_SvGms",
    "l_ace", "l_df", "l_svpt", "l_1stIn", "l_1stWon", "l_2ndWon", "l_SvGms",
    "w_bpSaved", "w_bpFaced", "l_bpSaved", "l_bpFaced",
]


def load_sackmann(
    data_dir: str | Path,
    years: Optional[list[int]] = None,
) -> pd.DataFrame:
    """Charge les fichiers tennis depuis un répertoire local.

    Compatible Sackmann ET TennisMyLife. Détection auto des colonnes.

    Args:
        data_dir: Chemin vers le répertoire contenant les fichiers CSV.
                  Format attendu: {data_dir}/atp_matches_{year}.csv
        years: Liste d'années à charger (ex: [2023, 2024]).
               Si None, charge tout (2010-2026).

    Returns:
        DataFrame brut avec les colonnes normalisées.
    """
    data_dir = Path(data_dir)
    if not data_dir.exists():
        raise FileNotFoundError(
            f"Répertoire de données introuvable: {data_dir}\n"
            "Téléchargez depuis https://stats.tennismylife.org/"
        )

    if years is None:
        years = list(range(2010, 2027))

    frames = []
    for year in years:
        fpath = data_dir / f"atp_matches_{year}.csv"
        if not fpath.exists():
            continue
        df = pd.read_csv(fpath, low_memory=False)
        df["year"] = year
        frames.append(df)

    if not frames:
        raise ValueError(
            f"Aucun fichier trouvé dans {data_dir} "
            f"pour les années {years[0]}-{years[-1]}"
        )

    df = pd.concat(frames, ignore_index=True)

    # ── Normalisation cross-format ──
    # TennisMyLife (TML) n'a pas 'tourney_year' → on parse depuis tourney_date
    if "tourney_year" not in df.columns:
        td = pd.to_datetime(df["tourney_date"], format="%Y%m%d", errors="coerce")
        df["tourney_year"] = td.dt.year

    # TennisMyLife n'a pas 'match_id' → générer depuis tourney_id + match_num
    if "match_id" not in df.columns:
        if "match_num" in df.columns:
            # match_num peut être NaN → ces lignes reçoivent un ID basé sur winner+loser
            nan_mask = df["match_num"].isna()
            df["match_id"] = (
                df["tourney_id"].astype(str) + "_M" + df["match_num"].fillna(0).astype(int).astype(str)
            )
            if nan_mask.any():
                unique_ids = df[nan_mask].apply(
                    lambda r: str(r["tourney_date"]) + "_" + "_".join(sorted([str(r["winner_id"]), str(r["loser_id"])])),
                    axis=1,
                )
                df.loc[nan_mask, "match_id"] = unique_ids
        else:
            # Fallback ultra-conservateur : concaténer winner_id + loser_id triés
            df["match_id"] = df.apply(
                lambda r: "_".join(sorted([str(r["winner_id"]), str(r["loser_id"])])),
                axis=1,
            )

    # Colonnes Sackmann absentes chez TennisMyLife → valeurs par défaut
    for col in ["tourney_country", "tourney_lat", "tourney_lon"]:
        if col not in df.columns:
            df[col] = None

    # Force les colonnes numériques (évite strings après concat)
    numeric_cols = [
        "w_ace","w_df","w_svpt","w_1stIn","w_1stWon","w_2ndWon","w_SvGms",
        "w_bpSaved","w_bpFaced",
        "l_ace","l_df","l_svpt","l_1stIn","l_1stWon","l_2ndWon","l_SvGms",
        "l_bpSaved","l_bpFaced",
        "winner_ht","loser_ht","winner_age","loser_age",
        "winner_rank","loser_rank","winner_rank_points","loser_rank_points",
        "minutes","draw_size","match_num",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Date normalisée
    df["tourney_date"] = pd.to_datetime(df["tourney_date"], format="%Y%m%d", errors="coerce")

    return df


def normalize_sackmann(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise le DataFrame Sackmann en format Pariscore.

    Transforme les colonnes vainqueur/perdant en lignes joueur A / joueur B
    et calcule les métriques brutes nécessaires aux features.
    """
    records = []

    for _, row in df.iterrows():
        # Match aller (joueur A = winner)
        match_a = _extract_player_match(row, side="winner")
        records.append(match_a)

        # Match retour (joueur B = loser)
        match_b = _extract_player_match(row, side="loser")
        records.append(match_b)

    result = pd.DataFrame(records)
    result = result.sort_values(["player_id", "match_date"]).reset_index(drop=True)

    return result


def _extract_player_match(row: pd.Series, side: str) -> dict:
    """Extrait les données d'un joueur pour un match."""
    if side == "winner":
        pid = row["winner_id"]
        name = row["winner_name"]
        hand = row["winner_hand"]
        height = row["winner_ht"]
        ioc = row["winner_ioc"]
        opp_id = row["loser_id"]
        is_winner = 1
        ace = row["w_ace"]
        df_val = row["w_df"]
        svpt = row["w_svpt"]
        first_in = row["w_1stIn"]
        first_won = row["w_1stWon"]
        second_won = row["w_2ndWon"]
        sv_gms = row["w_SvGms"]
        bp_saved = row["w_bpSaved"]
        bp_faced = row["w_bpFaced"]
        opp_bp_saved = row["l_bpSaved"]
        opp_bp_faced = row["l_bpFaced"]
    else:
        pid = row["loser_id"]
        name = row["loser_name"]
        hand = row["loser_hand"]
        height = row["loser_ht"]
        ioc = row["loser_ioc"]
        opp_id = row["winner_id"]
        is_winner = 0
        ace = row["l_ace"]
        df_val = row["l_df"]
        svpt = row["l_svpt"]
        first_in = row["l_1stIn"]
        first_won = row["l_1stWon"]
        second_won = row["l_2ndWon"]
        sv_gms = row["l_SvGms"]
        bp_saved = row["l_bpSaved"]
        bp_faced = row["l_bpFaced"]
        opp_bp_saved = row["w_bpSaved"]
        opp_bp_faced = row["w_bpFaced"]

    # Calcul des métriques brutes
    srv_pts = (first_in if pd.notna(first_in) else 0) + (second_won if pd.notna(second_won) else 0)
    total_srv_pts = (svpt if pd.notna(svpt) else 0)
    ret_pts = _calc_ret_pts_won(row, side)

    return {
        "match_id": row.get("match_id", f"{row['tourney_id']}_{pid}_{opp_id}"),
        "tourney_id": row["tourney_id"],
        "tourney_name": row["tourney_name"],
        "surface": str(row.get("surface", "")).lower(),
        "match_date": row["tourney_date"],
        "tourney_date": row["tourney_date"],
        "round": row["round"],
        "tourney_level": row.get("tourney_level", "A"),
        "tourney_country": row.get("tourney_country"),
        "tourney_lat": row.get("tourney_lat"),
        "tourney_lon": row.get("tourney_lon"),
        "player_id": str(pid),
        "player_name": name,
        "player_hand": hand,
        "player_ht": height,
        "player_nationality": ioc,
        "opponent_id": str(opp_id),
        "is_winner": is_winner,
        "minutes": row.get("minutes"),
        "score": row.get("score"),
        # Stats brutes
        "srv_pts_won_pct": (srv_pts / total_srv_pts * 100) if pd.notna(total_srv_pts) and total_srv_pts > 0 else None,
        "ret_pts_won_pct": ret_pts,
        "ace_count": ace,
        "df_count": df_val,
        "first_in_pct": (first_in / svpt * 100) if pd.notna(svpt) and svpt > 0 else None,
        "first_won_pct": (first_won / first_in * 100) if pd.notna(first_in) and first_in > 0 else None,
        "second_won_pct": (second_won / (svpt - first_in) * 100)
            if pd.notna(svpt) and pd.notna(first_in) and (svpt - first_in) > 0 else None,
        "bp_converted_pct": None,  # Calculé séparément
        "bp_saved_pct": (bp_saved / bp_faced * 100) if pd.notna(bp_faced) and bp_faced > 0 else None,
        "tb_won_pct": None,  # Nécessite les données tie-break
    }


def _calc_ret_pts_won(row: pd.Series, side: str) -> Optional[float]:
    """Calcule le % de points retour gagnés.

    Retour = total points servis par l'adversaire − points gagnés par l'adversaire au service
    """
    if side == "winner":
        opp_svpt = row.get("l_svpt", 0)
        opp_first_won = row.get("l_1stWon", 0)
        opp_second_won = row.get("l_2ndWon", 0)
    else:
        opp_svpt = row.get("w_svpt", 0)
        opp_first_won = row.get("w_1stWon", 0)
        opp_second_won = row.get("w_2ndWon", 0)

    if pd.isna(opp_svpt) or opp_svpt == 0:
        return None

    opp_pts_won = (opp_first_won if pd.notna(opp_first_won) else 0) + \
                  (opp_second_won if pd.notna(opp_second_won) else 0)
    ret_pts = opp_svpt - opp_pts_won
    return (ret_pts / opp_svpt * 100) if opp_svpt > 0 else None
