import type { ValueAlert } from '../../types/ufc';

interface Props {
  alert: ValueAlert;
  fighterAName: string;
  fighterBName: string;
}

export default function ValueAlertBanner({ alert, fighterAName, fighterBName }: Props) {
  if (!alert || alert.recommendation === 'no_bet') return null;

  const isBetA = alert.recommendation === 'bet_a';
  const recommendedFighter = isBetA ? fighterAName : fighterBName;
  const evPercent = (alert.expected_value * 100).toFixed(1);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,230,118,0.12), rgba(0,119,255,0.08))',
      border: '1px solid rgba(0,230,118,0.25)',
      borderRadius: 'var(--radius-card)',
      padding: 'var(--space-md) var(--space-lg)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-lg)',
      flexWrap: 'wrap',
    }}>
      {/* Label principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <span style={{ fontSize: 20 }}>💰</span>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--color-accent-green)',
          }}>
            Value Bet Detected
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}>
            {recommendedFighter} — EV {evPercent}%
          </div>
        </div>
      </div>

      {/* Métriques */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-lg)',
        flex: 1,
        justifyContent: 'space-around',
      }}>
        <MetricTile label="Model/Market Ratio" value={`${(alert.ratio * 100).toFixed(0)}%`} color="var(--color-accent-green)" />
        <MetricTile label="Expected Value" value={`+${evPercent}%`} color="var(--color-accent-green)" />
        <MetricTile label="Kelly Fraction" value={`${(alert.kelly_fraction * 100).toFixed(1)}%`} color="var(--color-accent-blue)" />
        <MetricTile label="Model Probability" value={`${(alert.model_prob * 100).toFixed(0)}%`} color="var(--color-text-primary)" />
      </div>
    </div>
  );
}

function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 10,
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 16,
        color,
      }}>
        {value}
      </div>
    </div>
  );
}
