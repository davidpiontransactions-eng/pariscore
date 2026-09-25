// Analyse IA prédictive handball (Gemini) — prompt + CACHE 24h.
//
// Règle métier (demande utilisateur) : l'analyse est générée UNE SEULE FOIS
// par match, puis mémorisée sur le VPS pendant 24h max ; au-delà, elle est
// régénérée. Stockage fichier (DATA_DIR/handball-ai-cache.json) — survit aux
// restarts pm2, purge automatique des entrées > 24h à chaque écriture.
//
// Le prompt n'existe QUE côté serveur (jamais exposé au client) et injecte
// les données RÉELLES calculées par /api/handball/analysis (historique DB,
// échelle Over, 1X2, StarLigue, buteurs) pour éviter toute statistique
// inventée par le modèle.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateText, LlmError } from "./llm";
import type { HandballAnalysisPayload } from "../app/api/handball/analysis/route";

/** TTL du cache : 24h max (demande utilisateur). */
export const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Clé de cache : équipes normalisées + date + ligue. */
export function aiCacheKey(params: { home: string; away: string; league?: string | null; date?: string | null }): string {
  const n = (s: string) =>
    String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const day = (params.date ?? "").slice(0, 10) || "nodate";
  return `${n(params.home)}|${n(params.away)}|${day}|${n(params.league ?? "")}`;
}

export type AiCacheEntry = {
  generatedAt: string; // ISO
  text: string;
  model: string;
  latencyMs: number;
};

export type AiCacheFile = {
  version: 1;
  updatedAt: string;
  entries: Record<string, AiCacheEntry>;
};

/** Entrée valide si plus jeune que `ttlMs` (horloge injectable → testable). */
export function isEntryFresh(entry: AiCacheEntry | undefined, nowMs: number, ttlMs = AI_CACHE_TTL_MS): entry is AiCacheEntry {
  if (!entry) return false;
  const t = Date.parse(entry.generatedAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t < ttlMs;
}

/** Purge des entrées expirées (> 24h) — appelée à chaque écriture. */
export function pruneEntries(entries: Record<string, AiCacheEntry>, nowMs: number, ttlMs = AI_CACHE_TTL_MS): Record<string, AiCacheEntry> {
  const out: Record<string, AiCacheEntry> = {};
  for (const [k, v] of Object.entries(entries)) {
    if (isEntryFresh(v, nowMs, ttlMs)) out[k] = v;
  }
  return out;
}

function cachePath(): string {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "handball-ai-cache.json");
}

function readCacheFile(): AiCacheFile {
  try {
    const p = cachePath();
    if (!existsSync(p)) return { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
    const d = JSON.parse(readFileSync(p, "utf8")) as AiCacheFile;
    if (!d || typeof d !== "object" || !d.entries) return { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
    return d;
  } catch {
    return { version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
  }
}

function writeCacheFile(file: AiCacheFile): void {
  try {
    const p = cachePath();
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(file), "utf8");
  } catch (err) {
    // Un échec d'écriture ne doit jamais casser la réponse : on logue et on sert quand même.
    console.warn(`[handball-ai] cache write KO: ${(err as Error).message}`);
  }
}

/** Lecture cache (null si absente ou expirée). */
export function readAiCache(key: string, nowMs = Date.now()): AiCacheEntry | null {
  const entry = readCacheFile().entries[key];
  return isEntryFresh(entry, nowMs) ? entry : null;
}

/** Écriture cache (purge > 24h avant écriture). */
export function writeAiCache(key: string, entry: AiCacheEntry, nowMs = Date.now()): void {
  const file = readCacheFile();
  file.entries = pruneEntries({ ...file.entries, [key]: entry }, nowMs);
  file.updatedAt = new Date(nowMs).toISOString();
  writeCacheFile(file);
}

// ─── Prompt (5a) ─────────────────────────────────────────────────────────────

const pct = (v: number) => `${v.toFixed(1)}%`;
const num = (v: number | null | null, d = 1) => (v == null ? "—" : v.toFixed(d));

function teamBlock(t: NonNullable<HandballAnalysisPayload["teams"]["home"]>): string[] {
  const side = (label: string, s: typeof t.home): string[] => [
    `  ${label} — L5 : marqués ${num(s.l5.scored)} / encaissés ${num(s.l5.conceded)} (diff ${num(s.l5.diff)}), PPG ${num(s.l5.ppg)}, n=${s.l5.n} ; L10 : marqués ${num(s.l10.scored)} / encaissés ${num(s.l10.conceded)} (diff ${num(s.l10.diff)}), PPG ${num(s.l10.ppg)}, n=${s.l10.n}`,
  ];
  return [
    `- ${t.name} : ${t.n} matchs d'historique, ${t.wins}V ${t.draws}N ${t.losses}D, winrate ${pct((t.winrate ?? 0) * 100)} (dom ${t.winrateHome == null ? "—" : pct(t.winrateHome * 100)}, ext ${t.winrateAway == null ? "—" : pct(t.winrateAway * 100)})`,
    `  Domicile (l'équipe reçoit) :`,
    ...side("→", t.home),
    `  Extérieur (l'équipe est reçue) :`,
    ...side("→", t.away),
    `  Global : L5 marqués ${num(t.overall.l5.scored)} / encaissés ${num(t.overall.l5.conceded)}, PPG ${num(t.overall.l5.ppg)} ; L10 marqués ${num(t.overall.l10.scored)} / encaissés ${num(t.overall.l10.conceded)}, PPG ${num(t.overall.l10.ppg)} ; forme 5 derniers ${t.lastSeq || "—"}`,
  ];
}

function scorerBlock(list: HandballAnalysisPayload["scorers"]["home"]): string[] {
  if (!list.length) return ["  (données buteurs indisponibles pour cette équipe)"];
  return list.map((p) => {
    const probs = p.probs.map((t) => `${t.n}+ : ${pct(t.p * 100)}`).join(" · ");
    return `  - ${p.name} : ${p.goals} buts en ${p.games} matchs (${p.avgGoals.toFixed(2)}/match), λ ajusté ${p.lambda.toFixed(1)} → P(au moins 2/3/4/5) = ${probs}`;
  });
}

/**
 * Construit le prompt complet (5a) à partir des données RÉELLES du match.
 * Le modèle ne reçoit QUE ces chiffres + sa consigne métier : toute donnée
 * qu'il ne possède pas (presse, effectifs) doit être explicitement signalée.
 */
export function buildAiPrompt(a: HandballAnalysisPayload): { system: string; prompt: string } {
  const system =
    "Tu es un expert-analyste et parieur professionnel spécialisé en handball " +
    "(Liqui Moly Bundesliga, StarLigue, EHF Champions League, etc.). " +
    "Tu réponds en français, en markdown structuré, de façon claire, analytique et directe, sans fioritures. " +
    "Tu ne fabriques JAMAIS de chiffre : tu t'appuies sur les données fournies, et tu signales explicitement " +
    "tout ce que tu ignores (absences réelles, cotes de marché, déclarations de presse récentes). " +
    "Finis par une mention : « Aide à la décision — pas un conseil de pari. »";

  const lines: string[] = [];
  lines.push(`# Analyse prédictive — ${a.match.home} vs ${a.match.away}`);
  lines.push("");
  lines.push(`- Domicile : ${a.match.home} | Extérieur : ${a.match.away}`);
  lines.push(`- Compétition : ${a.match.league ?? "inconnue"} | Date : ${a.match.date ?? "à confirmer"}`);
  lines.push("");
  lines.push("## Données STATISTIQUES (source : historique maison, base de matchs scrapée)");
  lines.push("");
  lines.push(`**Modèle maison** : total attendu ${a.model.expectedTotal.toFixed(1)} buts (base ${a.model.base} pts, moyenne observée ${a.model.observedMean ?? "—"} pts, ν ${a.model.nu.toFixed(2)}), λ domicile ${a.model.lambdaH.toFixed(1)} / extérieur ${a.model.lambdaA.toFixed(1)}.`);
  lines.push(`- 1X2 modèle : 1 = ${a.match1x2.home.toFixed(1)} % · X = ${a.match1x2.draw.toFixed(1)} % · 2 = ${a.match1x2.away.toFixed(1)} %`);
  lines.push(`- Échelle Over : ${a.over.lines.map((l) => `> ${l.line} : ${(l.over * 100).toFixed(0)} %${l.playable ? " (jouable ≥" + Math.round(a.over.floor * 100) + " %)" : ""}`).join(" · ")}`);
  lines.push(`- Ligne retenue : ${a.over.pick ? `Over ${a.over.pick.line} à ${(a.over.pick.over * 100).toFixed(1)} %` : "aucune ligne ≥ " + Math.round(a.over.floor * 100) + " %"}`);
  lines.push("");
  lines.push("**Équipe A (domicile)**");
  lines.push(...(a.teams.home ? teamBlock(a.teams.home) : ["  (historique insuffisant)"]));
  lines.push("");
  lines.push("**Équipe B (extérieur)**");
  lines.push(...(a.teams.away ? teamBlock(a.teams.away) : ["  (historique insuffisant)"]));
  if (a.starligue) {
    const m = (side: typeof a.starligue.home) =>
      side
        ? `${side.team} (rang ${side.standing?.rank ?? "—"}, ${side.standing?.points ?? "—"} pts, ${side.standing ? `${side.standing.wins}V-${side.standing.draws}N-${side.standing.losses}D` : "—"} ; ${side.metrics.map((x) => `${x.label} ${x.avg == null ? "—" : x.avg.toFixed(1)}/m`).join(", ")})`
        : "—";
    lines.push("");
    lines.push(`**StarLigue (saison ${a.starligue.season ?? "?"}, snapshot ${a.starligue.scrapedAt ?? "?"})**`);
    lines.push(`- ${m(a.starligue.home)} vs ${m(a.starligue.away)}`);
  }
  lines.push("");
  lines.push("**Buteurs clés (top 2 par équipe, probas « au moins N buts » du modèle)**");
  lines.push(`- ${a.match.home} :`);
  lines.push(...scorerBlock(a.scorers.home));
  lines.push(`- ${a.match.away} :`);
  lines.push(...scorerBlock(a.scorers.away));
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    [
      "Réalise l'analyse prédictive complète et rigoureuse en suivant EXACTEMENT ces sections :",
      "",
      "1. **DESCRIPTIF DES DEUX ÉQUIPES** — contexte rapide (objectifs de saison, dynamique, enjeu).",
      "2. **FORME DU MOMENT (HOME / AWAY)** — bilan des 5 derniers à domicile pour A, des 5 derniers à l'extérieur pour B (V/N/D), et tendance du rythme de jeu (fast-break vs attaques placées / défense fermée).",
      "3. **MOYENNE DE BUTS PAR MATCH (HOME / AWAY)** — moyenne de buts marqués ET encaissés de A à domicile, de B à l'extérieur, et total combiné estimé (recoupe avec le total du modèle ci-dessus).",
      "4. **MEILLEURS BUTEURS DE LA SAISON** — top 2 par équipe : buts, moyenne/match, profil (demi-centre, arrière, 7 m).",
      "5. **REVUE DE PRESSE ET ÉTAT DES EFFECTIFS** — absences/blessures/suspensions connues (gardien titulaire, piliers défensifs) et contexte psychologique (enchaînement européen, derby…). Si tu ne connais pas une info récente, écris explicitement « non vérifié » plutôt que d'inventer.",
      "6. **ANALYSE DESCRIPTIVE PAR TYPE DE PARI** — en croisant les stats fournies et la presse : 1N2 (écart de niveau), Total de buts / Over-Under (vol. de jeu, efficacité, perméabilité — appuie-toi sur l'échelle Over), Handicap (±3.5 : résistance de l'outsider vs du favori), Performances joueurs (duels individuels clés).",
      "7. **LES 3 BETS PRÉDICTIFS LES PLUS RENTABLES** — hiérarchisés (Safe / Value Bet / Handicap-Over), chacun avec : intitulé exact du bet, cote estimée, indice de confiance /10, argumentation technique et statistique basée sur les données ci-dessus.",
      "",
      "Format attendu : markdown clair, analytique, direct, sans fioritures.",
    ].join("\n")
  );

  return { system, prompt: lines.join("\n") };
}

// ─── Génération avec cache + déduplication concurrente ───────────────────────

/** Promesses en cours : 2 requêtes simultanées = 1 seule génération Gemini. */
const inflight = new Map<string, Promise<AiCacheEntry>>();

export type AiAnalysisResult = {
  entry: AiCacheEntry;
  cached: boolean;
};

/**
 * Analyse du match : cache 24h d'abord, sinon génération (une seule fois,
 * les appels concurrents partagent la même promesse), puis persistance.
 * Relance LlmError tel quel (quota / clé manquante) — jamais de cache d'erreur.
 */
export async function getOrGenerateAiAnalysis(
  a: HandballAnalysisPayload,
  params: { home: string; away: string; league?: string | null; date?: string | null }
): Promise<AiAnalysisResult> {
  const key = aiCacheKey(params);

  const hit = readAiCache(key);
  if (hit) return { entry: hit, cached: true };

  const running = inflight.get(key);
  if (running) return { entry: await running, cached: true };

  const job = (async (): Promise<AiCacheEntry> => {
    const { system, prompt } = buildAiPrompt(a);
    const started = Date.now();
    const res = await generateText({
      system,
      prompt,
      provider: "gemini",
      temperature: 0.4,
      maxOutputTokens: 2048,
      timeoutMs: 60_000,
    });
    const entry: AiCacheEntry = {
      generatedAt: new Date().toISOString(),
      text: res.text,
      model: res.model,
      latencyMs: Date.now() - started,
    };
    writeAiCache(key, entry);
    return entry;
  })();

  inflight.set(key, job);
  try {
    const entry = await job;
    return { entry, cached: false };
  } catch (err) {
    // Échec (quota, réseau…) : on ne mémorise RIEN → prochaine tentative libre.
    if (err instanceof LlmError) throw err;
    throw new LlmError(String(err), 500, "AI_ANALYSIS_FAILED");
  } finally {
    inflight.delete(key);
  }
}
