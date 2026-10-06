/**
 * GET /api/hockey/backtest — métriques de calibration du modèle KHL.
 *
 * ── Ce qu'on affiche, et ce qu'on ne peut PAS afficher ────────────────────
 *
 * Aucune cote KHL historique n'existe : 0 champ de cote sur les 748 matchs du
 * calendrier local, 0 occurrence de « odds » sur hockeydb (mesuré le
 * 2026-10-06). ROI, Yield et Bankroll exigent un prix par pari — le rendre
 * ici serait le FABRIQUER. On affiche donc uniquement des métriques qui ne
 * dépendent d'aucun bookmaker : winrate, Brier, log-loss, calibration.
 *
 * La calibration est de toute façon la bonne mesure : si le modèle annonce
 * 56 % sur Under 5.5 et que l'historique donne 56 %, il est juste, et cela
 * ne dépend d'aucune cote. Le ROI dépend du prix ET de la marge, donc il ne
 * distingue pas un modèle bien calibré d'un modèle avantagé par un prix.
 *
 * ── Fichier volumineux, cache mémoire ────────────────────────────────────
 *
 * khl_backtest.json fait ~486 Ko et `prevoir()` parcourt 1663 matchs à chaque
 * appel. On le charge une fois et on le conserve, invalidé par mtime : un
 * scrape écrit le fichier, la lecture suivante voit le nouveau mtime sans
 * TTL à deviner.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

import {
  calibration,
  fiabiliteLignes,
  LIGNES_DEFAUT,
  prevoir,
  resultatUnXDeux,
  resultatsLignes,
  winrateGlobal,
  type MatchBacktest,
} from "@/lib/hockey/backtest";

type Fichier = {
  updatedAt: string;
  counts: Record<string, unknown>;
  canonisation?: { origineAlias?: string; aliasDerives?: number };
  notes?: string[];
  echecs?: { sid: string; nom: string; raison: string }[];
  matchs: {
    id: string;
    date: string;
    domicile: string;
    exterieur: string;
    butsDomicile: number;
    butsExterieur: number;
    prolongation: boolean;
    saison: string;
  }[];
};

const CHEMIN = join(process.cwd(), "data", "khl_backtest.json");

let cache: { mtime: number; fichier: Fichier; previsions: ReturnType<typeof prevoir> } | null = null;

function charger(): { fichier: Fichier; previsions: ReturnType<typeof prevoir> } | null {
  let mtime: number;
  try {
    mtime = statSync(CHEMIN).mtimeMs;
  } catch {
    return null;
  }
  if (cache && cache.mtime === mtime) return { fichier: cache.fichier, previsions: cache.previsions };

  const fichier = JSON.parse(readFileSync(CHEMIN, "utf8")) as Fichier;
  const matchs: MatchBacktest[] = fichier.matchs.map((m) => ({
    id: m.id,
    date: m.date,
    domicile: m.domicile,
    exterieur: m.exterieur,
    butsDomicile: m.butsDomicile,
    butsExterieur: m.butsExterieur,
    prolongation: m.prolongation,
    saison: m.saison,
  }));
  const previsions = prevoir(matchs, LIGNES_DEFAUT);
  cache = { mtime, fichier, previsions };
  return { fichier, previsions };
}

export async function GET() {
  const chargé = charger();
  if (!chargé) {
    return NextResponse.json(
      { error: "backtest KHL indisponible — data/khl_backtest.json absent (lancer scripts/scrape-khl-backtest.mjs)" },
      { status: 503 },
    );
  }

  const { fichier, previsions } = chargé;
  const lignes = LIGNES_DEFAUT;

  // Périmètre explicite : le 1X2 est mesuré EN TEMPS RÉGLEMENTAIRE, les
  // matchs prolongés exclus et COMPTE. On annonce le périmètre plutôt que
  // de laisser un winrate sans contexte.
  const periode = resultatUnXDeux(previsions, false);
  const periodeAvecProlongation = resultatUnXDeux(previsions, true);

  return NextResponse.json({
    // Jamais `source: "none"` : sans fichier, on rend 503 au-dessus.
    generatedAt: new Date().toISOString(),
    dataUpdatedAt: fichier.updatedAt,
    source: "HockeyTech modulekit — data/khl_backtest.json",

    // ── Périmètre : ce qui est analysé, et ce qui est exclu ──
    dataset: {
      ...fichier.counts,
      origineAlias: fichier.canonisation?.origineAlias,
      aliasDerives: fichier.canonisation?.aliasDerives,
      echecsSource: fichier.echecs ?? [],
      notes: fichier.notes ?? [],
      // Prévisions réellement produites < matchs : les équipes sans
      // historique au premier match de la saison n'ont pas de prédiction,
      // et le compter comme une prédiction fausse serait faux.
      previsions: previsions.length,
      previsionsSaisonCourante: previsions.filter((p) => p.date >= "2026-09-01").length,
    },

    // ── 1. Accuracy globale ──
    accuracy: {
      winrateGlobal: winrateGlobal(previsions, lignes),
      parLigne: resultatsLignes(previsions, lignes),
      unXDeuxTempsReglementaire: periode,
      unXDeuxAvecProlongation: periodeAvecProlongation,
    },

    // ── 2. Fiabilité des lignes de totaux ──
    fiabilite: fiabiliteLignes(previsions, lignes),

    // ── 3. Calibration de la confiance ──
    calibration: calibration(previsions, lignes),

    // ── Rappel des limites, affichées telles quelles ──
    limites: [
      "Aucune cote KHL historique : ROI, Yield et Bankroll sont INAPPLICABLES, pas simplement non affichés.",
      "Le 1X2 « temps réglementaire » exclut les matchs prolongés — le nul n'y existe pas. `exclusProlongation` en donne le nombre.",
      "Les matchs OT/SO sont FLAGGÉS, pas supprimés : les lignes de buts les incluent, comme le marché.",
      "Sous 30 observations, `faible: true` sur la métrique — ne pas lire un pourcentage sur un effectif mince.",
    ],
  });
}