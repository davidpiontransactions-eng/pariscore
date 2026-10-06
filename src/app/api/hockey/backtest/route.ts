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

/**
 * Courbe de performance cumulée — le substitut au bankroll, décision validée
 * le 2026-10-06.
 *
 * Plutôt que d'inventer des cotes (option écartée : une cote fixe à 1,91
 * falsifierait le signal), on trace deux courbes en unités 0/1 :
 *   • attendu = cumul des probabilités annoncées par le modèle ;
 *   • observé = cumul des gains réellement observés (1 ou 0).
 * Un modèle calibré les fait suivre la même pente — c'est le test visuel de la
 * calibration, calculé sur des données réelles, sans aucun bookmaker.
 *
 * Les points sont décimés (pas de détails entropiques) pour garder le payload
 * lisible : la pente et l'écart entre les deux courbes sont l'information.
 */
function serieCumulee(
  previsions: readonly { unXDeux: readonly number[]; totalReel: number; totaux: readonly { ligne: number; under: number; over: number }[]; prolongation: boolean }[],
  lignes: readonly number[],
  points = 160,
): { attendu: number[]; observe: number[]; n: number } {
  let attendu = 0;
  let observe = 0;
  const A: number[] = [];
  const O: number[] = [];
  for (const p of previsions) {
    for (const t of p.totaux) {
      if (!lignes.includes(t.ligne)) continue;
      if (Number.isInteger(t.ligne) && p.totalReel === t.ligne) continue;
      const preditSous = t.under >= t.over;
      attendu += preditSous ? t.under : t.over;
      observe += preditSous === (p.totalReel <= Math.floor(t.ligne)) ? 1 : 0;
      A.push(+attendu.toFixed(2));
      O.push(observe);
    }
  }
  if (A.length <= points) return { attendu: A, observe: O, n: A.length };
  const pas = A.length / points;
  const a: number[] = [];
  const o: number[] = [];
  for (let i = 0; i < points; i++) {
    const idx = Math.min(A.length - 1, Math.round(i * pas));
    a.push(A[idx]);
    o.push(O[idx]);
  }
  return { attendu: a, observe: o, n: A.length };
}

export async function GET(request: Request) {
  const chargé = charger();
  if (!chargé) {
    return NextResponse.json(
      { error: "backtest KHL indisponible — data/khl_backtest.json absent (lancer scripts/scrape-khl-backtest.mjs)" },
      { status: 503 },
    );
  }

  const { fichier, previsions } = chargé;
  const lignes = LIGNES_DEFAUT;

  const url = new URL(request.url);
  const saisonFiltre = url.searchParams.get("saison");
  const fenetreJours = Number(url.searchParams.get("fenetre") ?? "0");

  // Filtre sur les PRÉVISIONS, pas sur les matchs à relancer.
  // Le walk-forward a déja couru sur les 3 saisons ; re-lancer `prevoir` sur
  // un sous-ensemble priverait la saison courante de l'historique des
  // saisons précédentes — précisément ce qu'on veut mesurer.
  let vues = previsions;
  if (saisonFiltre) vues = vues.filter((p) => p.saison === saisonFiltre);
  if (fenetreJours > 0 && vues.length) {
    const derniere = vues[vues.length - 1].date;
    const seuil = new Date(`${derniere}T00:00:00Z`);
    seuil.setUTCDate(seuil.getUTCDate() - fenetreJours);
    const seuilIso = seuil.toISOString().slice(0, 10);
    vues = vues.filter((p) => p.date >= seuilIso);
  }

  // Périmètre explicite : le 1X2 est mesuré EN TEMPS RÉGLEMENTAIRE, les
  // matchs prolongés exclus et COMPTE. On annonce le périmètre plutôt que
  // de laisser un winrate sans contexte.
  const periode = resultatUnXDeux(vues, false);
  const periodeAvecProlongation = resultatUnXDeux(vues, true);

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
      previsionsTotales: previsions.length,
      previsions: vues.length,
      previsionsSaisonCourante: previsions.filter((p) => p.date >= "2026-09-01").length,
    },

    // ── Filtre appliqué (explicite : la carte doit annoncer son périmètre) ──
    filtres: {
      saison: saisonFiltre ?? null,
      fenetreJours: fenetreJours > 0 ? fenetreJours : null,
      applique: Boolean(saisonFiltre) || fenetreJours > 0,
      dateDebut: vues[0]?.date ?? null,
      dateFin: vues[vues.length - 1]?.date ?? null,
    },

    // ── 1. Accuracy globale ──
    accuracy: {
      winrateGlobal: winrateGlobal(vues, lignes),
      parLigne: resultatsLignes(vues, lignes),
      unXDeuxTempsReglementaire: periode,
      unXDeuxAvecProlongation: periodeAvecProlongation,
    },

    // ── 2. Fiabilité des lignes de totaux ──
    fiabilite: fiabiliteLignes(vues, lignes),

    // ── 3. Calibration de la confiance ──
    calibration: calibration(vues, lignes),

    // ── 4. Courbe de performance cumulée (substitut du bankroll) ──
    serie: serieCumulee(vues, lignes),

    // ── Rappel des limites, affichées telles quelles ──
    limites: [
      "Aucune cote KHL historique : ROI, Yield et Bankroll sont INAPPLICABLES, pas simplement non affichés.",
      "Le 1X2 « temps réglementaire » exclut les matchs prolongés — le nul n'y existe pas. `exclusProlongation` en donne le nombre.",
      "Les matchs OT/SO sont FLAGGÉS, pas supprimés : les lignes de buts les incluent, comme le marché.",
      "Sous 30 observations, `faible: true` sur la métrique — ne pas lire un pourcentage sur un effectif mince.",
    ],
  });
}