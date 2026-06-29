import type { WeightClass } from '../../types/ufc';

const WC_LABELS: Record<WeightClass, string> = {
  strawweight:      'Strawweight',
  flyweight:        'Flyweight',
  bantamweight:     'Bantamweight',
  featherweight:    'Featherweight',
  lightweight:      'Lightweight',
  welterweight:     'Welterweight',
  middleweight:     'Middleweight',
  light_heavyweight:'Light Heavyweight',
  heavyweight:      'Heavyweight',
};

const WC_LIMITS: Record<WeightClass, string> = {
  strawweight:      '115',
  flyweight:        '125',
  bantamweight:     '135',
  featherweight:    '145',
  lightweight:      '155',
  welterweight:     '170',
  middleweight:     '185',
  light_heavyweight:'205',
  heavyweight:      '265',
};

interface Props {
  weightClass: WeightClass;
  short?: boolean;
}

export default function WeightClassBadge({ weightClass, short = false }: Props) {
  const label = short ? WC_LIMITS[weightClass] || weightClass : WC_LABELS[weightClass] || weightClass;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      background: 'rgba(148,163,184,0.1)',
      color: 'var(--color-text-secondary)',
      fontSize: 11,
      fontWeight: 500,
      fontFamily: 'var(--font-body)',
      borderRadius: 'var(--radius-badge)',
      border: '1px solid rgba(148,163,184,0.2)',
    }}>
      ⚖️ {label}
    </span>
  );
}
