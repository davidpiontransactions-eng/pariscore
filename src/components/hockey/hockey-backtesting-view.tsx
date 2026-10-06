"use client";

/**
 * Onglet Backtesting Hockey — métriques de calibration du modèle KHL.
 *
 * ── Ce qu'on affiche, et ce qu'on refuse d'afficher ───────────────────────
 *
 * Aucune cote KHL historique n'existe (0 champ sur 748 matchs, 0 « odds » sur
 * hockeydb, aucune vue de cotes dans le feed HockeyTech). ROI, Yield et
 * Bankroll exigent un prix par pari : la variable d'entrée n'existe pas.
 *
 * Décision validée le 2026-10-06 : les cartes ROI et Yield s'affichent en
 * `N/A` avec le motif, et le bankroll est REMPLACÉ par une courbe de
 * performance cumulée (attendu vs observé, en unités 0/1) — même visibilité,
 * calculée sur des données réelles. Simuler une cote fixe à 1,91 aurait
 * fabriqué un signal, ce qui viole l'intégrité de PariScore.
 *
 * ── Dénominateurs distincts, annoncés ─────────────────────────────────────
 *
 * 1X2 et Totaux ne mesurent pas la même population :
 *   1X2   → matchs TEMPS RÉGLEMENTAIRE, prolongations exclues (le nul n'y
 *           existe pas), l'exclusion est comptée
 *   Totaux→ tous les matchs, prolongations INCLUSES (le marché les intègre)
 * Les cartes portent donc chacune leur `N`. Les présenter côte à côte comme
 * deux mesures sur le même échantillon serait faux.
 */

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/tennis/kpi-card";
import { AlertTriangle, Info, TrendingUp, Target, ShieldQuestion } from "lucide-react";

// ── Types du payload ────────────────────────────────────────────────────────

type Taux = { valeur: number | null; n: number; faible: boolean };

type ResultatLigne = Taux & {
  ligne: number;
  predictsSous: number;
  predictsSur: number;
  annules: number;
};

type ResultatUnXDeux = Taux & {
  predictsDomicile: number;
  predictsNul: number;
  predictsExterieur: number;
  exclusProlongation: number;
};

type Fiabilite = {
  ligne: number;
  n: number;
  mae: number | null;
  partSousPrediction: number | null;
  partSurPrediction: number | null;
  biaisMoyen: number | null;
  faible: boolean;
};

type Bin = {
  de: number;
  a: number;
  annonce: number | null;
  observe: number | null;
  n: number;
  ecart: number | null;
  faible: boolean;
};

type Reponse = {
  generatedAt: string;
  dataUpdatedAt: string;
  source: string;
  dataset: Record<string, unknown> & {
    total?: number;
    tempsReglementaire?: number;
    prolongationOuShootout?: number;
    previsions?: number;
    previsionsTotales?: number;
    origineAlias?: string;
    notes?: string[];
    echecsSource?: { sid: string; nom: string; raison: string }[];
    saisons?: string[];
    equipes?: number;
  };
  filtres: { saison: string | null; fenetreJours: number | null; applique: boolean; dateDebut: string | null; dateFin: string | null };
  accuracy: {
    winrateGlobal: Taux;
    parLigne: ResultatLigne[];
    unXDeuxTempsReglementaire: ResultatUnXDeux;
    unXDeuxAvecProlongation: ResultatUnXDeux;
  };
  fiabilite: Fiabilite[];
  calibration: { brierUnXDeux: number | null; brierLignes: number | null; logLoss: number | null; ecartMoyen: number | null; bins: Bin[]; n: number; effectifFaible: boolean };
  serie: { attendu: number[]; observe: number[]; n: number };
  limites: string[];
};

const SAISONS = [
  { cle: "", label: "Toutes" },
  { cle: "2024/2025 Regular", label: "2024/25" },
  { cle: "2025/2026 Regular", label: "2025/26" },
  { cle: "2026/2027 Regular", label: "2026/27" },
];

const FENETRES = [
  { cle: 0, label: "Pleine période" },
  { cle: 30, label: "30 jours" },
];

// ── Formatage ───────────────────────────────────────────────────────────────

const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)} %`);
const nb = (v: number | null | undefined, d = 3) => (v == null ? "—" : v.toFixed(d));

/** Le badge ne doit jamais manquer : un pourcentage sans effectif est mensonger. */
function Badge({ children, ton = "alerte" }: { children: React.ReactNode; ton?: "alerte" | "info" | "ok" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold whitespace-nowrap",
        ton === "alerte" && "bg-amber-100 text-amber-800",
        ton === "info" && "bg-slate-100 text-slate-700",
        ton === "ok" && "bg-emerald-100 text-emerald-800",
      )}
    >
      {ton === "alerte" && <AlertTriangle className="w-3 h-3" />}
      {children}
    </span>
  );
}

/** Un taux avec son effectif et son avertissement, jamais la valeur seule. */
function ValeurAvecN({ t, unite = "%" }: { t: Taux; unite?: string }) {
  if (t.valeur == null) return <span className="text-muted-foreground">—</span>;
  const texte = unite === "%" ? `${(t.valeur * 100).toFixed(1)} %` : t.valeur.toFixed(3);
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="tabular-nums">{texte}</span>
      <span className="text-[0.7rem] font-normal text-muted-foreground tabular-nums">n = {t.n}</span>
      {t.faible && <Badge>échantillon réduit</Badge>}
    </span>
  );
}

// ── Courbe de performance cumulée ───────────────────────────────────────────

function CourbeCumulee({ attendu, observe }: { attendu: number[]; observe: number[] }) {
  const L = 640;
  const H = 200;
  const M = { t: 12, r: 12, b: 24, l: 44 };

  const max = Math.max(attendu[attendu.length - 1] ?? 1, observe[observe.length - 1] ?? 1, 1);
  const sx = (i: number) => M.l + (i / Math.max(1, attendu.length - 1)) * (L - M.l - M.r);
  const sy = (v: number) => H - M.b - (v / max) * (H - M.t - M.b);

  const trace = (pts: number[]) => pts.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");

  const echarts = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  // Écart final entre attendu et observé : c'est la calibration visible.
  const ecart = (observe[observe.length - 1] ?? 0) - (attendu[attendu.length - 1] ?? 0);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h4 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Performance cumulée — attendu vs observé
          </h4>
          <p className="text-[0.7rem] text-muted-foreground mt-1 max-w-[52ch]">
            Substitut du bankroll : unités 0/1, aucune cote utilisée. Un modèle calibré suit la même pente
            sur les deux courbes.
          </p>
        </div>
        <Badge ton={Math.abs(ecart) <= Math.max(2, max * 0.05) ? "ok" : "info"}>
          écart final {ecart >= 0 ? "+" : ""}
          {ecart.toFixed(1)}
        </Badge>
      </div>

      <svg viewBox={`0 0 ${L} ${H}`} className="w-full h-auto" role="img" aria-label="Courbe de performance cumulée">
        {echarts.map((v, i) => (
          <g key={i}>
            <line x1={M.l} y1={sy(v)} x2={L - M.r} y2={sy(v)} stroke="#ebebeb" strokeWidth="1" />
            <text x={M.l - 6} y={sy(v) + 3} fontSize="9" fill="#717171" textAnchor="end" className="tabular-nums">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        {/* Droite de parité : attendu = observé */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(attendu.length - 1)} y2={sy(max)} stroke="#c8c8c8" strokeWidth="1" strokeDasharray="3 3" />
        <path d={trace(attendu)} fill="none" stroke="#0288d1" strokeWidth="2" />
        <path d={trace(observe)} fill="none" stroke="#00a344" strokeWidth="2" />
        <text x={L - M.r} y={H - 6} fontSize="9" fill="#717171" textAnchor="end">
          n = {attendu.length} paris
        </text>
      </svg>

      <div className="flex items-center gap-4 mt-2 text-[0.7rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#0288d1] inline-block" /> attendu (probabilités annoncées)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#00a344] inline-block" /> observé (gains réels)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#c8c8c8] inline-block" style={{ background: "repeating-linear-gradient(90deg,#c8c8c8 0 3px,transparent 3px 6px)" }} /> parité
        </span>
      </div>
    </div>
  );
}

// ── Composant principal ─────────────────────────────────────────────────────

export function HockeyBacktestingView() {
  const [saison, setSaison] = useState("");
  const [fenetre, setFenetre] = useState(0);
  const [data, setData] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (saison) p.set("saison", saison);
    if (fenetre > 0) p.set("fenetre", String(fenetre));
    const q = p.toString();
    return q ? `?${q}` : "";
  }, [saison, fenetre]);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    fetch(`/api/hockey/backtest${params}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
        return j as Reponse;
      })
      .then((j) => { if (!annule) { setData(j); setErreur(null); } })
      .catch((e: Error) => { if (!annule) { setErreur(e.message); setData(null); } })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [params]);

  const d = data?.dataset ?? {};

  return (
    <div className="space-y-4">
      {/* ── Avertissement de périmètre, toujours visible ── */}
      <div className="rounded-lg border border-border/60 bg-[#fffdf5] p-3 flex gap-2.5 items-start">
        <ShieldQuestion className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="text-[0.72rem] leading-relaxed text-[#5a4a1a]">
          <strong>ROI, Yield et Bankroll : N/A — cotes historiques absentes du feed KHL.</strong>{" "}
          0 champ de cote sur les 748 matchs du calendrier local, 0 occurrence de « odds » sur hockeydb, aucune
          vue de cotes dans le feed HockeyTech. Faute de prix, le bankroll est remplacé par la courbe
          attendu/observé ci-dessous — elle est calculée sur des données réelles, sans prix simulé.
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Saison</span>
          {SAISONS.map((s) => (
            <button
              key={s.cle}
              onClick={() => setSaison(s.cle)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[0.7rem] font-medium transition-colors",
                saison === s.cle ? "bg-[#0288d1] text-white" : "text-[#717171] hover:text-[#222] hover:bg-[#f0f0f0]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">Fenêtre</span>
          {FENETRES.map((f) => (
            <button
              key={f.cle}
              onClick={() => setFenetre(f.cle)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[0.7rem] font-medium transition-colors",
                fenetre === f.cle ? "bg-[#0288d1] text-white" : "text-[#717171] hover:text-[#222] hover:bg-[#f0f0f0]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {data?.filtres.applique && (
          <Badge ton="info">
            {data.filtres.dateDebut} → {data.filtres.dateFin}
          </Badge>
        )}
      </div>

      {chargement && (
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-[#f0f0f0] rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {erreur && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[0.75rem] text-rose-800">{erreur}</div>
      )}

      {data && !chargement && (
        <>
          {/* ── Cartes KPI ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="Winrate Totaux"
              icon={<Target className="w-3.5 h-3.5" />}
              value={<ValeurAvecN t={data.accuracy.winrateGlobal} />}
              description="O/U 4.5 · 5.5 · 6.5, prolongations incluses"
            />
            <KpiCard
              label="Winrate 1X2"
              icon={<Target className="w-3.5 h-3.5" />}
              value={<ValeurAvecN t={data.accuracy.unXDeuxTempsReglementaire} />}
              description={
                <>
                  Temps réglementaire ·{" "}
                  <span className="tabular-nums">{data.accuracy.unXDeuxTempsReglementaire.exclusProlongation}</span>{" "}
                  prolongations isolées
                </>
              }
            />
            <KpiCard
              label="Log-loss"
              value={<span className="tabular-nums">{nb(data.calibration.logLoss, 4)}</span>}
              description={
                <>
                  −log(P(observé)) · n ={" "}
                  <span className="tabular-nums">{data.calibration.n}</span>
                  {data.calibration.effectifFaible && (
                    <span className="block mt-1">
                      <Badge>échantillon réduit</Badge>
                    </span>
                  )}
                </>
              }
            />
            <KpiCard
              label="Brier O/U"
              value={<span className="tabular-nums">{nb(data.calibration.brierLignes, 4)}</span>}
              description="Plus bas = meilleur · binaire par ligne"
            />
            <KpiCard label="ROI" value={<span className="text-muted-foreground">N/A</span>} description="Cotes historiques absentes du feed KHL" />
            <KpiCard label="Yield" value={<span className="text-muted-foreground">N/A</span>} description="Cotes historiques absentes du feed KHL" />
          </div>

          {/* ── Périmètre de données ── */}
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
            <Badge ton="info">
              Totaux n = <span className="tabular-nums">{d.total}</span> matchs (prolongations incluses)
            </Badge>
            <Badge ton="info">
              1X2 n = <span className="tabular-nums">{d.tempsReglementaire}</span> temps réglementaire
            </Badge>
            <Badge>
              <span className="tabular-nums">{d.prolongationOuShootout}</span> OT/SO isolés
            </Badge>
            <Badge ton="info">
              {Array.isArray(d.saisons) ? d.saisons.length : "?"} saison(s) ·{" "}
              <span className="tabular-nums">{d.equipes}</span> équipes
            </Badge>
            {typeof d.origineAlias === "string" && <Badge ton="ok">alias : {d.origineAlias}</Badge>}
          </div>

          {/* ── Courbe cumulée ── */}
          <CourbeCumulee attendu={data.serie.attendu} observe={data.serie.observe} />

          {/* ── Calibration : la question « 70 % annoncés, 70 % observés ? » ── */}
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h4 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5 mb-1">
              <Info className="w-3.5 h-3.5" /> Calibration de la confiance
            </h4>
            <p className="text-[0.7rem] text-muted-foreground mb-3 max-w-[62ch]">
              Quand le modèle annonce X %, gagne-t-il environ X % du temps ?{" "}
              {data.calibration.ecartMoyen != null && (
                <>
                  Écart moyen signé <span className="tabular-nums font-medium">{nb(data.calibration.ecartMoyen, 4)}</span>{" "}
                  — positif = modèle sous-confiant.
                </>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.72rem]">
                <thead>
                  <tr className="text-left text-[0.62rem] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                    <th className="py-1.5 pr-3 font-semibold">Probabilité annoncée</th>
                    <th className="py-1.5 pr-3 font-semibold">Observé</th>
                    <th className="py-1.5 pr-3 font-semibold">Écart</th>
                    <th className="py-1.5 pr-3 font-semibold">n</th>
                    <th className="py-1.5 font-semibold">Barre</th>
                  </tr>
                </thead>
                <tbody>
                  {data.calibration.bins.map((b) => {
                    const remplissage = b.observe == null ? 0 : b.observe;
                    return (
                      <tr key={b.de} className={cn("border-b border-border/30", b.faible && "bg-amber-50/50")}>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {(b.de * 100).toFixed(0)}–{(b.a * 100).toFixed(0)} %
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">{b.observe == null ? "—" : pct(b.observe, 1)}</td>
                        <td className={cn("py-1.5 pr-3 tabular-nums", (b.ecart ?? 0) > 0.1 && "text-emerald-700", (b.ecart ?? 0) < -0.1 && "text-rose-700")}>
                          {b.ecart == null ? "—" : `${b.ecart > 0 ? "+" : ""}${(b.ecart * 100).toFixed(1)} pt`}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">
                          {b.n}
                          {b.faible && (
                            <span className="ml-1.5">
                              <Badge>faible</Badge>
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 min-w-[120px]">
                          {b.n === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="block h-2 w-full rounded bg-[#f0f0f0] overflow-hidden">
                              <span className="block h-full bg-[#00a344]" style={{ width: `${Math.round(remplissage * 100)}%` }} />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Fiabilité des lignes ── */}
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h4 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5" /> Fiabilité des lignes de totaux
            </h4>
            <p className="text-[0.7rem] text-muted-foreground mb-3 max-w-[62ch]">
              Écart entre le total prédit et le total réel, en buts. La découpe sous/sur-prédiction distingue
              un bruit symétrique d&apos;un biais de modèle : un biais toujours dans le même sens est un défaut.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[0.72rem]">
                <thead>
                  <tr className="text-left text-[0.62rem] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                    <th className="py-1.5 pr-3 font-semibold">Ligne</th>
                    <th className="py-1.5 pr-3 font-semibold">MAE (buts)</th>
                    <th className="py-1.5 pr-3 font-semibold">Biais signé</th>
                    <th className="py-1.5 pr-3 font-semibold">Sous-prédit</th>
                    <th className="py-1.5 pr-3 font-semibold">Sur-prédit</th>
                    <th className="py-1.5 pr-3 font-semibold">Winrate</th>
                    <th className="py-1.5 font-semibold">n</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fiabilite.map((f) => {
                    const w = data.accuracy.parLigne.find((x) => x.ligne === f.ligne);
                    return (
                      <tr key={f.ligne} className={cn("border-b border-border/30", f.faible && "bg-amber-50/50")}>
                        <td className="py-1.5 pr-3 font-medium">O/U {f.ligne}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{nb(f.mae, 2)}</td>
                        <td className={cn("py-1.5 pr-3 tabular-nums", (f.biaisMoyen ?? 0) > 0.3 && "text-amber-700", (f.biaisMoyen ?? 0) < -0.3 && "text-rose-700")}>
                          {f.biaisMoyen == null ? "—" : `${f.biaisMoyen > 0 ? "+" : ""}${f.biaisMoyen.toFixed(2)}`}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">{pct(f.partSousPrediction, 1)}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{pct(f.partSurPrediction, 1)}</td>
                        <td className="py-1.5 pr-3">{w ? <ValeurAvecN t={w} /> : "—"}</td>
                        <td className="py-1.5 tabular-nums">
                          {f.n}
                          {f.faible && (
                            <span className="ml-1.5">
                              <Badge>faible</Badge>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.accuracy.parLigne.some((l) => l.annules > 0) && (
              <p className="text-[0.68rem] text-muted-foreground mt-2">
                Pairs annulés (push sur ligne entière) sortent du win-rate mais restent dans le volume.
              </p>
            )}
          </div>

          {/* ── Limites ── */}
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h4 className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
              Limites du périmètre
            </h4>
            <ul className="space-y-1 text-[0.7rem] text-muted-foreground">
              {data.limites.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="text-muted-foreground/60">·</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
            {Array.isArray(d.notes) && d.notes.length > 0 && (
              <details className="mt-3">
                <summary className="text-[0.68rem] cursor-pointer text-muted-foreground">
                  Notes du jeu de données ({d.notes.length})
                </summary>
                <ul className="mt-2 space-y-1 text-[0.68rem] text-muted-foreground">
                  {d.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              </details>
            )}
            {Array.isArray(d.echecsSource) && d.echecsSource.length > 0 && (
              <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-2 text-[0.68rem] text-amber-900">
                <strong>Échecs de source :</strong>{" "}
                {d.echecsSource.map((e) => `${e.sid} ${e.nom} — ${e.raison}`).join(" · ")}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}