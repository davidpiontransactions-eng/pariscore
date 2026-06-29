import type { MatchDemo, MatchPrediction } from '../types';

interface Props {
  match: MatchDemo;
  prediction: MatchPrediction | null;
  loading: boolean;
  error: string | null;
  onSelect: (m: MatchDemo) => void;
  selected: boolean;
  onPlayerClick?: (name: string) => void;
}

export default function MatchCard({ match, prediction, loading, error, onSelect, selected, onPlayerClick }: Props) {
  const prob = prediction ? prediction.prob_a * 100 : null;
  const borderStyle = selected
    ? '2px solid var(--color-accent-blue)'
    : '1px solid var(--color-border)';
  const boxShadow = selected ? 'var(--glow-blue)' : 'none';

  return (
    <div
      onClick={() => onSelect(match)}
      style={{
        background: 'var(--color-card)',
        border: borderStyle,
        borderRadius: 'var(--radius-card)',
        padding: 'var(--padding-card)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'var(--color-card-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'var(--color-card)';
        }
      }}
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(match); }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {match.tournament}
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--color-cat-global)',
        }}>
          {match.surface}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); onPlayerClick?.(match.player_a.name); }}
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
              display: 'block',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          >
            {match.player_a.name}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPlayerClick?.(match.player_b.name); }}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--color-text-secondary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'block',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent-green)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            {match.player_b.name}
          </button>
        </div>

        <div style={{ textAlign: 'right' }}>
          {loading ? (
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>⏳</span>
          ) : prob !== null ? (
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 20,
              color: prob >= 50 ? 'var(--color-accent-green)' : 'var(--color-live)',
            }}>
              {prob.toFixed(1)}%
            </span>
          ) : error ? (
            <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>⚠️</span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}
