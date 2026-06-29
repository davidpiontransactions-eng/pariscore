import { useState, useMemo, useEffect } from 'react';
import type { Tournament, TournamentMatch } from '../types';
import { getTournaments, getTournamentBySlug, getMatchesForRound } from '../data/tennisExplorer';

interface Props {
  onPlayerClick: (name: string) => void;
}

/* ── Constantes ── */

const ROUND_ORDER = ['All', 'R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];

const SURFACE_COLORS: Record<string, string> = {
  Grass: 'var(--color-accent-green)',
  Clay: 'var(--color-live)',
  Hard: 'var(--color-accent-blue)',
  Carpet: 'var(--color-text-tertiary)',
};

/* ── Styles ── */

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-lg)',
  },
  sectionLabel: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 13,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 'var(--space-sm)',
  },
};

/* ── Sous-composant : selecteur de tournoi ── */

function TournamentBar({
  tournaments,
  selected,
  onSelect,
}: {
  tournaments: Tournament[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-sm)',
      overflowX: 'auto',
      paddingBottom: 'var(--space-xs)',
    }}>
      {tournaments.map((t) => {
        const isActive = t.slug === selected;
        return (
          <button
            key={t.slug}
            onClick={() => onSelect(t.slug)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              padding: '10px 14px',
              borderRadius: 'var(--radius-card)',
              border: isActive ? '1px solid var(--color-accent-green)' : '1px solid var(--color-border)',
              background: isActive ? 'var(--color-card-hover)' : 'var(--color-card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? 'var(--glow-green)' : 'none',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--color-card-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--color-card)';
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: SURFACE_COLORS[t.surface] ?? 'var(--color-text-tertiary)',
              flexShrink: 0,
            }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 13,
                color: isActive ? 'var(--color-accent-green)' : 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
              }}>
                {t.name}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
              }}>
                {t.category} - {t.location}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Sous-composant : round pills ── */

function RoundTabs({
  rounds,
  selected,
  onSelect,
}: {
  rounds: string[];
  selected: string;
  onSelect: (r: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {rounds.map((r) => {
        const isActive = r === selected;
        return (
          <button
            key={r}
            onClick={() => onSelect(r)}
            style={{
              padding: '4px 14px',
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: isActive ? 'var(--color-accent-green)' : 'var(--color-bg-secondary)',
              color: isActive ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            {r === 'All' ? 'Tous' : r}
          </button>
        );
      })}
    </div>
  );
}

/* ── Sous-composant : ligne de match ── */

function MatchRow({
  match,
  onPlayerClick,
}: {
  match: TournamentMatch;
  onPlayerClick: (name: string) => void;
}) {
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';

  return (
    <div style={{
      background: 'var(--color-card)',
      border: isLive ? '1px solid rgba(255,109,46,0.3)' : '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      padding: 'var(--space-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease',
    }}>
      {/* Partie gauche : round badge + joueur A */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flex: 1 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-display)',
          minWidth: 32,
          textAlign: 'center',
        }}>
          {match.round}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          {/* Joueur A */}
          <button
            onClick={(e) => { e.stopPropagation(); onPlayerClick(match.player_a_name); }}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 14,
              color: isLive ? 'var(--color-live)' : 'var(--color-text-primary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isLive ? 'var(--color-live)' : 'var(--color-text-primary)';
            }}
          >
            {match.player_a_name}
          </button>
          {/* Joueur B */}
          <button
            onClick={(e) => { e.stopPropagation(); onPlayerClick(match.player_b_name); }}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 14,
              color: isLive ? 'var(--color-live)' : 'var(--color-text-secondary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isLive ? 'var(--color-live)' : 'var(--color-text-secondary)';
            }}
          >
            {match.player_b_name}
          </button>
        </div>
      </div>

      {/* Partie centrale : score ou status */}
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        {isLive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 4,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-live)',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 11, color: 'var(--color-live)', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              LIVE
            </span>
          </div>
        )}
        {match.score ? (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            color: isLive ? 'var(--color-live)' : 'var(--color-text-primary)',
          }}>
            {match.score}
          </span>
        ) : match.time ? (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--color-text-tertiary)',
          }}>
            {match.time}
          </span>
        ) : (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
          }}>
            A venir
          </span>
        )}
      </div>

      {/* Partie droite : odds capsules */}
      <div style={{ display: 'flex', gap: 6, minWidth: 90, justifyContent: 'flex-end' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 44,
          padding: '4px 8px',
          borderRadius: 'var(--radius-btn)',
          background: 'var(--color-card-hover)',
          border: '1px solid var(--color-border)',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 13,
          color: match.odds.player_a !== null && match.odds.player_a < 1.50
            ? 'var(--color-accent-green)'
            : 'var(--color-text-primary)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-green)';
            e.currentTarget.style.boxShadow = 'var(--glow-green)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title={match.player_a_name}
        >
          {match.odds.player_a?.toFixed(2) ?? '—'}
        </span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 44,
          padding: '4px 8px',
          borderRadius: 'var(--radius-btn)',
          background: 'var(--color-card-hover)',
          border: '1px solid var(--color-border)',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 13,
          color: match.odds.player_b !== null && match.odds.player_b < 1.50
            ? 'var(--color-accent-green)'
            : 'var(--color-text-primary)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-green)';
            e.currentTarget.style.boxShadow = 'var(--glow-green)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title={match.player_b_name}
        >
          {match.odds.player_b?.toFixed(2) ?? '—'}
        </span>
      </div>
    </div>
  );
}

/* ── API fetching avec fallback mock ── */

const BASE = import.meta.env.VITE_API_BASE ?? '';

type LoadingState = 'idle' | 'loading' | 'error' | 'success';

async function fetchTournamentsFromApi(): Promise<Tournament[] | null> {
  try {
    const res = await fetch(`${BASE}/tennis/tournaments`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return data.tournaments ?? null;
  } catch {
    return null;
  }
}

async function fetchTournamentFromApi(slug: string): Promise<Tournament | null> {
  try {
    const res = await fetch(`${BASE}/tennis/tournaments/${slug}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

/* ── Composant principal ── */

export default function MatchesTab({ onPlayerClick }: Props) {
  const [apiTournaments, setApiTournaments] = useState<Tournament[] | null>(null);
  const [apiTournamentData, setApiTournamentData] = useState<Record<string, Tournament>>({});
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  const tournaments = useMemo(() => apiTournaments ?? getTournaments(), [apiTournaments]);
  const [selectedTournament, setSelectedTournament] = useState(tournaments[0]?.slug ?? '');
  const [selectedRound, setSelectedRound] = useState('All');
  const [showDraw, setShowDraw] = useState(false);

  const tournament = useMemo(
    () => apiTournamentData[selectedTournament] ?? getTournamentBySlug(selectedTournament),
    [selectedTournament, apiTournamentData],
  );

  const availableRounds = useMemo(() => {
    if (!tournament) return ['All'];
    const ordered = ROUND_ORDER.filter((r) =>
      tournament.rounds.some((round) =>
        round.matches.some((m) => m.round === r)
      )
    );
    return ['All', ...ordered];
  }, [tournament]);

  const matches = useMemo(() => {
    const t = apiTournamentData[selectedTournament] ?? tournament;
    if (!t) return [];

    if (selectedRound === 'All') {
      const allMatches = t.rounds.flatMap((r) => r.matches);
      const ROUND_ORDER = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'];
      return allMatches.sort(
        (a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round)
      );
    }

    const roundData = t.rounds.find(
      (r) => r.matches.length > 0 && r.matches[0].round === selectedRound
    );
    return roundData?.matches ?? [];
  }, [selectedTournament, selectedRound, apiTournamentData, tournament]);

  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();
    (async () => {
      const data = await fetchTournamentsFromApi();
      if (cancelled) return;
      if (data && data.length > 0) {
        setApiTournaments(data);
        for (const t of data) {
          const detail = await fetchTournamentFromApi(t.slug);
          if (detail && !cancelled) {
            setApiTournamentData(prev => ({ ...prev, [detail.slug]: detail }));
          }
        }
      } else {
        if (!cancelled) setApiTournaments(getTournaments());
      }
      // Minimum 500ms de loading pour que l'état soit visible
      if (!cancelled) {
        const elapsed = Date.now() - startTime;
        const minDelay = 500;
        if (elapsed < minDelay) {
          await new Promise(r => setTimeout(r, minDelay - elapsed));
        }
        if (!cancelled) setLoadingState('success');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleTournamentChange = (slug: string) => {
    setSelectedTournament(slug);
    setSelectedRound('All');
  };

  /* ── Draw view ── */
  if (showDraw && tournament) {
    const roundNames = [...tournament.rounds].reverse();
    return (
      <div style={s.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={s.sectionLabel}>Tournoi</div>
          <button
            onClick={() => setShowDraw(false)}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-btn)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-card)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Tableau
          </button>
        </div>
        <TournamentBar
          tournaments={tournaments}
          selected={selectedTournament}
          onSelect={handleTournamentChange}
        />

        <div style={{ display: 'flex', gap: 'var(--space-md)', overflowX: 'auto', paddingBottom: 'var(--space-md)' }}>
          {roundNames.map((round) => (
            <div key={round.name} style={{ minWidth: 220, flexShrink: 0 }}>
              <div style={{
                ...s.sectionLabel,
                marginBottom: 'var(--space-sm)',
                fontSize: 11,
                textAlign: 'center',
              }}>
                {round.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {round.matches.map((m) => (
                  <div key={m.id} style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: 'var(--space-sm) var(--space-md)',
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onPlayerClick(m.player_a_name); }}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--color-text-primary)',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                    >
                      {m.player_a_name}
                    </button>
                    {m.score && (
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--color-accent-green)',
                        margin: '2px 0',
                      }}>
                        {m.score}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onPlayerClick(m.player_b_name); }}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                    >
                      {m.player_b_name}
                    </button>
                    {(m.odds.player_a || m.odds.player_b) && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        {m.odds.player_a && (
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-badge)',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-tertiary)',
                          }}>
                            {m.odds.player_a.toFixed(2)}
                          </span>
                        )}
                        {m.odds.player_b && (
                          <span style={{
                            fontSize: 11,
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-badge)',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-tertiary)',
                          }}>
                            {m.odds.player_b.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Table view (par defaut) ── */
  return (
    <div style={s.container}>
      {/* Header: label + toggle draw */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={s.sectionLabel}>Tournois ATP</div>
        <button
          onClick={() => setShowDraw(true)}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-btn)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-card)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-green)';
            e.currentTarget.style.color = 'var(--color-accent-green)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          Arbre
        </button>
      </div>

      {/* Barre des tournois */}
      <TournamentBar
        tournaments={tournaments}
        selected={selectedTournament}
        onSelect={handleTournamentChange}
      />

      {/* Infos tournoi */}
      {tournament && (
        <div style={{
          fontSize: 12,
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-body)',
          display: 'flex',
          gap: 'var(--space-md)',
          alignItems: 'center',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: SURFACE_COLORS[tournament.surface] ?? 'var(--color-text-tertiary)',
              display: 'inline-block',
            }} />
            {tournament.surface}
          </span>
          <span>{tournament.category}</span>
          <span>{tournament.location}</span>
          {tournament.prize_money && <span>{tournament.prize_money}</span>}
          <span style={{ color: 'var(--color-accent-green)' }}>{tournament.draw_size} joueurs</span>
        </div>
      )}

      {/* Round pills */}
      <RoundTabs
        rounds={availableRounds}
        selected={selectedRound}
        onSelect={setSelectedRound}
      />

      {/* Loading state */}
      {loadingState === 'loading' && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', background: 'var(--color-card)' }}>
          <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}>Chargement des matchs...</span>
        </div>
      )}

      {loadingState === 'error' && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)', borderRadius: 'var(--radius-card)', border: '1px solid rgba(255,23,68,0.3)', background: 'var(--color-card)' }}>
          <span style={{ fontSize: 14, color: 'var(--color-danger)' }}>Erreur de chargement — utilisation des données locales</span>
        </div>
      )}

      {/* Liste des matchs */}
      {matches.length === 0 ? (
        <div className="card" style={{
          textAlign: 'center',
          padding: 'var(--space-2xl)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-card)',
        }}>
          <span style={{ fontSize: 14, color: 'var(--color-text-tertiary)' }}>
            Aucun match pour ce tour
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {matches.map((m) => (
            <MatchRow key={m.id} match={m} onPlayerClick={onPlayerClick} />
          ))}
        </div>
      )}
    </div>
  );
}

