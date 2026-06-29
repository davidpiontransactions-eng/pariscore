import type { FighterStyle } from '../../types/ufc';

const STYLE_META: Record<FighterStyle, { label: string; color: string; icon: string }> = {
  striker:    { label: 'Striker',    color: 'var(--color-mma-striking)',   icon: '👊' },
  grappler:   { label: 'Grappler',   color: 'var(--color-mma-grappling)',  icon: '🤼' },
  brawler:    { label: 'Brawler',    color: 'var(--color-mma-brawler)',    icon: '🔥' },
  all_rounder:{ label: 'All-Rounder',color: 'var(--color-mma-allrounder)', icon: '⭐' },
};

interface Props {
  styleA: FighterStyle;
  styleB: FighterStyle;
}

export default function StyleMatchupBadge({ styleA, styleB }: Props) {
  const a = STYLE_META[styleA];
  const b = STYLE_META[styleB];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      padding: '4px 12px',
      background: 'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--color-border)',
    }}>
      <span style={{ fontSize: 13, color: a.color, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
        {a.icon} {a.label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>vs</span>
      <span style={{ fontSize: 13, color: b.color, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
        {b.icon} {b.label}
      </span>
    </div>
  );
}
