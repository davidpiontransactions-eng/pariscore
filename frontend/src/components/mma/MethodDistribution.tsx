interface Props {
  koRate: number;
  subRate: number;
  decRate: number;
}

export default function MethodDistribution({ koRate, subRate, decRate }: Props) {
  const total = koRate + subRate + decRate;
  if (total === 0) return null;

  const koPct = (koRate / total) * 100;
  const subPct = (subRate / total) * 100;
  const decPct = (decRate / total) * 100;

  return (
    <div>
      <div style={{
        display: 'flex',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        background: 'var(--color-bg-secondary)',
      }}>
        {koPct > 0 && (
          <div style={{
            width: `${koPct}%`,
            background: 'var(--color-mma-ko)',
            transition: 'width 0.4s ease',
          }} title={`KO/TKO: ${koPct.toFixed(0)}%`} />
        )}
        {subPct > 0 && (
          <div style={{
            width: `${subPct}%`,
            background: 'var(--color-mma-sub)',
            transition: 'width 0.4s ease',
          }} title={`Submission: ${subPct.toFixed(0)}%`} />
        )}
        {decPct > 0 && (
          <div style={{
            width: `${decPct}%`,
            background: 'var(--color-mma-dec)',
            transition: 'width 0.4s ease',
          }} title={`Decision: ${decPct.toFixed(0)}%`} />
        )}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 4,
        fontSize: 10,
        color: 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-body)',
      }}>
        <span>🔴 KO {koPct.toFixed(0)}%</span>
        <span>🟣 Sub {subPct.toFixed(0)}%</span>
        <span>🔵 Dec {decPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
