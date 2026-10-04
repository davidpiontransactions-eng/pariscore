// Parseur des pages de SAISON BetExplorer (handball).
//
// ⚠️ Pourquoi une page de saison et pas les pages journalières :
// `https://www.betexplorer.com/robots.txt` (vérifié 2026-10-04) contient
//   Disallow: /*?year=
//   Disallow: /*?month=
//   Disallow: /*?page=
// → `/handball/results/?year=AAAA&month=MM&day=DD` est INTERDIT. Les pages de
// saison `/handball/{pays}/{ligue}-{saison}/results/` sont des CHEMINS PURS,
// donc autorisées. C'est aussi la seule façon d'obtenir 2 saisons d'historique
// (le feed Flashscore est plafonné à J-7, Vitibet à la saison courante).
//
// Markup mesuré (Starligue 2025/2026, 273 lignes) :
//
//   <table class="table-main js-tablebanner-t js-tablebanner-ntb">
//   <tr><th class="h-text-left" colspan="2">30. Round</th>…   ← ligne de journée : à sauter
//   <tr>
//     <td class="h-text-left"><a data-test="8987045" href="…/IqgXBKtf/" class="in-match">
//        <span><strong>Chambery Savoie</strong></span> - <span>Istres</span></a></td>
//     <td class="h-text-center"><a href="…">30:28</a></td>
//     <td class="table-main__odds colored" …><span …><span data-odd="1.40"></span></span></td>
//     <td class="table-main__odds" … data-odd="9.47"></td>
//     <td class="table-main__odds" … data-odd="3.77"></td>
//     <td class="h-text-right h-text-no-wrap">06.06.</td>
//   </tr>
//
// Deux différences majeures avec les pages journalières, à ne pas oublier :
//   1. PAS de `data-dt` → pas d'heure de coup d'envoi (only `DD.MM.`, sans année) ;
//   2. PAS de `table-main__partial` → PAS DE SCORE MI-TEMPS. Les colonnes
//      `home_half`/`away_half` restent donc NULL pour les matchs issus des pages
//      de saison. Seule la stratégie `htLeader` en pâtit ; la forme, le Team
//      Power et les totaux n'en ont pas besoin. Les feeds Flashscore (J-7) et
//      les snapshots locaux continuent d'apporter la mi-temps en complément.
//
// ⚠️ FIX 2026-10-04 — deux pertes de lignes mesurées sur Starligue 2025/2026
// (241 lignes jouées, 121 seulement conservées). La cause n'était PAS le
// markup mais l'ancrage sur `<strong>` :
//   • 101 lignes où le VAINQUEUR est l'équipe EXTÉRIEURE. `<strong>` est alors
//     sur le nom de droite, la regex ancré dessus capturait une chaîne VIDE et
//     la ligne était rejetée.
//   • 19 NULS : aucun vainqueur, donc aucun `<strong>` → rejet.
// Conséquence mesurée : la table ne contenait que des VICTOIRES À DOMICILE.
// Un backtest sur cet échantillon aurait trouvé un modèle « parfait » (100 %)
// alors qu'il n'avait jamais vu une seule défaite à domicile ni un nul.
// Le nom des deux équipes est désormais lu POSITIONNELLEMENT (séparateur
// littéral « - »), le vainqueur n'étant plus qu'un indice de rendu : le score
// `NN:NN` le donne déjà, et c'est lui qui fait foi.

/**
 * Libellés RELATIFS utilisés par BetExplorer pour les matchs non datés, avec leur
 * décalage en jours. Le HTML est english-only sur le site (on force
 * `Accept-Language: en`), donc pas de variante française nécessaire ; le FR est
 * toléré au cas où.
 */
const RELATIVE_DAYS = {
  today: 0,
  yesterday: 1,
  aujourdhui: 0,
  hier: 1,
};

/**
 * Date ISO déduite d'un `DD.MM.` + la saison à laquelle appartient la page.
 *
 * `refDate` sert au cas RELATIF de BetExplorer : les matchs récents sont
 * affichés « Today » / « Yesterday » et non `DD.MM.`. Sans ce cas, le cron
 * quotidien perdait précisément les matchs de la veille — les seuls qui
 * changent le classement du jour. Mesuré le 2026-10-04 sur la saison en cours :
 * 20 lignes parsees, 2 sans date, cause = `Today` / `Yesterday`.
 *
 * @param {string} dayMonth
 * @param {string} seasonLabel
 * @param {string | Date | null} [refDate] Date de référence des libellés relatifs.
 * @returns {string | null} Date ISO, ou null si non déductible.
 */
export function isoFromDayMonth(dayMonth, seasonLabel, refDate = null) {
  // -1 pour « hier », 0 pour « aujourd'hui ». Décalage appliqué en UTC pour ne
  // pas dépendre du fuseau du runner (pm2 sur le VPS est en UTC).
  const rel = RELATIVE_DAYS[String(dayMonth || '').trim().toLowerCase()];
  if (rel !== undefined) {
    const ref = refDate ? new Date(refDate) : new Date();
    if (Number.isNaN(ref.getTime())) return null;
    ref.setUTCDate(ref.getUTCDate() - rel);
    return ref.toISOString().slice(0, 10);
  }

  const m = String(dayMonth || '').match(/(\d{1,2})\s*\.\s*(\d{1,2})\.?/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (!(day >= 1 && day <= 31) || !(month >= 1 && month <= 12)) return null;
  // Saison européenne « 2025-2026 » ou « 2025/2026 » (BetExplorer écrit le
  // libellé du <select> avec un slash, les URLs avec un tiret — on accepte les
  // deux, sinon toutes les dates retombent à null sur du HTML réel).
  const years = String(seasonLabel || '').match(/(\d{4})\s*[-/]\s*(\d{4})/);
  if (!years) return null;
  const startYear = Number(years[1]);
  const endYear = Number(years[2]);
  // Mois ≥ 8 → année de DÉBUT de saison ; mois ≤ 7 → année de FIN.
  const year = month >= 8 ? startYear : endYear;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Retire les balises et normalise les espaces. */
function text(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Les deux noms d'équipe de la cellule « équipes », dans l'ordre DOMICILE puis
 * EXTÉRIEUR — independent de qui a gagné.
 *
 * BetExplorer écrit `domicile - extérieur` et n'entoure que le VAINQUEUR de
 * `<strong>` :
 *   `<span><strong>A</strong></span> - <span>B</span>`   (A gagne)
 *   `<span>A</span> - <span><strong>B</strong></span>`   (B gagne)
 *   `<span>A</span> - <span>B</span>`                   (nul)
 * L'ordre des noms est donc FIXE et seul le `<strong>` bouge : on lit la
 * position, et le vainqueur se déduit du score.
 *
 * Le séparateur testé est `\s+-\s+` (espaces obligatoires) et non un `-` nu :
 * `Saint-Raphael`, `Cesson Rennes-Metropole` et `St. Raphael` contiennent des
 * tirets sans espaces, un `-` nu les couperait en deux.
 *
 * Renvoie `null` si la cellule n'est pas au format attendu (page d'accueil,
 * ligne sans contenu, etc.) — jamais de nom deviné.
 */
function parseTeams(teamCell) {
  const inner = String(teamCell || '').match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  if (!inner) return null;
  const parts = inner[1]
    .split(/\s+-\s+/)
    .map((p) => text(p))
    .filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  return { home: parts[0], away: parts[1] };
}

/** Extrait l'attribut `data-odd="..."` d'un fragment. */
function firstOdd(fragment) {
  const m = String(fragment).match(/data-odd="([\d.]+)"/);
  return m ? Number(m[1]) : null;
}

/**
 * Un triplet 1X2 est-il exploitable ?
 *
 * Les cellules de cote sont lues par POSITION (`tds[2..4]`), ce qui casse sur
 * une ligne dont la mise en page diffère : un match reporté peut ne pas avoir ses
 * 3 cellules, et les valeurs lues à ces indices ne sont alors pas des cotes.
 * Mesuré le 2026-10-04 : `SIK Viborg W vs Rodovre W` stockait
 * `80.9 / 86.73 / 1.98`, soit une somme de probabilités implicites de **0.53** —
 * mathématiquement impossible (un bookmaker ne paie jamais).
 *
 * Plutôt que deviner le markup du cas dégénéré, on VALIDE l'invariant métier,
 * qui est plus fort que n'importe quelle heuristique de sélection :
 *   • les 3 cotes présentes et >= 1 (une cote décimale SOUS 1 n'existe pas) ;
 *   • Σ 1/cote dans [0.9, 1.4] — un bookmaker réel est entre 1.02 et 1.20, la
 *     marge d'un exchange pouvant descendre sous 1.
 *
 * ⚠️ Seuil à 1 et non à 1.01 : les favoris lourds à 1.00 / 1.01 sont RÉELS et
 * présents en base (`Metz W vs Achenheim → 1.00/37/34.88`, `Brest Bretagne →
 * 1.01/43.25/33.63`). Un garde-fou à 1.01 les jetterait : c'est un test sur des
 * données réelles qui l'a fait resortir.
 *
 * @returns {boolean} false → le match est conservé SANS cote (le score, lui,
 *   reste bon) plutôt qu'avec une cote inventée.
 */
export function isCoherentOddsTriple(oddsHome, oddsDraw, oddsAway) {
  const o = [oddsHome, oddsDraw, oddsAway];
  for (const v of o) {
    if (v == null || !Number.isFinite(v) || v < 1) return false;
  }
  const sum = 1 / o[0] + 1 / o[1] + 1 / o[2];
  return sum > 0.9 && sum < 1.4;
}

/**
 * Parse les lignes de résultats d'une page de saison.
 *
 * Renvoie uniquement les matchs réellement joués : une page de saison ne liste
 * que du terminé, mais on re-vérifie la présence des 3 chunks (équipes + score)
 * pour ne jamais émettre une ligne à moitié remplie.
 *
 * `refDate` est transmis à `isoFromDayMonth` pour résoudre les dates relatives
 * (« Today » / « Yesterday ») des matchs récents.
 *
 * @param {string} html
 * @param {string} seasonLabel
 * @param {string | Date | null} [refDate] Date de référence des libellés relatifs.
 * @returns {Array<{home: string, away: string, homeGoals: number, awayGoals: number,
 *                  date: string | null, oddsHome: number | null,
 *                  oddsDraw: number | null, oddsAway: number | null,
 *                  refId: string | null, status: string}>}
 */
export function parseSeasonRows(html, seasonLabel, refDate = null) {
  const out = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(String(html || ''))) !== null) {
    const inner = tr[1];
    // Ligne de journée (« 30. Round ») : pas de cellule équipe, on saute.
    if (!/<td\b/i.test(inner)) continue;

    const tds = inner.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || [];
    if (tds.length < 3) continue;

    // Cellule équipes : lecture POSITIONNELLE ( domicile - extérieur ). Le
    // <strong> du vainqueur est ignoré : ancré dessus, on perdait toute ligne
    // où l'extérieur gagne ainsi que tous les nuls (mesuré : 120/241 lignes).
    const teams = parseTeams(tds[0]);
    if (!teams) continue;
    const { home, away } = teams;

    // Score : 2ᵉ cellule, format NN:NN.
    const scoreCell = tds[1];
    const scoreM = scoreCell.match(/>\s*(\d{1,3})\s*:\s*(\d{1,3})\s*</);
    if (!scoreM) continue;
    const homeGoals = Number(scoreM[1]);
    const awayGoals = Number(scoreM[2]);
    if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;

// Cotes 1X2 : 3 cellules qui suivent le score, VALIDÉES. Une ligne dont la
    // mise en page diffère (match reporté) ferait lire des valeurs qui ne sont
    // pas des cotes ; on préfère garder le match sans cote que le garder avec une
    // cote fausse — un ROI calculé sur une cote inventée est pire qu'un match
    // absent du segment 1N2.
    const [rawH, rawD, rawA] = [tds[2], tds[3], tds[4]].map((c) => firstOdd(c));
    const coherent = isCoherentOddsTriple(rawH, rawD, rawA);
    const odds = coherent ? [rawH, rawD, rawA] : [null, null, null];

    // Date : dernière cellule `h-text-right`.
    let date = null;
    for (let i = tds.length - 1; i >= 1; i--) {
      if (/h-text-right/i.test(tds[i])) {
        date = isoFromDayMonth(text(tds[i]), seasonLabel, refDate);
        if (date) break;
      }
    }

    // Id de match stable, dans le href (`…/IqgXBKtf/`).
    const hrefM = tds[0].match(/href="([^"]+)"/);
    const idM = hrefM && hrefM[1].match(/\/([A-Za-z0-9]{6,})\/?$/);
    const refId = idM ? idM[1] : null;

    out.push({
      home,
      away,
      homeGoals,
      awayGoals,
      date,
      oddsHome: odds[0],
      oddsDraw: odds[1],
      oddsAway: odds[2],
      refId,
      status: 'FT',
    });
  }
  return out;
}

/**
 * Découvre les liens de saison disponibles sur une page ligue BetExplorer.
 *
 * Indispensable : le slug CHANGE selon les saisons (MOL Liga = `doprastav-liga-women`
 * en 2025/2026, `mol-liga-women` en 2024/2025, `whil-women` en 2016/2017). Un
 * slug codé en dur 404 dès la saison suivante ; on lit donc le `<select>` des
 * saisons. La saison EN COURS n'a pas de suffixe (`/handball/france/starligue/`).
 *
 * Renvoie un Map libellé de saison → chemin (sans `/results/`).
 */
export function discoverSeasonLinks(html) {
  const map = new Map();
  const re = /<option[^>]*value="([^"]*)"[^>]*>\s*([^<]{0,40}?)\s*<\/option>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const path = m[1];
    const label = m[2].trim();
    if (!/^\d{4}\/\d{4}$/.test(label)) continue;
    if (!/^\/handball\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i.test(path)) continue;
    map.set(label, path);
  }
  return map;
}
