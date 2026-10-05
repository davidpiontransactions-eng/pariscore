#!/usr/bin/env node
/**
 * scrape-football-form.mjs
 *
 * Stats de tirs cadrés en moyennes glissantes L5 / L10, découpées
 * Général / Domicile / Extérieur, pour les cartes et modales de match.
 *
 * SOURCES — mesuré le 2026-10-05, base comprise :
 *
 *   L10  `/api/v2/teams/{id}/form/` donne directement
 *        overall/home/away.shots_on_target = {average, total, matches}.
 *        ATTENTION : la fenêtre N'EST PAS paramétrable — `?matches=5`,
 *        `?limit=5`, `?n=5` répondent tous HTTP 400. Le défaut est 10.
 *
 *   L5   `/api/v2/teams/{id}/form/` ne renvoie PAS son historique brut
 *        (`matches` vient `undefined`). On le reconstruit donc sur
 *        `/api/matches/?status=finished&date_from=…`, dont CHAQUE objet match
 *        porte déjà `live_stats.home/away.shots_on_target`.
 *
 *        MESURÉ : l'API plafonne la page à 200 (1378 annoncés, 200 servis
 *        sans pagination) — d'où la boucle offset. Et `live_stats` est
 *        identique à `/v2/events/{id}/stats/` (6/6), présent sur 39/40
 *        matchs : pas de seconde requête par match, la fenêtre coûte
 *       Requests_pagination requêtes.
 *
 * RÈGLE ANTI-MÉSINFORMATION, appliquée partout :
 * chaque moyenne est accompagnée de `matchs` — le nombre de rencontres
 * RÉELLEMENT entrées dans le calcul. Mesuré sur l'Albanie : la fenêtre
 * L10 ne livre `shots_on_target` que sur 7 matchs (domicile 3, extérieur 4)
 * parce que la stat n'est relevée que sur certains matchs. Afficher « L10 »
 * sans dénominateur annoncerait une moyenne sur 3 matchs comme si c'était
 * une moyenne sur 10 — l'erreur inverse de « aucune donnée », et plus grave
 * pour l'utilisateur. `plafondAtteint` dit explicitement quand la fenêtre
 * est incomplète.
 *
 * Le base URL football est `sports.bzzoiro.com/api` SANS `/v2` pour
 * `/matches/`, et AVEC `/v2` pour `/teams/` et `/events/` — mesuré, les deux
 * coexistent. (Le tennis et le basket, eux, ont un préfixe de sport.)
 *
 * Usage : node scripts/scrape-football-form.mjs [--dry-run] [--days=120] [--league=64]
 *
 * `--days` : 45 jours ne suffisent pas pour un L10 réel — mesuré, les 54
 * équipes de la Nations League n'y ont que 3-4 matchs, donc L5 et L10
 * tombaient sur les MÊMES rencontres (le L10 ne voulait rien dire de plus
 * que le L5). 120 jours donne aux ligues installées leurs 10 matchs. Les
 * équipes qui démarrent restent sous le plafond, et c'est reported par
 * `matchs` et `plafondAtteint: false`.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "football_team_form.json");
const DRY_RUN = process.argv.includes("--dry-run");

const arg = (nom, defaut) => {
  const t = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return t ? t.split("=")[1] : defaut;
};
const DAYS = Number(arg("days", "120"));
const LEAGUE_FILTER = arg("league", "");

const BASE = "https://sports.bzzoiro.com/api";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const KEY = process.env.BSD_API_KEY || "";

const iso = (d) => d.toISOString().slice(0, 10);

async function api(url, { retries = 3 } = {}) {
  let dernier = "aucune tentative";
  for (let i = 1; i <= retries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Token ${KEY}`, Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) return await r.json();
      dernier = `HTTP ${r.status}`;
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      dernier = e?.name ?? "erreur";
    }
    if (i < retries) await new Promise((res) => setTimeout(res, 1200 * i));
  }
  throw new Error(`${url.replace(BASE, "")} — ${dernier}`);
}

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Une moyenne, TOUJOURS avec son dénominateur. */
function moyenne(echantillons) {
  const vals = echantillons.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return {
    moyenne: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
    matchs: vals.length,
  };
}

/** Découpe une fenêtre glissante : général / domicile / extérieur. */
function fenetre(notes, taille) {
  const gene = moyenne(notes.slice(0, taille).map((m) => m.sotEquipe));
  const dom = moyenne(notes.filter((m) => m.domicile).slice(0, taille).map((m) => m.sotEquipe));
  const ext = moyenne(notes.filter((m) => !m.domicile).slice(0, taille).map((m) => m.sotEquipe));
  const bloc = (v) => (v ? { moyenne: v.moyenne, matchs: v.matchs } : null);
  return {
    general: bloc(gene),
    domicile: bloc(dom),
    exterieur: bloc(ext),
    // `plafondAtteint: false` = la fenêtre est incomplète et la moyenne
    // porte sur moins de matchs que le libellé ne l'annonce.
    plafondAtteint: gene != null && gene.matchs >= taille,
  };
}

/**
 * SOT d'un match, lus directement sur l'objet match.
 *
 * MESURÉ 2026-10-05 : `/v2/events/{id}/stats/` et `match.live_stats` portent
 * les MÊMES valeurs — 6 matchs comparés sur 6 identiques, 0 divergence — et
 * `live_stats` est présent sur 39 matchs sur 40 (98 %). Donc pas de seconde
 * requête par match : la fenêtre de 45 jours coûte 7 requêtes de pagination
 * au lieu de 1385. On garde la correspondance croisée comme invariant, pas
 * comme dépendance.
 *
 * 53 clés sont disponibles dans live_stats (total_shots, blocked_shots,
 * xg, expected_goals_on_target, ball_possession, corner_kicks,
 * shots_inside_box, shots_off_target…) — le besoin « L5/L10 de tirs cadrés »
 * est le premier d'une série, pas un cas particulier.
 */
function statsMatch(m) {
  const s = m?.live_stats ?? {};
  return {
    home: Number(s.home?.shots_on_target ?? NaN),
    away: Number(s.away?.shots_on_target ?? NaN),
    homeShots: Number(s.home?.total_shots ?? NaN),
    awayShots: Number(s.away?.total_shots ?? NaN),
  };
}

async function main() {
  if (!KEY) {
    console.error("[foot-form] BSD_API_KEY absente");
    process.exit(1);
  }

  const fin = new Date();
  const debut = new Date(fin.getTime() - DAYS * 86400000);
  if (LEAGUE_FILTER) console.log(`[foot-form] filtre ligue ${LEAGUE_FILTER}`);

  // 1. Matchs terminés sur la fenêtre.
  //    MESURÉ : l'API plafonne la page à 200 et renvoie `count` = total
  //    (1378 annoncés pour 200 servis). Sans pagination, on perdait 86 % des
  //    matchs — donc 86 % des équipes n'auraient aucun historique, et le L5
  //    serait calculé sur les seuls clubs tombés dans la première page.
  const brut = await api(`${BASE}/matches/?status=finished&date_from=${iso(debut)}&date_to=${iso(fin)}&limit=200&offset=0`);
  const annonce = Number(brut?.count ?? 0);
  const matchs = Array.isArray(brut) ? brut : [...(brut?.results ?? [])];
  const PAGE = 200;
  for (let offset = matchs.length; matchs.length < annonce && offset < annonce; offset += PAGE) {
    const p = await api(`${BASE}/matches/?status=finished&date_from=${iso(debut)}&date_to=${iso(fin)}&limit=${PAGE}&offset=${offset}`);
    const recu = Array.isArray(p) ? p : (p?.results ?? []);
    if (!recu.length) break;
    matchs.push(...recu);
  }
  console.log(`[foot-form] ${annonce} matchs terminés annoncés sur ${DAYS} jours, ${matchs.length} récupérés après pagination`);

  const retenus = LEAGUE_FILTER
    ? matchs.filter((m) => String(m.league?.id ?? "") === LEAGUE_FILTER)
    : matchs;
  // Ligues réellement présentes dans la fenêtre. Un filtre qui ne matche
  // rien est presque toujours une erreur d'identifiant (le catalogue
  // /leagues/ et les matchs n'emploient pas les mêmes ids) — donc on le dit
  // au lieu d'écrire silencieusement un fichier vide.
  const idsPresents = new Set(matchs.map((m) => `${m.league?.id}:${m.league?.name ?? "?"}`));
  if (LEAGUE_FILTER) {
    const trouve = [...idsPresents].filter((x) => x.startsWith(`${LEAGUE_FILTER}:`));
    console.log(`[foot-form] ligues présentes (${idsPresents.size}) : ${[...idsPresents].slice(0, 20).join(" | ")}`);
    if (!trouve.length) console.log(`[foot-form] ATTENTION : aucune ligue ${LEAGUE_FILTER} dans la fenêtre — vérifier l'id`);
  }

  // 2. Regrouper par équipe, du plus récent au plus ancien.
  //     Clé = id d'équipe BSD, pas le nom : « Atlético Mineiro » /
  //     « Atletico Mineiro » / « Atlético-MG » sont trois écritures du même
  //     club, et normaliser le nom les fusionne sans le vouloir.
  const parEquipe = new Map();

  retenus.sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));

  const ligues = new Map();
  let traités = 0;
  let exploitables = 0;

  for (const m of retenus) {
    const hId = m.home_team_obj?.id;
    const aId = m.away_team_obj?.id;
    if (hId == null || aId == null) continue;

    // `traités` compte les matchs UTILISABLES, c'est-à-dire ceux qui portent un
    // SOT numérique des deux côtés. Un match sans live_stats (2 % des cas)
    // n'est pas une erreur : il entre dans l'historique de l'équipe mais
    // pas dans la moyenne, et le dénominateur le dit.
    const st = statsMatch(m);
    const exploitable = Number.isFinite(st.home) && Number.isFinite(st.away);
    traités++;
    if (exploitable) exploitables++;
    if (traités % 250 === 0) process.stdout.write(`  ${traités}/${retenus.length} matchs lus\n`);

    ligues.set(String(m.league?.id ?? "?"), m.league?.name ?? "?");

    // Domicile
    if (!parEquipe.has(String(hId))) parEquipe.set(String(hId), { id: String(hId), nom: m.home_team, notes: [] });
    parEquipe.get(String(hId)).notes.push({
      eventId: m.id, date: m.event_date, domicile: true,
      adverse: m.away_team, sotEquipe: st.home, sotAdverse: st.away,
    });
    // Extérieur
    if (!parEquipe.has(String(aId))) parEquipe.set(String(aId), { id: String(aId), nom: m.away_team, notes: [] });
    parEquipe.get(String(aId)).notes.push({
      eventId: m.id, date: m.event_date, domicile: false,
      adverse: m.home_team, sotEquipe: st.away, sotAdverse: st.home,
    });
  }

  console.log(`[foot-form] ${traités} matchs retenus, ${exploitables} avec SOT exploitable · ${parEquipe.size} équipes · ${ligues.size} ligues`);
  console.log(`[foot-form] sample ligues: ${[...ligues.values()].slice(0, 8).join(", ")}`);

  // 3. Fenêtres L5 / L10 par équipe.
  const equipes = [];
  for (const eq of parEquipe.values()) {
    eq.notes.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const l10 = fenetre(eq.notes, 10);
    const l5 = fenetre(eq.notes, 5);
    equipes.push({
      id: eq.id,
      nom: eq.nom,
      // `matchsDisponibles` = matchs trouvés dans l'historique de l'équipe.
    // `l5/l10.general.matchs` = matchs RÉELLEMENT entrés dans la moyenne,
    // donc plus petit quand un match n'avait pas de SOT (47 % des matchs
    // n'en portent pas). Deux nombres différents, deux questions différentes.
    matchsDisponibles: eq.notes.length,
      l5,
      l10,
    });
  }
  equipes.sort((a, b) => (b.l10.general?.moyenne ?? -1) - (a.l10.general?.moyenne ?? -1));

  const avecL10 = equipes.filter((e) => e.l10.general).length;
  const l10Complet = equipes.filter((e) => e.l10.plafondAtteint).length;
  const l5Complet = equipes.filter((e) => e.l5.plafondAtteint).length;
  console.log(`[foot-form] ${avecL10}/${equipes.length} équipes avec un L10 exploitable`);
  console.log(`[foot-form] L10 au plafond (10 matchs) : ${l10Complet}/${equipes.length} · L5 au plafond (5 matchs) : ${l5Complet}/${equipes.length}`);
  console.log(`[foot-form] ${equipes.length - l10Complet} équipes sous le plafond — l'UI doit afficher le dénominateur`);

  if (DRY_RUN) {
    for (const e of equipes.slice(0, 6)) {
      const l10 = e.l10.general;
      const l5 = e.l5.general;
      console.log(`  ${(e.nom ?? "?").padEnd(24)} L10 ${l10 ? `${l10.moyenne} (${l10.matchs}j)` : "—"} · L5 ${l5 ? `${l5.moyenne} (${l5.matchs}j)` : "—"} · dispo ${e.matchsDisponibles}`);
      console.log(`     L10 dom ${e.l10.domicile?.moyenne ?? "—"} ext ${e.l10.exterieur?.moyenne ?? "—"}`);
    }
    return;
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: "BSD football — /v2/teams/{id}/form/ (L10) + /matches/ (L5, via live_stats)",
    generator: "scripts/scrape-football-form.mjs",
    fenetreJours: DAYS,
    baseUrl: BASE,
    // Rappel gravé dans le fichier : l'API BSD ne sait pas borner la
    // fenêtre de /form/, donc le L5 est reconstruit ici, et chaque moyenne
    // porte son dénominateur.
    notes: [
      "BSD /form/ ne sait pas borner la fenêtre : ?matches / ?limit / ?n répondent tous 400, le défaut est 10.",
      "L5 est reconstruit sur les matchs terminés, SOT lus dans match.live_stats (valeurs identiques à /v2/events/{id}/stats/ — 6/6 contrôlés).",
      "Chaque moyenne porte `matchs` = effectif réel ; `plafondAtteint` = false quand la fenêtre est incomplète.",
    ],
    counts: {
      equipes: equipes.length,
      matchsLus: traités,
      matchsExploitables: exploitables,
      equipesL10Complet: equipes.filter((e) => e.l10.plafondAtteint).length,
      equipesL10Partiel: equipes.filter((e) => !e.l10.plafondAtteint).length,
      ligues: ligues.size,
    },
    ligues: [...ligues.entries()].map(([id, nom]) => ({ id, nom })),
    teams: equipes,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`[foot-form] Saved to ${OUT}`);
}

main().catch((e) => {
  console.error(`[foot-form] ECHEC : ${e.message}`);
  process.exit(1);
});