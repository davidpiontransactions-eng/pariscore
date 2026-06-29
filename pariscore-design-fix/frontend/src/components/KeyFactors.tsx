import type { KeyFactor } from '../types';

interface Props {
  factors: KeyFactor[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Service Edge': 'var(--color-cat-service)',
  'Clutch Factor': 'var(--color-cat-mental)',
  'H2H': 'var(--color-cat-global)',
  'Forme récente': 'var(--color-cat-return)',
  'Motivation': 'var(--color-cat-mental)',
  'Fatigue': 'var(--color-cat-global)',
};

function formatVal(v: number | null | undefined): string {
  if (v == null) return '—';
  if (Math.abs(v) < 1) return (v * 100).toFixed(1) + '%';
  return v.toFixed(2);
}

export default function KeyFactors({ factors }: Props) {
  if (!factors || factors.length === 0) return null;

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
        Facteurs clés
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {factors.map((f, i) => {
          const color = CATEGORY_COLORS[f.name] || 'var(--color-text-tertiary)';
          const hasBoth = f.value_A != null || f.value_B != null;
          const hasSingle = f.value != null;

          return (
            <div
              key={`${f.name}-${i}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-badge)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  display: 'inline-block',
                }} />
                <span style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 13,
                  color: 'var(--color-text-primary)',
                }}>
                  {f.name}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                {hasBoth && (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      A: <strong style={{ color: 'var(--color-accent-green)' }}>{formatVal(f.value_A)}</strong>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      B: <strong style={{ color: 'var(--color-live)' }}>{formatVal(f.value_B)}</strong>
                    </span>
                  </>
                )}
                {hasSingle && (
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--color-text-primary)',
                  }}>
                    {formatVal(f.value)}
                  </span>
                )}
                <div style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: 11,
                  color: 'var(--color-text-tertiary)',
                  minWidth: 32,
                  textAlign: 'right',
                }}>
                  P{(f.weight * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
