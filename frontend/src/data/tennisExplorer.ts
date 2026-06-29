/**
 * Module TennisExplorer — Donnees de tournois ATP
 *
 * Fournit des donnees statiques simulant la structure TennisExplorer.
 * En production, ces donnees seront remplacees par un fetch + DOMParser
 * sur tennis-explorer.com.
 */

import type { Tournament, TournamentMatch, DrawData, DrawMatch } from '../types';

const ROUND_ORDER = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];

/* ── Helpers ── */

export function getPlayerSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function tournamentSlugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── Factories ── */

function odds(a: number, b: number): TournamentMatch['odds'] {
  return { player_a: a, player_b: b };
}

function match(
  id: string,
  round: string,
  a: string,
  b: string,
  status: TournamentMatch['status'],
  o: TournamentMatch['odds'],
  score?: string,
  time?: string,
): TournamentMatch {
  return {
    id,
    round,
    player_a_name: a,
    player_b_name: b,
    player_a_slug: getPlayerSlug(a),
    player_b_slug: getPlayerSlug(b),
    odds: o,
    status,
    score,
    time,
  };
}

const scheduled_1 = (id: string, r: string, a: string, b: string, oa: number, ob: number, t?: string) =>
  match(id, r, a, b, 'scheduled', odds(oa, ob), undefined, t);
const completed = (id: string, r: string, a: string, b: string, oa: number, ob: number, s: string) =>
  match(id, r, a, b, 'completed', odds(oa, ob), s);
const live = (id: string, r: string, a: string, b: string, oa: number, ob: number, s: string) =>
  match(id, r, a, b, 'live', odds(oa, ob), s);

/* ── Tournois ── */

const WIMBLEDON_2026: Tournament = {
  id: 'wimbledon-2026',
  name: 'Wimbledon',
  slug: 'wimbledon',
  surface: 'Grass',
  category: 'Grand Slam',
  year: 2026,
  location: 'Londres, Royaume-Uni',
  prize_money: '42,5M £',
  draw_size: 128,
  current_round: 'QF',
  rounds: [
    {
      name: 'Quarter-finals',
      matches: [
        completed('w-r128-1', 'QF', 'Novak Djokovic', 'Carlos Alcaraz', 1.85, 2.10, '7–6 4–6 6–3 6–4'),
        completed('w-r128-2', 'QF', 'Jannik Sinner', 'Alexander Zverev', 1.45, 2.75, '6–3 7–5 6–2'),
        scheduled_1('w-qf-3', 'QF', 'Daniil Medvedev', 'Andrey Rublev', 1.80, 2.15, '14:00'),
        scheduled_1('w-qf-4', 'QF', 'Stefanos Tsitsipas', 'Casper Ruud', 1.70, 2.30, '16:00'),
      ],
    },
    {
      name: '3rd Round',
      matches: [
        completed('w-r64-1', 'R64', 'Novak Djokovic', 'Holger Rune', 1.25, 4.00, '6–1 6–4 6–2'),
        completed('w-r64-2', 'R64', 'Carlos Alcaraz', 'Ben Shelton', 1.20, 5.00, '6–3 4–6 7–5 6–1'),
        completed('w-r64-3', 'R64', 'Jannik Sinner', 'Alex de Minaur', 1.30, 3.60, '7–6 6–2 6–1'),
        completed('w-r64-4', 'R64', 'Alexander Zverev', 'Hubert Hurkacz', 1.50, 2.70, '7–6 6–4 3–6 7–5'),
        completed('w-r64-5', 'R64', 'Daniil Medvedev', 'Grigor Dimitrov', 1.40, 3.00, '6–4 6–2 7–6'),
        completed('w-r64-6', 'R64', 'Andrey Rublev', 'Taylor Fritz', 1.80, 2.10, '7–5 3–6 6–3 6–4'),
        completed('w-r64-7', 'R64', 'Stefanos Tsitsipas', 'Tommy Paul', 1.55, 2.50, '6–3 7–6 4–6 6–2'),
        completed('w-r64-8', 'R64', 'Casper Ruud', 'Jack Draper', 1.65, 2.35, '6–4 7–6 3–6 6–3'),
      ],
    },
    {
      name: '1st Round',
      matches: [
        completed('w-r1-1', 'R128', 'Novak Djokovic', 'Arthur Fils', 1.10, 8.00, '6–2 6–3 6–1'),
        completed('w-r1-2', 'R128', 'Carlos Alcaraz', 'Brandon Nakashima', 1.08, 10.00, '6–3 7–5 6–2'),
        completed('w-r1-3', 'R128', 'Jannik Sinner', 'Sebastian Korda', 1.12, 7.00, '6–4 6–2 6–4'),
        completed('w-r1-4', 'R128', 'Alexander Zverev', 'Nicolas Jarry', 1.22, 4.50, '7–6 6–3 6–4'),
      ],
    },
  ],
};

const RG_2026: Tournament = {
  id: 'roland-garros-2026',
  name: 'Roland Garros',
  slug: 'roland-garros',
  surface: 'Clay',
  category: 'Grand Slam',
  year: 2026,
  location: 'Paris, France',
  prize_money: '49,6M €',
  draw_size: 128,
  current_round: 'F',
  rounds: [
    {
      name: 'Final',
      matches: [
        completed('rg-f-1', 'F', 'Carlos Alcaraz', 'Jannik Sinner', 1.90, 2.00, '3–6 7–5 6–2 5–7 6–4'),
      ],
    },
    {
      name: 'Semi-finals',
      matches: [
        completed('rg-sf-1', 'SF', 'Carlos Alcaraz', 'Novak Djokovic', 1.65, 2.35, '6–4 7–6 4–6 6–3'),
        completed('rg-sf-2', 'SF', 'Jannik Sinner', 'Alexander Zverev', 1.55, 2.50, '7–5 6–3 7–6'),
      ],
    },
    {
      name: 'Quarter-finals',
      matches: [
        completed('rg-qf-1', 'QF', 'Novak Djokovic', 'Casper Ruud', 1.30, 3.60, '6–3 7–6 6–2'),
        completed('rg-qf-2', 'QF', 'Carlos Alcaraz', 'Stefanos Tsitsipas', 1.40, 3.00, '7–5 6–4 6–1'),
        completed('rg-qf-3', 'QF', 'Jannik Sinner', 'Andrey Rublev', 1.25, 4.00, '6–3 6–4 7–5'),
        completed('rg-qf-4', 'QF', 'Alexander Zverev', 'Daniil Medvedev', 1.70, 2.30, '7–6 4–6 6–3 6–7 6–3'),
      ],
    },
    {
      name: '1st Round',
      matches: [
        completed('rg-r1-1', 'R128', 'Novak Djokovic', 'Giovanni Mpetshi Perricard', 1.08, 10.00, '6–3 6–4 6–2'),
        completed('rg-r1-2', 'R128', 'Carlos Alcaraz', 'Lorenzo Sonego', 1.05, 12.00, '6–2 7–5 6–1'),
        completed('rg-r1-3', 'R128', 'Jannik Sinner', 'Alex de Minaur', 1.15, 6.00, '6–4 6–3 6–2'),
        completed('rg-r1-4', 'R128', 'Alexander Zverev', 'Tallon Griekspoor', 1.25, 4.00, '7–6 6–4 6–3'),
        completed('rg-r1-5', 'R128', 'Daniil Medvedev', 'Sebastian Baez', 1.20, 5.00, '6–1 6–3 6–4'),
        completed('rg-r1-6', 'R128', 'Andrey Rublev', 'Frances Tiafoe', 1.50, 2.70, '6–4 7–6 4–6 6–2'),
        completed('rg-r1-7', 'R128', 'Stefanos Tsitsipas', 'Laslo Djere', 1.12, 7.00, '6–3 6–4 6–2'),
        completed('rg-r1-8', 'R128', 'Casper Ruud', 'Borna Coric', 1.40, 3.00, '6–4 6–1 6–3'),
      ],
    },
  ],
};

const EASTBOURNE_2026: Tournament = {
  id: 'eastbourne-2026',
  name: 'Eastbourne International',
  slug: 'eastbourne',
  surface: 'Grass',
  category: 'ATP 250',
  year: 2026,
  location: 'Eastbourne, Royaume-Uni',
  prize_money: '812 000 €',
  draw_size: 32,
  current_round: 'QF',
  rounds: [
    {
      name: 'Quarter-finals',
      matches: [
        live('eb-qf-1', 'QF', 'Jack Draper', 'Tommy Paul', 1.72, 2.10, '4–6 6–3 2–1'),
        completed('eb-qf-2', 'QF', 'Ben Shelton', 'Alex de Minaur', 2.20, 1.65, '7–6 6–3'),
        scheduled_1('eb-qf-3', 'QF', 'Frances Tiafoe', 'Sebastian Korda', 1.85, 2.00, '13:00'),
        scheduled_1('eb-qf-4', 'QF', 'Grigor Dimitrov', 'Matteo Berrettini', 1.60, 2.40, '15:00'),
      ],
    },
    {
      name: '2nd Round',
      matches: [
        completed('eb-r2-1', 'R16', 'Jack Draper', 'Arthur Fils', 1.50, 2.70, '6–3 7–5'),
        completed('eb-r2-2', 'R16', 'Tommy Paul', 'Nicolas Jarry', 1.65, 2.35, '7–6 4–6 7–5'),
        completed('eb-r2-3', 'R16', 'Ben Shelton', 'Lorenzo Musetti', 1.55, 2.50, '6–4 7–6'),
        completed('eb-r2-4', 'R16', 'Alex de Minaur', 'Jordan Thompson', 1.35, 3.25, '6–2 6–4'),
        completed('eb-r2-5', 'R16', 'Frances Tiafoe', 'Emil Ruusuvuori', 1.70, 2.20, '7–6 3–6 6–3'),
        completed('eb-r2-6', 'R16', 'Sebastian Korda', 'Max Purcell', 1.45, 2.80, '6–4 6–3'),
        scheduled_1('eb-r2-7', 'R16', 'Grigor Dimitrov', 'Alejandro Davidovich Fokina', 1.60, 2.40, '12:00'),
        completed('eb-r2-8', 'R16', 'Matteo Berrettini', 'Zizou Bergs', 1.20, 5.00, '6–2 6–4'),
      ],
    },
    {
      name: '1st Round',
      matches: [
        completed('eb-r1-1', 'R32', 'Jack Draper', 'Daniel Evans', 1.30, 3.60, '6–4 6–2'),
        completed('eb-r1-2', 'R32', 'Arthur Fils', 'Marcos Giron', 1.65, 2.35, '7–5 6–3'),
        completed('eb-r1-3', 'R32', 'Tommy Paul', 'Jaume Munar', 1.35, 3.25, '6–3 6–4'),
        completed('eb-r1-4', 'R32', 'Lorenzo Musetti', 'Marin Cilic', 1.55, 2.50, '6–7 6–3 6–2'),
        completed('eb-r1-5', 'R32', 'Nicolas Jarry', 'Jan-Lennard Struff', 1.85, 2.00, '7–6 6–3'),
        completed('eb-r1-6', 'R32', 'Frances Tiafoe', 'Roberto Bautista Agut', 1.50, 2.70, '6–2 6–4'),
      ],
    },
  ],
};

const QUEENS_2026: Tournament = {
  id: 'queens-2026',
  name: 'Queen\'s Club Championships',
  slug: 'queens',
  surface: 'Grass',
  category: 'ATP 500',
  year: 2026,
  location: 'Londres, Royaume-Uni',
  prize_money: '2,5M €',
  draw_size: 32,
  current_round: 'SF',
  rounds: [
    {
      name: 'Semi-finals',
      matches: [
        scheduled_1('q-sf-1', 'SF', 'Holger Rune', 'Taylor Fritz', 1.90, 2.00, '14:30'),
        scheduled_1('q-sf-2', 'SF', 'Alex de Minaur', 'Carlos Alcaraz', 3.50, 1.35, '16:00'),
      ],
    },
    {
      name: 'Quarter-finals',
      matches: [
        completed('q-qf-1', 'QF', 'Holger Rune', 'Jack Draper', 1.65, 2.35, '6–3 7–5'),
        completed('q-qf-2', 'QF', 'Taylor Fritz', 'Ben Shelton', 1.75, 2.15, '7–6 4–6 7–5'),
        completed('q-qf-3', 'QF', 'Alex de Minaur', 'Daniil Medvedev', 2.50, 1.55, '7–5 6–4'),
        completed('q-qf-4', 'QF', 'Carlos Alcaraz', 'Grigor Dimitrov', 1.30, 3.60, '6–2 6–4'),
      ],
    },
    {
      name: '1st Round',
      matches: [
        completed('q-r1-1', 'R32', 'Carlos Alcaraz', 'Andy Murray', 1.08, 10.00, '6–2 6–3'),
        completed('q-r1-2', 'R32', 'Daniil Medvedev', 'Frances Tiafoe', 1.40, 3.00, '7–5 6–4'),
      ],
    },
  ],
};

/* ── Registry ── */

export const MOCK_TOURNAMENTS: Record<string, Tournament> = {
  'roland-garros': RG_2026,
  'wimbledon': WIMBLEDON_2026,
  'queens': QUEENS_2026,
  'eastbourne': EASTBOURNE_2026,
};

const CATEGORY_ORDER: Record<string, number> = {
  'Grand Slam': 0,
  'ATP 1000': 1,
  'ATP 500': 2,
  'ATP 250': 3,
};

/* ── Public API ── */

export function getTournaments(): Tournament[] {
  return Object.values(MOCK_TOURNAMENTS).sort(
    (a, b) => (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9),
  );
}

export function getTournamentBySlug(slug: string): Tournament | undefined {
  return MOCK_TOURNAMENTS[slug];
}

export function getMatchesForRound(tournamentSlug: string, round: string): TournamentMatch[] {
  const tournament = MOCK_TOURNAMENTS[tournamentSlug];
  if (!tournament) return [];

  if (round === 'All') {
    const allMatches = tournament.rounds.flatMap((r) => r.matches);
    return allMatches.sort(
      (a, b) => (ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round))
    );
  }

  const roundData = tournament.rounds.find(
    (r) => r.matches.length > 0 && r.matches[0].round === round,
  );
  return roundData?.matches ?? [];
}

function detectWinner(score: string | undefined, playerAName: string, playerBName: string): 'a' | 'b' | undefined {
  if (!score) return undefined;
  const sets = score.split(' ');
  let setsA = 0, setsB = 0;
  for (const set of sets) {
    const parts = set.split('–');
    if (parts.length === 2) {
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      if (!isNaN(a) && !isNaN(b)) {
        if (a > b) setsA++;
        else if (b > a) setsB++;
      }
    }
  }
  if (setsA > setsB) return 'a';
  if (setsB > setsA) return 'b';
  return undefined;
}

export function getTournamentDraw(slug: string): DrawData | undefined {
  const tournament = MOCK_TOURNAMENTS[slug];
  if (!tournament) return undefined;

  const drawRounds: DrawMatch[][] = [];
  const roundNames = tournament.rounds.map((r) => r.name).reverse();

  roundNames.forEach((roundName, roundIdx) => {
    const round = tournament.rounds.find((r) => r.name === roundName);
    if (!round) return;

    const drawMatches: DrawMatch[] = round.matches.map((m, i) => ({
      id: `draw-${m.id}`,
      position: roundIdx * 100 + i,
      player_a_name: m.player_a_name,
      player_b_name: m.player_b_name,
      player_a_slug: m.player_a_slug,
      player_b_slug: m.player_b_slug,
      score: m.score,
      odds: m.odds,
      winner: detectWinner(m.score, m.player_a_name, m.player_b_name),
      children: [null, null],
    }));

    drawRounds.push(drawMatches);
  });

  return {
    tournamentId: tournament.id,
    rounds: drawRounds,
  };
}
