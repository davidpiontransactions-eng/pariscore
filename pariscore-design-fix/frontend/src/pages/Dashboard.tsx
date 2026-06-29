import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import {
  TrendingUp, Wallet, Target, Activity,
} from 'lucide-react';
import type { StrategyResult, ModelMetrics } from '../types/dashboard';
import { simulateStrategy } from '../api/pariscore';

/* ── Données de démonstration ── */

const DEMO_METRICS: ModelMetrics = {
  accuracy: 0.684,
  auc: 0.741,
  brier: 0.218,
  feature_importance: [
    ['serve_edge_A', 0.185],
    ['srv_pts_won_S_DIFF', 0.142],
    ['clutch_A', 0.118],
    ['h2h_context_score', 0.096],
    ['srv_pts_won_S_A', 0.087],
    ['ret_pts_won_S_DIFF', 0.076],
    ['motivation_A', 0.065],
    ['age_30_A', 0.058],
    ['public_advantage', 0.052],
    ['fatigue_A', 0.047],
  ],
  n_matches: 12595,
  model_version: 'pariscore-v1.0',
};

const DEMO_BANKROLL_HISTORY = Array.from({ length: 50 }, (_, i) => ({
  step: i + 1,
  bankroll: 10000 + Math.round(
    5000 * Math.sin(i / 8) + i * 80 - (i > 30 ? (i - 30) * 60 : 0)
  ),
}));

function formatPct(v: number): string { return (v * 100).toFixed(1) + '%'; }

function formatCurrency(v: number): string {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ── Stratégies ── */

const STRATEGIES = [
  { value: 'value_betting', label: 'Value Betting', desc: 'Parier quand proba modèle > proba marché' },
  { value: 'favori_modere', label: 'Moderate Favorite', desc: 'Bet on favorite only with high confidence' },
  { value: 'contrarien', label: 'Contrarian', desc: 'Bet against the favorite (fade the public)' },
  { value: 'kelly_criterion', label: 'Kelly Criterion', desc: 'Optimal bet sizing' },
];

/* ── Statistique descriptive ── */

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-card)',
      padding: 'var(--space-md)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
        color: color ?? 'var(--color-text-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}

/* ── Page Dashboard ── */

export default function Dashboard() {
  const [strategy, setStrategy] = useState('value_betting');
  const [threshold, setThreshold] = useState(1.10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategyResult | null>(null);

  useEffect(() => {
    if (result) return;
    runBacktest();
  }, []);

  async function runBacktest() {
    setLoading(true);
    try {
      const res = await simulateStrategy({ strategy, threshold, bankroll: 10000 });
      setResult(res);
    } catch {
      // Use demo data if API unavailable
      setResult({
        strategy,
        bankroll_initial: 10000,
        bankroll_final: 14820,
        roi_percent: 48.2,
        sharpe_ratio: 1.24,
        max_drawdown_percent: -8.5,
        total_bets: 342,
        win_rate: 0.587,
        avg_odds: 2.15,
        bankroll_history: DEMO_BANKROLL_HISTORY.map(b => b.bankroll),
        bet_history: [],
        status: 'demo_data',
      });
    } finally {
      setLoading(false);
    }
  }

  const bankrollChartData = useMemo(() => {
    const history = result?.bankroll_history ?? DEMO_BANKROLL_HISTORY.map(b => b.bankroll);
    return history.map((v, i) => ({ step: i + 1, bankroll: v }));
  }, [result]);

  const featureChartData = useMemo(() =>
    DEMO_METRICS.feature_importance.map(([name, importance]) => ({
      name: name.replace(/_/g, ' '),
      importance: +(importance * 100).toFixed(1),
    })).reverse(),
  []);

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
          color: 'var(--color-text-primary)', margin: 0,
        }}>
          📊 Dashboard
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          Model Performance & Metrics — {DEMO_METRICS.model_version}
        </p>
      </div>

      {/* Rangée 1: Métriques du modèle */}
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
        color: 'var(--color-text-secondary)', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: 'var(--space-md)',
      }}>Model</h2>
      <div className="dashboard-kpi-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)',
        marginBottom: 'var(--space-xl)',
      }}>
        <StatBox label="Accuracy" value={formatPct(DEMO_METRICS.accuracy)} color="var(--color-accent-green)" />
        <StatBox label="AUC-ROC" value={formatPct(DEMO_METRICS.auc)} color="var(--color-accent-blue)" />
        <StatBox label="Brier Score" value={DEMO_METRICS.brier.toFixed(3)} color="var(--color-live)" />
        <StatBox label="Matches" value={DEMO_METRICS.n_matches.toLocaleString()} />
      </div>

      {/* Feature importance chart */}
      <div className="card" style={{ padding: 'var(--padding-card)', marginBottom: 'var(--space-xl)' }}>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
          color: 'var(--color-text-secondary)', textTransform: 'uppercase',
          letterSpacing: '0.5px', margin: '0 0 var(--space-md)',
        }}>
          <Activity size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Feature Importance
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={featureChartData} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis type="number" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} width={110} />
            <Tooltip
              contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border-medium)', borderRadius: 6, fontSize: 12 }}
              formatter={(value) => [Number(value).toFixed(1) + '%', 'Importance (%)']}
            />
            <Bar dataKey="importance" fill="var(--color-accent-blue)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stratégie */}
      <h2 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
        color: 'var(--color-text-secondary)', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: 'var(--space-md)',
      }}>
        <Wallet size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        Backtesting
      </h2>

      {/* Contrôles */}
      <div className="card" style={{
        padding: 'var(--space-md)', marginBottom: 'var(--space-lg)',
        display: 'flex', gap: 'var(--space-md)', alignItems: 'end', flexWrap: 'wrap',
      }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
            Strategy
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            style={{
              background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-btn)',
              padding: '6px 12px', fontFamily: 'var(--font-body)', fontSize: 13,
            }}
          >
            {STRATEGIES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {STRATEGIES.find(s => s.value === strategy)?.desc}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
            Threshold ({threshold.toFixed(2)})
          </label>
          <input
            type="range" min={1.0} max={2.0} step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(+e.target.value)}
            style={{ width: 120 }}
          />
        </div>
        <button
          onClick={runBacktest}
          disabled={loading}
          style={{
            background: 'var(--color-accent-blue)', color: 'var(--color-text-primary)',
            border: 'none', borderRadius: 'var(--radius-btn)',
            padding: '8px 20px', fontFamily: 'var(--font-display)',
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '⏳ Calculating...' : '▶ Run Backtest'}
        </button>
      </div>

      {/* Résultats */}
      {result && (
        <>
          <div className="dashboard-secondary-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-md)', marginBottom: 'var(--space-xl)',
          }}>
            <StatBox label="ROI" value={result.roi_percent.toFixed(1) + '%'}
              color={result.roi_percent > 0 ? 'var(--color-accent-green)' : 'var(--color-danger)'} />
            <StatBox label="Sharpe" value={result.sharpe_ratio.toFixed(2)}
              color={result.sharpe_ratio > 1 ? 'var(--color-accent-green)' : 'var(--color-text-secondary)'} />
            <StatBox label="Max Drawdown" value={result.max_drawdown_percent.toFixed(1) + '%'}
              color="var(--color-danger)" />
            <StatBox label="Paris" value={result.total_bets.toString()} />
            <StatBox label="Win Rate" value={formatPct(result.win_rate)}
              color="var(--color-accent-green)" />
            <StatBox label="Avg Odds" value={result.avg_odds.toFixed(2)} />
            <StatBox label="Bankroll" value={formatCurrency(result.bankroll_final)}
              color={result.bankroll_final > result.bankroll_initial ? 'var(--color-accent-green)' : 'var(--color-danger)'} />
            <StatBox label="Status" value={result.status === 'ok' ? 'Live' : 'Demo'}
              color={result.status === 'ok' ? 'var(--color-accent-green)' : 'var(--color-live)'} />
          </div>

          {/* Bankroll chart */}
          <div className="card" style={{ padding: 'var(--padding-card)', marginBottom: 'var(--space-xl)' }}>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              color: 'var(--color-text-secondary)', textTransform: 'uppercase',
              letterSpacing: '0.5px', margin: '0 0 var(--space-md)',
            }}>
              <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Bankroll Evolution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={bankrollChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="step" tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
                  tickFormatter={(v: number) => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border-medium)', borderRadius: 6, fontSize: 12 }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Bankroll']}
                />
                <Line type="monotone" dataKey="bankroll" stroke="var(--color-accent-green)"
                  strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Historique des paris */}
      {result && result.bet_history.length > 0 && (
        <div className="card" style={{ padding: 'var(--padding-card)' }}>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            color: 'var(--color-text-secondary)', textTransform: 'uppercase',
            letterSpacing: '0.5px', margin: '0 0 var(--space-md)',
          }}>
            <Target size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Recent Bets
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.5px' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>Match</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Prob</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Odds</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Stake</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>Result</th>
                <th style={{ textAlign: 'right', padding: '4px 8px' }}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {result.bet_history.slice(-20).reverse().map((bet, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>{bet.match_id}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{(bet.prob * 100).toFixed(0)}%</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{bet.odds.toFixed(2)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{bet.stake.toFixed(2)}€</td>
                  <td style={{
                    padding: '6px 8px', textAlign: 'right',
                    color: bet.result === 'win' ? 'var(--color-accent-green)' : 'var(--color-danger)',
                  }}>
                    {bet.result === 'win' ? '✅' : '❌'}
                  </td>
                  <td style={{
                    padding: '6px 8px', textAlign: 'right', fontWeight: 600,
                    color: bet.pnl >= 0 ? 'var(--color-accent-green)' : 'var(--color-danger)',
                  }}>
                    {bet.pnl >= 0 ? '+' : ''}{bet.pnl.toFixed(2)}€
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
