import { useState } from 'react';
import { Swords, Trophy } from 'lucide-react';

const PLAYERS = [
  'Djokovic', 'Alcaraz', 'Sinner', 'Zverev', 'Nadal',
  'Ruud', 'Medvedev', 'Rublev', 'Fritz', 'Tsitsipas',
];

interface H2HRecord {
  overall: { a: number; b: number };
  hard: { a: number; b: number };
  clay: { a: number; b: number };
  grass: { a: number; b: number };
  recent: { winner: string; loser: string; score: string; tournament: string; surface: string; date: string }[];
}

const DEMO_H2H: Record<string, Record<string, H2HRecord>> = {
  Djokovic: {
    Alcaraz: {
      overall: { a: 4, b: 3 },
      hard: { a: 1, b: 2 },
      clay: { a: 2, b: 1 },
      grass: { a: 1, b: 0 },
      recent: [
        { winner: 'Djokovic', loser: 'Alcaraz', score: '6-4 6-3', tournament: 'Wimbledon', surface: 'Grass', date: '2025-07-14' },
        { winner: 'Alcaraz', loser: 'Djokovic', score: '7-5 6-7 6-4', tournament: 'Roland Garros', surface: 'Clay', date: '2025-06-08' },
        { winner: 'Djokovic', loser: 'Alcaraz', score: '6-3 7-6', tournament: 'ATP Finals', surface: 'Hard', date: '2024-11-17' },
        { winner: 'Alcaraz', loser: 'Djokovic', score: '7-6 4-6 6-3', tournament: 'US Open', surface: 'Hard', date: '2024-09-06' },
      ],
    },
  },
  Sinner: {
    Zverev: {
      overall: { a: 6, b: 4 },
      hard: { a: 3, b: 1 },
      clay: { a: 2, b: 2 },
      grass: { a: 1, b: 1 },
      recent: [
        { winner: 'Sinner', loser: 'Zverev', score: '7-5 6-4', tournament: 'Australian Open', surface: 'Hard', date: '2025-01-22' },
        { winner: 'Zverev', loser: 'Sinner', score: '6-3 3-6 7-6', tournament: 'Monte Carlo', surface: 'Clay', date: '2025-04-14' },
        { winner: 'Sinner', loser: 'Zverev', score: '6-4 7-5', tournament: 'Rotterdam', surface: 'Hard', date: '2024-02-16' },
        { winner: 'Zverev', loser: 'Sinner', score: '7-6 6-7 7-5', tournament: 'Rome', surface: 'Clay', date: '2024-05-10' },
      ],
    },
  },
  Nadal: {
    Djokovic: {
      overall: { a: 31, b: 30 },
      hard: { a: 7, b: 8 },
      clay: { a: 20, b: 9 },
      grass: { a: 4, b: 13 },
      recent: [
        { winner: 'Djokovic', loser: 'Nadal', score: '6-2 7-6', tournament: 'Roland Garros', surface: 'Clay', date: '2024-06-05' },
        { winner: 'Nadal', loser: 'Djokovic', score: '7-5 6-4', tournament: 'Barcelona', surface: 'Clay', date: '2024-04-21' },
        { winner: 'Djokovic', loser: 'Nadal', score: '6-3 6-7 6-3', tournament: 'Australian Open', surface: 'Hard', date: '2023-01-27' },
        { winner: 'Nadal', loser: 'Djokovic', score: '7-6 4-6 6-2 6-3', tournament: 'Roland Garros', surface: 'Clay', date: '2023-06-11' },
      ],
    },
  },
};

function lookupH2H(a: string, b: string): H2HRecord | null {
  if (a === b || !a || !b) return null;
  const fromA = DEMO_H2H[a]?.[b];
  if (fromA) return fromA;
  const fromB = DEMO_H2H[b]?.[a];
  if (fromB) {
    return {
      overall: { a: fromB.overall.b, b: fromB.overall.a },
      hard: { a: fromB.hard.b, b: fromB.hard.a },
      clay: { a: fromB.clay.b, b: fromB.clay.a },
      grass: { a: fromB.grass.b, b: fromB.grass.a },
      recent: fromB.recent,
    };
  }
  return null;
}

const surfaceColor = (surface: string) => {
  switch (surface) {
    case 'Hard': return 'var(--color-accent-blue)';
    case 'Clay': return 'var(--color-live)';
    case 'Grass': return 'var(--color-accent-green)';
    default: return 'var(--color-text-tertiary)';
  }
};

function Bar({ a, b, label, color }: { a: number; b: number; label: string; color: string }) {
  const total = a + b || 1;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--color-text-secondary)' }}>{a} - {b}</span>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--color-bg-secondary)' }}>
        <div style={{ width: `${(a / total) * 100}%`, background: color, transition: 'width 0.3s' }} />
        <div style={{ width: `${(b / total) * 100}%`, background: 'var(--color-border-medium)', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export default function H2HPage() {
  const [playerA, setPlayerA] = useState('Djokovic');
  const [playerB, setPlayerB] = useState('Alcaraz');
  const h2h = lookupH2H(playerA, playerB);

  const selectStyle: React.CSSProperties = {
    background: 'var(--color-card)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-medium)',
    borderRadius: 'var(--radius-btn)',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    width: '100%',
    cursor: 'pointer',
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 22,
          margin: 0,
        }}>
          Head-to-Head
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          Head-to-Head Records
        </p>
      </div>

      <div className="h2h-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-md)', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Player A</div>
          <select value={playerA} onChange={(e) => setPlayerA(e.target.value)} style={selectStyle}>
            {PLAYERS.filter((p) => p !== playerB).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div style={{ paddingTop: 16 }}>
          <Swords size={24} color="var(--color-text-tertiary)" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Player B</div>
          <select value={playerB} onChange={(e) => setPlayerB(e.target.value)} style={selectStyle}>
            {PLAYERS.filter((p) => p !== playerA).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {!h2h ? (
        <div style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-2xl)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 14,
        }}>
          No head-to-head record available for this pair.
        </div>
      ) : (
        <>
          <div style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-lg)',
            textAlign: 'center',
          }}>
            <Trophy size={32} color="var(--color-live)" style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
              {h2h.overall.a} - {h2h.overall.b}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--color-accent-green)', fontWeight: 600 }}>{playerA}: {h2h.overall.a} victoires</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>|</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{playerB}: {h2h.overall.b} victoires</span>
            </div>
          </div>

          <div style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--padding-card)',
            marginBottom: 'var(--space-lg)',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-md)',
            }}>
              Repartition par surface
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <Bar a={h2h.hard.a} b={h2h.hard.b} label="Dur" color={surfaceColor('Hard')} />
              <Bar a={h2h.clay.a} b={h2h.clay.b} label="Terre battue" color={surfaceColor('Clay')} />
              <Bar a={h2h.grass.a} b={h2h.grass.b} label="Gazon" color={surfaceColor('Grass')} />
            </div>
          </div>

          <div style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--padding-card)',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-md)',
            }}>
              Recent Matches
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {h2h.recent.map((m, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: '12px 0',
                  borderBottom: i < h2h.recent.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <div style={{
                    width: 4,
                    height: 40,
                    borderRadius: 2,
                    background: surfaceColor(m.surface),
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: m.winner === playerA ? 'var(--color-accent-green)' : 'var(--color-text-primary)' }}>{m.winner}</span>
                      <span style={{ color: 'var(--color-text-tertiary)', margin: '0 4px' }}>def.</span>
                      <span style={{ color: m.winner === playerB ? 'var(--color-accent-green)' : 'var(--color-text-primary)' }}>{m.loser}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      <span>{m.score}</span>
                      <span>{m.tournament}</span>
                      <span>{m.surface}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{m.date}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
