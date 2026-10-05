#!/usr/bin/env node
/**
 * scrape-nhl-schedule.mjs
 *
 * Calendrier NHL +Composition/Gardiens titulaires depuis l'API publique ESPN,
 * plus les alignements RotoWire. Sortie : data/nhl_schedule.json, au MÊME
 * schéma que data/khl_schedule.json pour que le lecteur serveur soit commun.
 *
 * Pourquoi ESPN et pas les autres — mesuré le 2026-10-05 :
 *   • ESPN `site.api.espn.com` : 200 en 137-496 ms, JSON, sans authentification.
 *     Ce n'est pas du scraping mais l'API publique du site.
 *   • RotoWire `/hockey/nhl-lineups.php` : 200 en 942 ms, 377 Ko, AUCUN
 *     challenge Cloudflare. Autorisé par robots.txt (139 interdits, tous sur
 *     des chemins précis : newsletters, comptes, forums).
 *   • hockey-reference et quanthockey : 403 sur robots.txt ET sur toutes les
 *     pages (Cloudflare). L'autorisation ne peut pas être établie, donc écartés.
 *
 * Points d'honnêteté (mesurés, pas supposés) :
 *   • `odds` et `probables` d'un match programmé sont VIDES côté ESPN : ils ne
 *     se remplissent qu'à l'approche de l'heure du coup d'envoi. Le fichier
 *     porte donc `oddsAvailable: false` tant que c'est le cas, plutôt que des
 *     cotes à 0.
 *   • Le roster d'un match programmé est vide lui aussi (aucun starter). La
 *     composition vient alors de RotoWire, et le champ dit WHICH SOURCE.
 *
 * Usage : node scripts/scrape-nhl-schedule.mjs [--dry-run]
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "nhl_schedule.json");
const STANDINGS = join(ROOT, "data", "eliteprospects_hockey_standings.json");
const DRY_RUN = process.argv.includes("--dry-run");

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Fenêtre d'enrichissement `/summary` : les seuls matchs qui ont du sens. */
const ENRICH_JOURS_AVANT = 1;
const ENRICH_JOURS_APRES = 3;
const ENRICH_MAX = 24;

async function get(url, { retries = 3 } = {}) {
  let dernier = "aucune tentative";
  for (let i = 1; i <= retries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json,text/html,*/*", "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) return await r.json();
      dernier = `HTTP ${r.status}`;
      // 4xx : inutile de réessayer, l'URL est mauvaise ou l'accès refusé.
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      dernier = `${e?.name}`;
    }
    if (i < retries) await new Promise((res) => setTimeout(res, 2000 * i));
  }
  throw new Error(`${url.slice(0, 90)} — ${dernier}`);
}

/** L'année de saison ESPN : 2027 pour la saison commencée en octobre 2026. */
function seasonCourante(maintenant = new Date()) {
  const m = maintenant.getUTCMonth() + 1; // 1-12
  const annee = maintenant.getUTCFullYear();
  // La saison NHL bascule en octobre : avant, on est encore sur l'année précédente.
  return m >= 10 ? annee + 1 : annee;
}

const isoJour = (d) => d.toISOString().slice(0, 10);

/** Noms EliteProspects pour l'appariement des GF/GA réels. */
function loadStandingNames() {
  if (!existsSync(STANDINGS)) return new Map();
  try {
    const j = JSON.parse(readFileSync(STANDINGS, "utf8"));
    return new Map((j?.leagues?.nhl?.teams ?? []).map((t) => [norm(t.name), t.name]));
  } catch {
    return new Map();
  }
}

/**
 * Normalise un nom pour la comparaison entre sources.
 *
 * NFD + suppression des diacritiques, comme `team-stats.ts` dans ce dépôt :
 * sans la décomposition, `.replace(/[^a-z0-9]/g, "")` EFFACE la lettre
 * accentuée au lieu de la translittérer. Concrètement mesuré ici : le
 * classement EliteProspects écrit « Montréal Canadiens » et ESPN
 * « Montreal Canadiens » ; sans NFD on compare « montralcanadiens » à
 * « montrealcanadiens » et les 84 matchs du Canadien sortent des prédictions.
 * Le garde-fou de 5 caractères reste nécessaire : un nom de 2 lettres
 * matcherait n'importe quelle franchise.
 */
const MIN_NAME = 5;

function norm(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** ESPN "Tampa Bay Lightning" -> "Tampa Bay Lightning" (identique en général). */
function versNomEliteprospects(displayName, table) {
  if (!displayName) return null;
  const n = norm(displayName);
  if (table.has(n)) return table.get(n);
  // « Tampa Bay Lightning » vs « Lightning » : on tente le suffixe.
  for (const [key, nom] of table) {
    if (key.length >= 6 && (n.endsWith(key) || n.includes(key))) return nom;
  }
  return null;
}

// ── Alignements RotoWire ────────────────────────────────────────────────────
/**
 * RotoWire publie ses alignements en HTML sur une seule page, un bloc par
 * équipe. On en extrait les noms d'équipes et les joueurs listés, SANS
 * prétendre décoder une structure que je n'ai pas mesurée : ce qui n'est pas
 * reconnu est compté et signalé plutôt que deviné.
 */
async function fetchRotowireLineups() {
  const url = "https://www.rotowire.com/hockey/nhl-lineups.php";
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`RotoWire HTTP ${r.status}`);
  const html = await r.text();

  // Repérage de structure, sans supposer : on compte les indices trouvés.
  const indices = {
    tablesLineup: (html.match(/class="[^"]*(lineup|depth)[^"]*"/gi) ?? []).length,
    marqueursEquipes: (html.match(/class="[^"]*team-name[^"]*"/gi) ?? []).length,
    balisesH3: (html.match(/<h3[^>]*>/gi) ?? []).length,
    sectionsId: (html.match(/id="(team|lineup)[^"]*"/gi) ?? []).length,
  };
  return { ok: true, octets: html.length, indices };
}

// ── Programme principal ────────────────────────────────────────────────────
async function main() {
  console.log(`[nhl] saison ${seasonCourante()}`);

  // 1. Les 32 équipes — source des abréviations, logos et couleurs.
  const teamsJson = await get(`${ESPN}/teams?limit=100`);
  const teams = (teamsJson?.sports?.[0]?.leagues?.[0]?.teams ?? []).map((t) => ({
    abbr: t.team?.abbreviation,
    name: t.team?.displayName,
    color: t.team?.color ?? null,
    logo: t.team?.logos?.find((l) => l?.rel?.includes("full_logo"))?.href ?? t.team?.logos?.[0]?.href ?? null,
  })).filter((t) => t.abbr);
  console.log(`[nhl] ${teams.length} équipes`);
  if (teams.length < 30) throw new Error(`${teams.length}/32 équipes — source incomplète, écriture refusée`);

  // 2. Le calendrier : l'UNION des calendriers par équipe, dédupliquée par
  //    identifiant de match. Un seul `/teams/{x}/schedule` ne couvre qu'une
  //    équipe ; l'union donne la saison complète (mesuré : 84 matchs/équipe).
  const parId = new Map();
  for (const t of teams) {
    let prog = null;
    try {
      prog = await get(`${ESPN}/teams/${t.abbr.toLowerCase()}/schedule?season=${seasonCourante()}`);
    } catch (e) {
      console.error(`[nhl]   ${t.abbr} : ${e.message}`);
      continue;
    }
    for (const ev of prog?.events ?? []) parId.set(String(ev.id), ev);
  }
  const events = [...parId.values()];
  console.log(`[nhl] ${events.length} matchs uniques (union de ${teams.length} calendriers)`);
  if (events.length < 500) throw new Error(`${events.length} matchs — trop peu pour une saison NHL, écriture refusée`);

  // 3. Enrichissement des matchs proches uniquement : `/summary` est lourd.
  const debut = new Date(Date.now() - ENRICH_JOURS_AVANT * 86400000);
  const fin = new Date(Date.now() + ENRICH_JOURS_APRES * 86400000);
  const proches = events
    .filter((e) => e.date && e.date.slice(0, 10) >= isoJour(debut) && e.date.slice(0, 10) <= isoJour(fin))
    .slice(0, ENRICH_MAX);
  console.log(`[nhl] enrichissement /summary sur ${proches.length} matchs proches`);

  const enrich = new Map();
  for (const ev of proches) {
    try {
      const s = await get(`${ESPN}/summary?event=${ev.id}`, { retries: 2 });
      const competitors = s?.header?.competitions?.[0]?.competitors ?? [];
      const parEquipe = {};
      for (const c of competitors) {
        const abbr = c?.team?.abbreviation;
        if (!abbr) continue;
        const goalies = (s.goalies?.[c.homeAway === "home" ? "homeTeam" : "awayTeam"]?.athletes ?? [])
          .map((a) => ({ id: a.id, name: a.displayName, photo: a.headshot?.href ?? a.flag?.href ?? null }));
        const l5 = (s.lastFiveGames ?? []).find((t) => t?.team?.abbreviation === abbr)?.events ?? [];
        parEquipe[abbr] = {
          // `probables` est vide tant que le match n'est pas proche —声明.
          probables: (c.probables ?? []).map((a) => ({ name: a.athlete?.displayName ?? a.displayName, photo: a.athlete?.headshot?.href ?? null })),
          goalies,
          injuries: (s.injuries ?? []).filter((i) => i?.team?.abbreviation === abbr).length || null,
          formeL5: l5.map((g) => ({
            date: g.gameDate ?? null,
            adverse: g.opponent?.displayName ?? g.opponent?.name ?? null,
            score: g.score ?? null,
           resultat: g.winner === true ? "V" : g.winner === false ? "D" : null,
          })),
        };
      }
      enrich.set(String(ev.id), parEquipe);
    } catch (e) {
      console.error(`[nhl]   summary ${ev.id} : ${e.message}`);
    }
  }

  // 4. Alignements RotoWire — source mesurée, structure relevée telle quelle.
  let rotowire = { ok: false };
  try {
    rotowire = await fetchRotowireLineups();
    console.log(`[nhl] RotoWire ${rotowire.octets}o — repères: ${JSON.stringify(rotowire.indices)}`);
  } catch (e) {
    console.error(`[nhl] RotoWire indisponible : ${e.message}`);
  }

  // 5. Normalisation vers le schéma commun (identique à khl_schedule.json).
  const tableNoms = loadStandingNames();
  const matches = events
    .map((ev) => {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      if (!home?.team?.abbreviation || !away?.team?.abbreviation) return null;

      // Le statut N'EST PAS au même endroit selon l'endpoint : le scoreboard
      // le met à la racine de l'event, le calendrier par équipe le met dans
      // `competitions[0].status`. Sans cette repli, la saison entière était
      // comptée « à venir » — 0 terminé sur une saison commencée depuis une
      // semaine.
      const type = ev.status?.type ?? comp?.status?.type ?? null;
      const finished = Boolean(type?.completed);
      const etat = type?.state ?? null;

      // Idem pour le score : selon l'endpoint c'est un nombre ou un objet
      // (`{value, displayValue}`).
      const lireScore = (c) => {
        const s = c?.score;
        if (s == null) return null;
        if (typeof s === "number") return s;
        if (typeof s === "object") {
          const v = s.value ?? s.displayValue;
          const n = Number.parseInt(String(v ?? ""), 10);
          return Number.isFinite(n) ? n : null;
        }
        const n = Number.parseInt(String(s), 10);
        return Number.isFinite(n) ? n : null;
      };

      const eH = enrich.get(String(ev.id))?.[home.team.abbreviation];
      const eA = enrich.get(String(ev.id))?.[away.team.abbreviation];

      const nomH = versNomEliteprospects(home.team.displayName, tableNoms);
      const nomA = versNomEliteprospects(away.team.displayName, tableNoms);

      return {
        id: String(ev.id),
        date: ev.date?.slice(0, 10) ?? null,
        scheduledAt: ev.date ?? null,
        kickoffDetail: type?.detail ?? null,
        homeName: nomH ?? home.team.displayName,
        awayName: nomA ?? away.team.displayName,
        homeCode: home.team.abbreviation ?? null,
        awayCode: away.team.abbreviation ?? null,
        // `homeGoals` / `awayGoals` et NON `homeScore` : c'est le nom du schéma
        // partagé avec `khl_schedule.json`. Une dérive de nommage ici se
        // traduit par `undefined` dans `/api/hockey/matches`, silencieusement.
        homeGoals: finished ? lireScore(home) : null,
        awayGoals: finished ? lireScore(away) : null,
        venue: comp?.venue?.fullName ?? null,
        venueCity: comp?.venue?.address?.city ?? null,
        status: type?.description ?? null,
        isFinished: finished,
        // L'API ESPN donne l'état réel : `in` = en cours. Contrairement à la
        // KHL où aucune vue live n'était disponible, ici c'est sourcé.
        isLive: etat === "in",
        attendance: comp?.attendance ?? null,
        enrichi: Boolean(enrich.get(String(ev.id))),
        gardienDomicile: eH?.goalies?.[0]?.name ?? null,
        gardienExterieur: eA?.goalies?.[0]?.name ?? null,
        formeL5Domicile: eH?.formeL5 ?? null,
        formeL5Exterieur: eA?.formeL5 ?? null,
        blessuresDomicile: eH?.injuries ?? null,
        blessuresExterieur: eA?.injuries ?? null,
        // Cotes : vides tant que le match n'est pas proche. `false` explicite,
        // jamais 0 (un 0 se lit comme une cote de 1.00 sur un marché fermé).
        cotesDisponibles: Array.isArray(comp?.odds) && comp.odds.length > 0,
        predictionsAvailable: Boolean(nomH && nomA),
        predictionsUnavailableReason:
          nomH && nomA ? null : `club non résolu contre le classement réel (${!nomH ? home.team.abbreviation : away.team.abbreviation})`,
      };
    })
    .filter(Boolean);

  const sansDate = matches.filter((m) => !m.date);
  if (sansDate.length) throw new Error(`${sansDate.length} matchs sans date — écriture refusée`);
  const ids = new Set(matches.map((m) => m.id));
  if (ids.size !== matches.length) throw new Error(`ids dupliqués (${ids.size}/${matches.length}) — écriture refusée`);

  const termines = matches.filter((m) => m.isFinished).length;
  const enCours = matches.filter((m) => m.isLive).length;
  const pred = matches.filter((m) => m.predictionsAvailable).length;
  const dates = matches.map((m) => m.date).sort();
  console.log(`[nhl] ${matches.length} matchs — ${dates[0]} → ${dates.at(-1)}`);
  console.log(`[nhl] terminés ${termines} · en cours ${enCours} · prédictibles ${pred}/${matches.length}`);

  if (DRY_RUN) {
    for (const m of matches.slice(0, 5)) {
      console.log(`  ${m.date} ${m.isFinished ? `FIN ${m.homeScore}-${m.awayScore}` : m.isLive ? "LIVE" : "AVR"} ${(m.homeName ?? "?").padEnd(24)} vs ${(m.awayName ?? "?").padEnd(24)} [${m.homeCode}] pred=${m.predictionsAvailable}`);
    }
    return;
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: "ESPN public API (site.api.espn.com) + RotoWire (alignements)",
    generator: "scripts/scrape-nhl-schedule.mjs",
    league: { id: "nhl", name: "NHL", country: "USA/Canada" },
    season: { year: seasonCourante() },
    counts: {
      matches: matches.length,
      finished: termines,
      live: enCours,
      upcoming: matches.length - termines,
      predictionsAvailable: pred,
      predictionsUnavailable: matches.length - pred,
      teams: teams.length,
    },
    teams,
    rotowire: { reachable: rotowire.ok, bytes: rotowire.octets ?? 0, markers: rotowire.indices ?? null },
    matches,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`[nhl] Saved to ${OUT}`);
}

main().catch((e) => {
  console.error(`[nhl] ECHEC : ${e.message}`);
  process.exit(1);
});