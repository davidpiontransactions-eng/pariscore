import type { Stance } from '../../types/ufc';

const STANCE_COLORS: Record<Stance, string> = {
  orthodox: 'var(--color-mma-dec)',
  southpaw: 'var(--color-mma-ko)',
  switch:   'var(--color-mma-sub)',
};

const STANCE_LABELS: Record<Stance, string> = {
  orthodox: 'Orthodox',
  southpaw: 'Southpaw',
  switch:   'Switch',
};

interface Props {
  stance: Stance;
  size?: 'sm' | 'md';
}

export default function StanceBadge({ stance, size = 'sm' }: Props) {
  const color = STANCE_COLORS[stance] || 'var(--color-text-tertiary)';
  const label = STANCE_LABELS[stance] || stance;
  const fontSize = size === 'md' ? 12 : 11;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      background: `${color}15`,
      color,
      fontSize,
      fontWeight: 600,
      fontFamily: 'var(--font-body)',
      borderRadius: 'var(--radius-badge)',
      border: `1px solid ${color}30`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
