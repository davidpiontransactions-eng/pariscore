#!/usr/bin/env python3
"""Pariscore — Point d'entrée principal.

Usage:
    python run.py train          # Entraîner le modèle
    python run.py api            # Lancer l'API FastAPI
    python run.py generate       # Générer dataset synthétique
    python run.py pipeline       # Tester le pipeline
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import io
import sys
# Force UTF-8 for stdout/stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Ajouter la racine au PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent))


def cmd_train():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--real", action="store_true", help="Utiliser les donnees TennisMyLife")
    args, _ = parser.parse_known_args(sys.argv[2:])

    from src.features.pipeline import FeaturePipeline
    from src.models.train import prepare_features, train_random_forest, save_model

    print("=" * 60)
    print("  PARISCORE — Entraînement du modèle")
    print("=" * 60)

    if args.real:
        from src.data.sackmann_loader import load_sackmann, normalize_sackmann
        print("\n[1/4] Chargement des donnees TennisMyLife...")
        raw = load_sackmann("data/tennis_atp", years=[2023, 2024, 2025, 2026])
        print(f"       {len(raw)} matchs bruts charges")
        df = normalize_sackmann(raw)
        print(f"       {len(df)} lignes normalisees, {df['player_id'].nunique()} joueurs")
    else:
        from src.data.synthetic import generate_dataset
        print("\n[1/4] Generation du dataset synthetique...")
        df = generate_dataset(n_matches=5000)
        print(f"       {len(df)//2} matchs, {df['player_id'].nunique()} joueurs")

    # Pipeline features
    print("\n[2/4] Execution du pipeline de features...")
    pipeline = FeaturePipeline(min_matches_per_player=20)
    features = pipeline.run(df)
    print(f"       {len(features)} matchups, {len(features.columns)} colonnes")

    # Preparation
    print("\n[3/4] Preparation des donnees...")
    X, y = prepare_features(features)
    print(f"       {X.shape[0]} echantillons, {X.shape[1]} features")

    # Entrainement
    tag = "real" if args.real else "synth"
    print(f"\n[4/4] Entrainement Random Forest ({tag})...")
    model, summary = train_random_forest(X, y)

    # Sauvegarde
    save_model(model, summary, path="models")
    return summary


def cmd_api():
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"Lancement de l'API Pariscore sur http://{host}:{port}")
    print(f"   Documentation: http://localhost:{port}/docs")
    uvicorn.run("src.api.main:app", host=host, port=port, reload=False)


def cmd_generate():
    from src.data.synthetic import generate_dataset
    df = generate_dataset(n_matches=10000)
    output = Path("data/synthetic.parquet")
    output.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output, index=False)
    print(f"[OK] Dataset synthétique: {output} ({len(df)} lignes)")


def cmd_pipeline():
    from src.data.synthetic import generate_dataset
    from src.features.pipeline import FeaturePipeline

    print("[Test] Pipeline de features...")
    df = generate_dataset(n_matches=500)
    pipeline = FeaturePipeline(min_matches_per_player=10)
    features = pipeline.run(df)
    print(f"\n[OK] Pipeline OK — {len(features)} matchups")
    print(f"   Colonnes: {list(features.columns)}")

    # Afficher un échantillon
    print("\n[Data] Echantillon:")
    print(features[["match_id", "player_a_name", "player_b_name",
                     "h2h_context_score"]].head(10).to_string(index=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    commands = {
        "train": cmd_train,
        "api": cmd_api,
        "generate": cmd_generate,
        "pipeline": cmd_pipeline,
    }

    if command in commands:
        commands[command]()
    else:
        print(f"Commande inconnue: {command}")
        print(__doc__)
        sys.exit(1)
