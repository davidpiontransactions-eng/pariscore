import type { MatchPrediction } from '../types';

interface Props {
  prediction: MatchPrediction;
  onPlayerClick?: (name: string) => void;
}

export default function PredictionOverview({ prediction, onPlayerClick }: Props) {
  const probA = prediction.prob_a * 100;
  const probB = prediction.prob_b * 100;
  const conf = prediction.confidence ?? 0;
  const confLabel = conf >= 0.8 ? 'Élevée' : conf >= 0.5 ? 'Moyenne' : 'Faible';
  const favorite = probA >= 50 ? prediction.player_a_name ?? prediction.player_a_id : prediction.player_b_name ?? prediction.player_b_id;

  return (
    <div className="card" style={{ padding: 'var(--padding-card)' }}>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        margin: '0 0 var(--space-md)',
      }}>
        Prédiction
      </h2>

      {/* Barre de probabilité */}
      <div style={{
        height: 8,
        borderRadius: 4,
        background: 'var(--color-bg-secondary)',
        overflow: 'hidden',
        marginBottom: 'var(--space-md)',
      }}>
        <div style={{
          width: `${probA}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--color-accent-blue), var(--color-accent-green))',
          borderRadius: 4,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Labels A / B */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <div>
          <button
            onClick={() => onPlayerClick?.(prediction.player_a_name ?? prediction.player_a_id)}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--color-text-primary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'inline',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          >
            {prediction.player_a_name ?? prediction.player_a_id}
          </button>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 28,
            color: 'var(--color-accent-green)',
          }}>
            {probA.toFixed(1)}%
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={() => onPlayerClick?.(prediction.player_b_name ?? prediction.player_b_id)}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--color-text-primary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'right',
              display: 'inline',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          >
            {prediction.player_b_name ?? prediction.player_b_id}
          </button>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 28,
            color: 'var(--color-live)',
          }}>
            {probB.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Recommandation + confiance */}
      <div style={{
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recommandation
          </span>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--color-accent-green)',
            marginTop: 2,
          }}>
            💰 {favorite}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Confiance
          </span>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 18,
            color: conf >= 0.8 ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
            marginTop: 2,
          }}>
            {confLabel} ({(conf * 100).toFixed(0)}%)
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-sm)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
        Modèle: {prediction.model_version} | {new Date(prediction.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
