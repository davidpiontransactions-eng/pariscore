import { useState, useEffect, useCallback } from 'react';
import type { MatchDemo, MatchPrediction } from '../types';
import { checkHealth, predictMatch } from '../api/pariscore';
import { DEMO_MATCHES } from '../data/sampleMatches';
import MatchCard from '../components/MatchCard';
import PredictionOverview from '../components/PredictionOverview';
import KeyFactors from '../components/KeyFactors';

export default function PreMatch() {
  const [selected, setSelected] = useState<MatchDemo>(DEMO_MATCHES[0]);
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkHealth()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));
  }, []);

  const runPrediction = useCallback(async (match: MatchDemo) => {
    setLoading(true);
    setError(null);
    setPrediction(null);
    try {
      const result = await predictMatch(match.features);
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de prédiction');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiStatus === 'online') runPrediction(selected);
  }, [selected, apiStatus, runPrediction]);

  return (
    <div>
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
          🔴 API hors ligne — Démarre l'API avec <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>python run.py api</code>
        </div>
      )}

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
            🎾 Matchs du jour
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {DEMO_MATCHES.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={selected.id === m.id ? prediction : null}
                loading={selected.id === m.id && loading}
                error={selected.id === m.id ? error : null}
                onSelect={setSelected}
                selected={selected.id === m.id}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {apiStatus === 'checking' && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
              <span className="text-secondary">Connexion à l'API...</span>
            </div>
          )}
          {apiStatus === 'online' && loading && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
              <span className="text-secondary">Calcul de la prédiction...</span>
            </div>
          )}
          {apiStatus === 'online' && !loading && prediction && (
            <>
              <PredictionOverview prediction={prediction} />
              <KeyFactors factors={prediction.key_factors} />
            </>
          )}
          {apiStatus === 'online' && !loading && !prediction && !error && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
              <span className="text-tertiary">Sélectionne un match pour voir la prédiction</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
