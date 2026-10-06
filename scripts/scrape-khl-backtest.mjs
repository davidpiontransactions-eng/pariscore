#!/usr/bin/env node
/**
 * scripts/scrape-khl-backtest.mjs
 *
 * Assemble l'historique KHL de backtest : matchs TERMINÉS, flag OT/SO, sur
 * plusieurs saisons. Sortie : data/khl_backtest.json.
 *
 * ── SOURCES ET LEURS LIMITES RÉELLES (mesuré le 2026-10-06) ──────────────
 *
 *   season_id 370 (2025/2026 Regular) : 752 matchs, 1 150 868 o, ~290 ms. FIABLE.
 *   season_id 323 (2024/2025 Regular) : 786 matchs. Fonctionne, mais
 *      l'amont `khl.api.webcaster.pro` échoue par intermittence — les 3
 *      tentatives résolvent en général. Un échec est SIGNALÉ, pas masqué.
 *   season_id 407 (courante) : idem, plus le fichier local `khl_schedule.json`
 *      en repli (il a permis de servir la saison quand l'amont tombait).
 *
 *   AUCUNE PAGINATION : `offset`, `limit` et `date_from` sont IGNORÉS
 *   (vérifié : 752 matchs renvoyés dans tous les cas). La saison arrive en un
 *   seul bloc — si elle est tronquée, impossible de reprendre où ça s'est
 *   arrêté. D'où les tentatives.
 *
 * ── FILTRE ───────────────────────────────────────────────────────────────
 *
 * `home_goal_count = "0"` désigne les matchs NON JOUÉS, pas un 0-0. On exige
 * donc le statut terminé. Mesure à l'appui : un filtre `!= null` a donné
 * 0,893 buts/match au lieu de 5,18.
 *
 * ── DEUX DÉFAUTS DE NOMMAGE, TOUS LES DEUX CORRIGÉS ICI ──────────────────
 *
 * 1. `useShootouts` est un réglage de LIGUE (la KHL utilise les tirs au but),
 *    pas un état de match. Le ORer avec `shootout` marquait les 125 matchs
 *    du courant comme prolongation → 0 temps réglementaire, et l'exclusion
 *    totale de cette saison dans le 1X2. Signalé par une garde : une saison
 *    de ≥10 matchs avec 0 réglementaire est une anomalie.
 *
 * 2. Deux sources, deux conventions de nom :
 *      proxy = « CSKA »            (370, 323, 407-proxy)
 *      local = « CSKA Moskva »     (407-local)
 *    Sans canonisation : (a) les 130 proxy + 125 locaux coexistent → 255
 *    entrées pour ~115 rencontres réelles ; (b) PIRE, « CSKA » en 2024/25 et
 *    « CSKA Moskva » en 2026/27 sont deux clés d'équipe, donc l'historique
 *    ne se combine jamais et λ ne voit jamais le passé au-delà d'une saison.
 *    La table d'alias est DÉRIVÉE des données (croisement date+score entre
 *    les deux libellés du courant) : 22/22 mesurés, aucun écrit à la main.
 *    On canonise sur la forme PROXY, seule présente sur les trois saisons.
 *
 * Usage : node scripts/scrape-khl-backtest.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "khl_backtest.json");
const LOCAL = join(ROOT, "data", "khl_schedule.json");
const ALIAS_FICHIER = join(ROOT, "data", "khl-team-alias.json");
const DRY = process.argv.includes("--dry-run");

const PROXY = "https://khl.shayy.workers.dev?url=";
const FEED = "https://lscluster.hockeytech.com/feed/";

const SAISONS = [
  { sid: "370", nom: "2025/2026 Regular", source: "proxy" },
  { sid: "407", nom: "2026/2027 Regular", source: "proxy" },
  { sid: "323", nom: "2024/2025 Regular", source: "proxy" },
  { sid: "407", nom: "2026/2027 Regular", source: "local" },
];

async function proxy(params, attempts = 3) {
  const qs = new URLSearchParams({ feed: "modulekit", fmt: "json", key: "khl", client_code: "khl", lang: "en", ...params });
  let dernier = "aucune tentative";
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await fetch(`${PROXY}${encodeURIComponent(`${FEED}?${qs}`)}`, { signal: AbortSignal.timeout(60000) });
      if (r.status !== 200) { dernier = `HTTP ${r.status}`; continue; }
      const txt = await r.text();
      let j;
      try { j = JSON.parse(txt); } catch { dernier = `JSON invalide (${txt.length}o) — tronqué`; continue; }
      const sk = j.SiteKit ?? {};
      const problemes = Object.entries(sk)
        .filter(([, v]) => v && typeof v === "object" && "error" in v)
        .map(([, v]) => String(v.error).slice(0, 80));
      if (problemes.length) { dernier = `SiteKit en erreur : ${problemes[0]}`; continue; }
      const liste = Array.isArray(sk.Schedule) ? sk.Schedule : [];
      if (!liste.length) { dernier = "0 match retourné"; continue; }
      return { ok: true, liste };
    } catch (e) {
      dernier = e?.name === "TimeoutError" ? "timeout 60s" : String(e?.message ?? e).slice(0, 80);
    }
    await new Promise((r) => setTimeout(r, 2500 * i));
  }
  return { ok: false, dernier };
}

function normaliser(m, saison, source) {
  const fini =
    m.final === "1" || m.isFinished === true || m.status === "4" || m.game_status === 4;
  const h = Number(m.home_goal_count ?? m.homeGoals ?? NaN);
  const a = Number(m.visiting_goal_count ?? m.awayGoals ?? NaN);
  // Flag PAR MATCH — jamais `useShootouts`, réglage de ligue.
  const ot = m.overtime === "1" || m.overtime === true;
  const so = m.shootout === "1" || m.shootout === true;

  if (!fini || !Number.isInteger(h) || !Number.isInteger(a)) return null;

  return {
    id: String(m.game_id ?? m.id ?? ""),
    date: String(m.GameDateISO8601 ?? m.date_with_day ?? m.date ?? m.scheduledAt ?? "").slice(0, 10),
    domicile: String(m.home_team_name ?? m.homeName ?? ""),
    exterieur: String(m.visiting_team_name ?? m.awayName ?? ""),
    butsDomicile: h,
    butsExterieur: a,
    prolongation: ot || so,
    motifProlongation: so ? "shootout" : ot ? "overtime" : null,
    saison,
    source,
  };
}

/**
 * Table d'alias local → proxy, dérivée par croisement.
 * Même date + même score dans les deux libellés du courant = le même match,
 * donc les noms sont deux écritures du même club.
 * (Le score seul n'est PAS une clé globale : 216 couples date+score se
 * répètent parce que la KHL joue plusieurs matchs par jour.)
 */
function aliasDepuisCroisement(proxyListe, localeListe) {
  const parDate = new Map();
  for (const m of localeListe) {
    if (!parDate.has(m.date)) parDate.set(m.date, []);
    parDate.get(m.date).push(m);
  }
  const alias = new Map(); // nom local -> nom proxy (forme canonique)
  let apparies = 0;
  let miroirs = 0;
  for (const p of proxyListe) {
    const cands = parDate.get(p.date) ?? [];
    let l = cands.find((c) => !c._u && c.butsDomicile === p.butsDomicile && c.butsExterieur === p.butsExterieur);
    if (l) {
      apparies++;
    } else {
      l = cands.find((c) => !c._u && c.butsDomicile === p.butsExterieur && c.butsExterieur === p.butsDomicile);
      if (l) { miroirs++; continue; } // orientation incertaine : on n'infère rien
    }
    if (!l) continue;
    l._u = true;
    alias.set(l.domicile, p.domicile);
    alias.set(l.exterieur, p.exterieur);
  }
  return { alias, apparies, miroirs, restants: proxyListe.length - apparies - miroirs };
}

function canon(nom, alias) {
  return alias.get(nom) ?? nom;
}

async function main() {
  const collecte = [];
  const echecs = [];

  for (const s of SAISONS) {
    let brut;
    if (s.source === "local") {
      if (!existsSync(LOCAL)) { echecs.push({ sid: s.sid, nom: `${s.nom} (local)`, raison: "fichier local absent" }); continue; }
      brut = JSON.parse(readFileSync(LOCAL, "utf8"))?.matches ?? [];
    } else {
      const r = await proxy({ view: "schedule", season_id: s.sid });
      if (!r.ok) { echecs.push({ sid: s.sid, nom: s.nom, raison: r.dernier }); continue; }
      brut = r.liste;
    }
    const n = brut.map((m) => normaliser(m, s.nom, s.source)).filter(Boolean);
    collecte.push(...n);
    console.log(`[khl-backtest] ${s.sid} ${s.nom} (${s.source}) — ${n.length} terminés sur ${brut.length}`);
  }

  // ── Canonisation ──
  // Le courant existe en deux conventions. On croise pour apprendre l'alias,
  // on PERSISTE le résultat, et on retombe sur le fichier persisté quand le
  // fetch proxy de la saison courante a échoué — le cas fréquent, puisque
  // `khl.api.webcaster.pro` tombe par intermittence.
  // Sans repli, on partirait avec un alias vide : la saison courante resterait
  // en nom long alors que 370/323 sont en nom court, donc deux clés d'équipe
  // par club et λ ne verrait jamais l'historique antérieur.
  const courantProxy = collecte.filter((m) => m.source === "proxy" && m.date >= "2026-09-01");
  const courantLocal = collecte.filter((m) => m.source === "local");
  const crois = aliasDepuisCroisement(courantProxy, courantLocal);

  let alias = crois.alias;
  let aliasOrigine = "appris à l'exécution";
  if (alias.size === 0 && existsSync(ALIAS_FICHIER)) {
    try {
      const charge = JSON.parse(readFileSync(ALIAS_FICHIER, "utf8"));
      alias = new Map(Object.entries(charge.alias ?? {}));
      aliasOrigine = `fichier persisté (${charge.derivedAt ?? "date inconnue"})`;
    } catch (e) {
      console.error(`[khl-backtest] ANOMALIE : ${ALIAS_FICHIER} illisible — ${e.message}`);
      process.exitCode = 1;
    }
  }

  const differs = [...alias.entries()].filter(([a, b]) => a !== b);
  console.log(
    `[khl-backtest] croisement : ${crois.apparies} appariés, ${crois.miroirs} miroirs ignorés, ${crois.restants} sans correspondance`,
  );
  console.log(`[khl-backtest] alias : ${differs.length} différents / ${alias.size} — origine : ${aliasOrigine}`);

  // Re-learning : quand le croisement fonctionne, on réécrit la table pour
  // que la prochaine exécution dégradée parte d'un état à jour.
  if (crois.apparies > 0) {
    const payloadAlias = {
      note: "Table d'alias KHL : forme longue (fichier local) -> forme courte (proxy HockeyTech), la forme canonique du backtest.",
      derivedAt: new Date().toISOString().slice(0, 10),
      provenance:
        "Derivee par croisement date+score entre les libelles proxy et local de la saison courante. " +
        "Re-ecrite a chaque execution ou les deux sources sont disponibles.",
      commentaire:
        "Sans cette table, « CSKA » (2024/25) et « CSKA Moskva » (2026/27) sont deux cles d'equipe : " +
        "l'historique ne se combine pas et lambda ne voit jamais le passe au-dela d'une saison.",
      alias: Object.fromEntries([...alias.entries()]),
    };
    if (!DRY) writeFileSync(ALIAS_FICHIER, JSON.stringify(payloadAlias, null, 2));
    console.log(`[khl-backtest] table d'alias persistée (${alias.size} entrées)`);
  }

  if (alias.size === 0 && courantLocal.length > 0) {
    console.error(
      "[khl-backtest] ANOMALIE : matchs locaux présents mais AUCUN alias disponible " +
        "(ni appris, ni persisté) — la saison courante gardera son propre nommage " +
        "et son historique ne se comblera pas avec les saisons passées.",
    );
    process.exitCode = 1;
  }

// `_u` est un marqueur de croisement interne : sans le retirer, il
  // finirait dans le JSON comme un champ dont personne ne saurait que faire.
  const normalises = collecte.map(({ _u, ...m }) => ({
    ...m,
    domicile: canon(m.domicile, alias),
    exterieur: canon(m.exterieur, alias),
  }));

  // ── Dédup : date + équipes canonisées ──
  const vus = new Set();
  const uniques = [];
  for (const m of normalises) {
    const cle = `${m.date}_${m.domicile}_${m.exterieur}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    uniques.push(m);
  }
  uniques.sort((a, b) => a.date.localeCompare(b.date));

  const reg = uniques.filter((m) => !m.prolongation);
  const motif = uniques.filter((m) => m.prolongation).reduce((acc, m) => {
    acc[m.motifProlongation] = (acc[m.motifProlongation] ?? 0) + 1;
    return acc;
  }, {});

  // Vérification : une saison ≥10 matchs sans AUCUN temps réglementaire
  // signalerait un flag de prolongation faux (c'est déjà arrivé avec
  // `useShootouts`, réglage de ligue confondu avec un état de match).
  const parSaison = new Map();
  for (const m of uniques) {
    if (!parSaison.has(m.saison)) parSaison.set(m.saison, { n: 0, reg: 0 });
    const s = parSaison.get(m.saison);
    s.n++;
    if (!m.prolongation) s.reg++;
  }
  for (const [nom, s] of parSaison) {
    if (s.n >= 10 && s.reg === 0) {
      console.error(`[khl-backtest] ANOMALIE : ${nom} — ${s.n} matchs, 0 temps réglementaire.`);
      process.exitCode = 1;
    }
  }

  // Vérification de cohérence : le courant doit être ~un bloc, pas deux.
  const courantCanon = uniques.filter((m) => m.date >= "2026-09-01");
  const attenduCourant = Math.max(courantProxy.length, courantLocal.length);
  if (courantCanon.length > attenduCourant * 1.3) {
    console.error(
      `[khl-backtest] ANOMALIE : saison courante = ${courantCanon.length} entrées pour ${attenduCourant} attendues — doublons non résolus.`,
    );
    process.exitCode = 1;
  }

  console.log(
    `[khl-backtest] ${normalises.length} entrées → ${uniques.length} après canonisation et dédup`,
  );
  console.log(`[khl-backtest] ${uniques.length} matchs, dont ${reg.length} temps réglementaire et ${uniques.length - reg.length} OT/SO`);
  console.log(`[khl-backtest] motifs : ${JSON.stringify(motif)}`);
  for (const e of echecs) console.log(`[khl-backtest] ÉCHEC ${e.sid} ${e.nom} — ${e.raison}`);

  if (DRY) return;

  const payload = {
    updatedAt: new Date().toISOString(),
    generator: "scripts/scrape-khl-backtest.mjs",
    source: "HockeyTech modulekit via khl.shayy.workers.dev — view=schedule",
    canonisation: {
      formeRetenue: "proxy (nom court)",
      origineAlias: aliasOrigine,
      aliasDerives: differs.length,
      alias: Object.fromEntries([...alias.entries()]),
      apparies: crois.apparies,
      miroirsIgnores: crois.miroirs,
      sansCorrespondance: crois.restants,
    },
    notes: [
      "Pas de pagination (offset/limit/date_from ignorés) — une saison entière en un bloc, 3 tentatives d'amont.",
      "Filtre sur le statut terminé, jamais `!= null` : home_goal_count vaut \"0\" pour les matchs non joués.",
      "`useShootouts` est un réglage de ligue et n'est JAMAIS lu comme un état de match.",
      "Noms canonisés sur la forme proxy avant dédup, sinon une même équipe a deux clés d'identité et l'historique ne se combine pas.",
      "OT/SO sont FLAGGÉS, pas exclus : le module décide du périmètre par marché.",
    ],
    counts: {
      total: uniques.length,
      entreesAvantCanonisation: normalises.length,
      tempsReglementaire: reg.length,
      prolongationOuShootout: uniques.length - reg.length,
      motifsProlongation: motif,
      saisons: [...new Set(uniques.map((m) => m.saison))],
      equipes: new Set(uniques.flatMap((m) => [m.domicile, m.exterieur])).size,
      echecs: echecs.length,
    },
    echecs,
    matchs: uniques,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`[khl-backtest] Saved to ${OUT}`);
}

main().catch((e) => {
  console.error(`[khl-backtest] ÉCHEC : ${e.message}`);
  process.exit(1);
});