interface Props {
  record: string;
  size?: 'sm' | 'md';
}

export default function RecordBadge({ record, size = 'sm' }: Props) {
  const parts = record.split('-').map(Number);
  const wins = parts[0] || 0;
  const losses = parts[1] || 0;
  const draws = parts[2] || 0;
  const total = wins + losses + draws;
  const winPct = total > 0 ? (wins / total) * 100 : 0;
  const fontSize = size === 'md' ? 14 : 12;

  return (
    <span style={{
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize,
      color: winPct >= 80 ? 'var(--color-accent-green)' : winPct >= 50 ? 'var(--color-text-primary)' : 'var(--color-danger)',
      whiteSpace: 'nowrap',
    }}>
      {record}
    </span>
  );
}
