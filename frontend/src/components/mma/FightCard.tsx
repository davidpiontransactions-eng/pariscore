import type { UFCMatchFeatures, UFCPrediction } from '../../types/ufc';
import StanceBadge from './StanceBadge';
import WeightClassBadge from './WeightClassBadge';
import RecordBadge from './RecordBadge';


import MethodDistribution from './MethodDistribution';

interface Props {
  fight: UFCMatchFeatures;
  prediction: UFCPrediction | null;
  loading: boolean;
  error: string | null;
  onSelect: (f: UFCMatchFeatures) => void;
  selected: boolean;
}

export default function FightCard({ fight, prediction, loading, error, onSelect, selected }: Props) {
  const prob = prediction ? prediction.prob_a * 100 : null;
  const { fighter_a: a, fighter_b: b } = fight;
  const showValue = prediction?.value_alert;

  const borderStyle = selected
    ? '2px solid var(--color-accent-blue)'
    : '1px solid var(--color-border)';
  const boxShadow = selected ? 'var(--glow-blue)' : 'none';

  return (
    <div
      onClick={() => onSelect(fight)}
      style={{
        background: 'var(--color-card)',
        border: borderStyle,
        borderRadius: 'var(--radius-card)',
        padding: 'var(--padding-card)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--color-card-hover)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--color-card)';
      }}
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(fight); }}
    >
      {/* Header event + weight */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {fight.event_name}
          {fight.is_title_fight && ' 👑'}
          {fight.is_interim && ' 🏅'}
        </span>
        <WeightClassBadge weightClass={fight.weight_class} short />
      </div>

      {/* Fighter A — name + record + stance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--color-text-primary)',
          }}>
            {a.fighter_name}
          </span>
          {a.nickname && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
              "{a.nickname}"
            </span>
          )}
          <RecordBadge record={a.record} />
          <StanceBadge stance={a.stance} />
        </div>
        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>⏳</span>
        ) : prob !== null ? (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 20,
            color: prob >= 55 ? 'var(--color-accent-green)' : prob <= 45 ? 'var(--color-danger)' : 'var(--color-text-secondary)',
          }}>
            {prob.toFixed(1)}%
          </span>
        ) : error ? (
          <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>⚠️</span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>—</span>
        )}
      </div>

      {/* Fighter B — name + record + stance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flex: 1 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--color-text-secondary)',
          }}>
            {b.fighter_name}
          </span>
          <RecordBadge record={b.record} />
          <StanceBadge stance={b.stance} />
        </div>
        {prediction && (
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
          }}>
            {(100 - prob!).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Method distribution line — utilise la meme formule que le panneau detail */}
      <MethodDistribution
        koRate={fight.weight_class_avg_finish_rate}
        subRate={fight.weight_class_avg_finish_rate * 0.35}
        decRate={1 - (fight.weight_class_avg_finish_rate * 1.35)}
      />

      {/* Value alert badge */}
      {showValue && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'rgba(0,230,118,0.1)',
          borderRadius: 'var(--radius-badge)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-accent-green)',
        }}>
          {'\u{1F4B0}'} VALUE {(showValue.ratio - 1) * 100 > 0 ? '+' : ''}{((showValue.ratio - 1) * 100).toFixed(0)}%
          {showValue.recommendation === 'bet_a' && (' \u2192 ' + a.fighter_name)}
          {showValue.recommendation === 'bet_b' && (' \u2192 ' + b.fighter_name)}
        </div>
      )}
    </div>
  );
}