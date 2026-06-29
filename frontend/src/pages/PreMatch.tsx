import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { MatchDemo, MatchPrediction, PlayerProfileData, FeatureVector, HealthStatus } from '../types';
import { checkHealth, predictMatch, fetchRecentMatches, fetchUpcomingMatches } from '../api/pariscore';
import type { RecentMatch } from '../api/pariscore';
import { getPlayerByName } from '../data/playerProfiles';
import MatchCard from '../components/MatchCard';
import PredictionOverview from '../components/PredictionOverview';
import KeyFactors from '../components/KeyFactors';
import PlayerProfileModal from '../components/PlayerProfileModal';
import MatchesTab from '../components/MatchesTab';

const SkeletonBlock = ({ width, height, style }: { width: string; height: string; style?: React.CSSProperties }) => (
  <div className="skeleton-pulse" style={{ width, height, ...style }} />
);

export default function PreMatch() {
  const [selected, setSelected] = useState<MatchDemo | null>(null);
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [modelReady, setModelReady] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfileData | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'pronostics' | 'matches' | 'recent'>('pronostics');

  const [upcomingMatches, setUpcomingMatches] = useState<RecentMatch[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const handlePlayerClick = useCallback((name: string) => {
    setSelectedPlayer(getPlayerByName(name) ?? null);
  }, []);

  const recentToMatchDemo = useCallback((m: RecentMatch): MatchDemo => ({
    id: m.match_id,
    player_a: { name: m.player_a_name },
    player_b: { name: m.player_b_name },
    surface: m.surface as 'Hard' | 'Clay' | 'Grass',
    tournament: m.tourney_name,
    date: m.tourney_date,
    features: m.features as FeatureVector,
    bookmaker_odds: undefined,
  }), []);

  const matchSource = useMemo<MatchDemo[]>(
    () => upcomingMatches.map(recentToMatchDemo),
    [upcomingMatches, recentToMatchDemo],
  );

  useEffect(() => {
    checkHealth()
      .then((health: HealthStatus) => {
        setApiStatus('online');
        setModelReady(health.model_loaded);
      })
      .catch(() => {
        setApiStatus('offline');
        setModelReady(false);
      });
  }, []);

  useEffect(() => {
    if (apiStatus !== 'online') return;
    let cancelled = false;
    setMatchesLoading(true);
    Promise.all([fetchUpcomingMatches(), fetchRecentMatches()])
      .then(([upcoming, recent]) => {
        if (cancelled) return;
        setUpcomingMatches(upcoming.matches);
        setRecentMatches(recent.matches);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMatchesLoading(false);
      });
    return () => { cancelled = true; };
  }, [apiStatus]);

  useEffect(() => {
    if (upcomingMatches.length > 0) {
      setSelected(recentToMatchDemo(upcomingMatches[0]));
    }
  }, [upcomingMatches, recentToMatchDemo]);

  useEffect(() => {
    if (activeSubTab === 'pronostics' && selected) {
      const inSource = matchSource.find(m => m.id === selected.id);
      if (!inSource && matchSource.length > 0) {
        setSelected(matchSource[0]);
      }
    }
  }, [activeSubTab, matchSource, selected]);

  const runPrediction = useCallback(async (match: MatchDemo) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setPrediction(null);
    try {
      const result = await predictMatch(match.features, controller.signal);
      if (controller.signal.aborted) return;
      setPrediction(result);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Prediction error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiStatus === 'online' && selected) {
      runPrediction(selected);
    }
  }, [selected, apiStatus, runPrediction]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 'var(--radius-btn)',
    border: 'none',
    background: active ? 'var(--color-accent-green)' : 'var(--color-bg-secondary)',
    color: active ? '#000' : 'var(--color-text-secondary)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    transition: 'all 0.15s ease',
  });

  return (
    <div>
      <style>{`
.skeleton-pulse {
  background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
      `}</style>
      {apiStatus === 'offline' && (
        <div style={{
          background: 'rgba(255,23,68,0.1)',
          border: '1px solid rgba(255,23,68,0.3)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          color: 'var(--color-danger)',
          fontSize: 14,
        }}>
          🔴 API offline — Start API with <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>python run.py api</code>
        </div>
      )}

      {/* Sous-onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-lg)' }}>
        <button
          onClick={() => setActiveSubTab('pronostics')}
          style={tabStyle(activeSubTab === 'pronostics')}
        >
          Predictions
        </button>
        <button
          onClick={() => setActiveSubTab('matches')}
          style={tabStyle(activeSubTab === 'matches')}
        >
          Matches
        </button>
        <button
          onClick={() => setActiveSubTab('recent')}
          style={tabStyle(activeSubTab === 'recent')}
        >
          Résultats récents
        </button>
      </div>

      {activeSubTab === 'pronostics' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--space-lg)' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: 14,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-md)',
            }}>
              Today's Matches
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {matchesLoading && matchSource.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  <span className="text-secondary" style={{ fontSize: 13 }}>Chargement des pronostics...</span>
                </div>
              ) : apiStatus === 'offline' && matchSource.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  <span className="text-tertiary" style={{ fontSize: 13 }}>
                    API en veille — Démarrez le backend avec <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>python run.py api</code>
                  </span>
                </div>
              ) : matchSource.length === 0 && !matchesLoading ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                  <span className="text-tertiary" style={{ fontSize: 13 }}>Aucun match programmé aujourd'hui</span>
                </div>
              ) : (
                matchSource.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={selected?.id === m.id ? prediction : null}
                    loading={selected?.id === m.id && loading}
                    error={selected?.id === m.id ? error : null}
                    onSelect={setSelected}
                    selected={selected?.id === m.id}
                    onPlayerClick={handlePlayerClick}
                  />
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {apiStatus === 'checking' && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <span className="text-secondary">Connecting to API...</span>
              </div>
            )}
            {apiStatus === 'online' && !modelReady && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <span className="text-secondary">⚙️ Modèle en cours de chargement...</span>
              </div>
            )}
            {apiStatus === 'online' && modelReady && loading && (
              <div className="card" style={{ padding: 'var(--space-2xl)' }}>
                <SkeletonBlock width="100%" height="24px" style={{ marginBottom: 12 }} />
                <SkeletonBlock width="60%" height="16px" style={{ marginBottom: 8 }} />
                <SkeletonBlock width="60%" height="16px" style={{ marginBottom: 8 }} />
                <SkeletonBlock width="40%" height="16px" />
              </div>
            )}
            {apiStatus === 'online' && !loading && prediction && (
              <>
                <PredictionOverview prediction={prediction} onPlayerClick={handlePlayerClick} />
                <KeyFactors factors={prediction.key_factors} />
              </>
            )}
            {apiStatus === 'online' && !loading && !prediction && !error && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <span className="text-tertiary">Select a match to see prediction</span>
              </div>
            )}
          </div>
        </div>
      ) : activeSubTab === 'matches' ? (
        <MatchesTab onPlayerClick={handlePlayerClick} />
      ) : (
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 14,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 'var(--space-md)',
          }}>
            Résultats récents
          </h2>

          {matchesLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
              <span className="text-secondary">Chargement des résultats...</span>
            </div>
          ) : recentMatches.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
              <span className="text-tertiary">Aucun résultat récent disponible</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {recentMatches.map((m) => (
                <div
                  key={m.match_id}
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: 'var(--space-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => handlePlayerClick(m.player_a_name)}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--color-text-primary)',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                      >
                        {m.player_a_name}
                      </button>
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>vs</span>
                      <button
                        onClick={() => handlePlayerClick(m.player_b_name)}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--color-text-secondary)',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                      >
                        {m.player_b_name}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                      {m.tourney_name} · {m.round} · {m.surface}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 18,
                        color: m.prob_a >= 50 ? 'var(--color-accent-green)' : 'var(--color-live)',
                      }}>
                        {(m.prob_a * 100).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        conf. {(m.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {m.correct !== undefined && (
                      <span style={{
                        fontSize: 22,
                        lineHeight: 1,
                        fontWeight: 700,
                        color: m.correct ? 'var(--color-accent-green)' : 'var(--color-danger)',
                      }}>
                        {m.correct ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PlayerProfileModal
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
