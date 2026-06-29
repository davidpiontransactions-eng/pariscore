import { useState, useEffect, useCallback } from 'react';
import type { UFCMatchFeatures, UFCPrediction, UFCKeyFactor } from '../types/ufc';
import { checkHealth, predictUFCMatch } from '../api/pariscore';
import { SAMPLE_FIGHTS } from '../data/sampleFights';
import FightCard from '../components/mma/FightCard';
import StanceBadge from '../components/mma/StanceBadge';
import RecordBadge from '../components/mma/RecordBadge';
import WeightClassBadge from '../components/mma/WeightClassBadge';
import StyleMatchupBadge from '../components/mma/StyleMatchupBadge';
import MethodDistribution from '../components/mma/MethodDistribution';
import ValueAlertBanner from '../components/mma/ValueAlertBanner';

// --- Facteurs cles mock (fallback quand l API UFC n est pas disponible) ---

function mockKeyFactors(fight: UFCMatchFeatures): UFCKeyFactor[] {
  const { fighter_a: a, fighter_b: b } = fight;
  const factors: UFCKeyFactor[] = [];

  if (a.true_talent_rating != null) {
    factors.push({
      label: 'True Talent Rating',
      fighter_a_value: a.true_talent_rating.toFixed(2),
      fighter_b_value: b.true_talent_rating.toFixed(2),
      advantage: a.true_talent_rating > b.true_talent_rating ? 'a' : 'b',
      weight: 0.30,
      icon: '\u{1F4CA}',
    });
  }

  if (a.opponent_strength_sos != null) {
    factors.push({
      label: 'Strength of Opposition',
      fighter_a_value: a.opponent_strength_sos.toFixed(2),
      fighter_b_value: b.opponent_strength_sos.toFixed(2),
      advantage: a.opponent_strength_sos > b.opponent_strength_sos ? 'a' : 'b',
      weight: 0.15,
      icon: '\u{1F4C8}',
    });
  }

  factors.push({
    label: 'Striking (S)',
    fighter_a_value: a.ewma_sig_str_landed_S.toFixed(2),
    fighter_b_value: b.ewma_sig_str_landed_S.toFixed(2),
    advantage: a.ewma_sig_str_landed_S > b.ewma_sig_str_landed_S ? 'a' : 'b',
    weight: 0.20,
    icon: '\u{1F44A}',
  });

  if (a.ewma_td_avg_S != null && b.ewma_td_defense_S != null) {
    const tdDiff = a.ewma_td_avg_S - b.ewma_td_defense_S;
    factors.push({
      label: 'Takedown Edge',
      fighter_a_value: `${a.ewma_td_avg_S.toFixed(2)}/15min`,
      fighter_b_value: `def ${(b.ewma_td_defense_S * 100).toFixed(0)}%`,
      advantage: tdDiff > 0 ? 'a' : 'b',
      weight: 0.15,
      icon: '\u{1F93C}',
    });
  }

  if (a.reach_cm != null && b.reach_cm != null) {
    const reachDiff = a.reach_cm - b.reach_cm;
    factors.push({
      label: 'Reach',
      fighter_a_value: `${a.reach_cm} cm`,
      fighter_b_value: `${b.reach_cm} cm`,
      advantage: reachDiff > 0 ? 'a' : 'b',
      weight: 0.10,
      icon: '\u{1F4CF}',
    });
  }

  const daysDiff = (b.days_since_last_fight || 30) - (a.days_since_last_fight || 30);
  factors.push({
    label: 'Rest Days',
    fighter_a_value: `${a.days_since_last_fight}j`,
    fighter_b_value: `${b.days_since_last_fight}j`,
    advantage: daysDiff > 0 ? 'a' : 'b',
    weight: 0.10,
    icon: '\u23F1\uFE0F',
  });

  return factors;
}

function simulateUFCPrediction(fight: UFCMatchFeatures): UFCPrediction {
  const { fighter_a: a, fighter_b: b } = fight;
  const tt = (a.true_talent_rating ?? 0) - (b.true_talent_rating ?? 0);
  const striking = (a.ewma_sig_str_landed_S ?? 0) - (b.ewma_sig_str_landed_S ?? 0);
  const td = ((a.ewma_td_avg_S ?? 0) - (b.ewma_td_defense_S ?? 0) * 3);
  const reach = ((a.reach_cm ?? 170) - (b.reach_cm ?? 170)) / 10;
  const sos = ((a.opponent_strength_sos ?? 0) - (b.opponent_strength_sos ?? 0)) * 2;

  const rawScore = tt * 0.40 + striking * 0.15 + td * 0.20 + reach * 0.10 + sos * 0.15;
  const probA = Math.min(0.95, Math.max(0.05, 0.50 + rawScore * 0.08));
  const confidence = Math.min(0.95, Math.abs(probA - 0.50) * 2 + 0.10);

  const marketProbA = 1 / fight.opening_odds_a;
  const marketProbB = 1 / fight.opening_odds_b;
  const ratioA = probA / marketProbA;
  const ratioB = (1 - probA) / marketProbB;

  let recommendation: 'bet_a' | 'bet_b' | 'no_bet' = 'no_bet';
  if (ratioA > 1.12) recommendation = 'bet_a';
  else if (ratioB > 1.12) recommendation = 'bet_b';

  const kellyCalc = (p: number, odds: number) =>
    Math.round(Math.max(0, ((p * odds - 1) / (odds - 1)) * 0.25) * 10000) / 10000;

  return {
    fight_id: fight.fight_id,
    fighter_a_id: a.fighter_id,
    fighter_b_id: b.fighter_id,
    fighter_a_name: a.fighter_name,
    fighter_b_name: b.fighter_name,
    weight_class: fight.weight_class,
    is_title_fight: fight.is_title_fight,
    prob_a: Math.round(probA * 10000) / 10000,
    prob_b: Math.round((1 - probA) * 10000) / 10000,
    confidence: Math.round(confidence * 10000) / 10000,
    key_factors: mockKeyFactors(fight),
    value_alert: recommendation !== 'no_bet' ? {
      market_prob: recommendation === 'bet_a' ? Math.round(marketProbA * 10000) / 10000 : Math.round(marketProbB * 10000) / 10000,
      model_prob: recommendation === 'bet_a' ? Math.round(probA * 10000) / 10000 : Math.round((1 - probA) * 10000) / 10000,
      ratio: Math.round((recommendation === 'bet_a' ? ratioA : ratioB) * 1000) / 1000,
      kelly_fraction: kellyCalc(recommendation === 'bet_a' ? probA : (1 - probA), recommendation === 'bet_a' ? fight.opening_odds_a : fight.opening_odds_b),
      expected_value: Math.round(((recommendation === 'bet_a' ? ratioA : ratioB) - 1) * 10000) / 10000,
      recommendation,
    } : undefined,
    model_version: 'pariscore-ufc-v1.0-sim',
    timestamp: new Date().toISOString(),
  };
}

// --- Page principale ---

export default function MMAPreMatch() {
  const [selected, setSelected] = useState<UFCMatchFeatures>(SAMPLE_FIGHTS[0]);
  const [selectedPrediction, setSelectedPrediction] = useState<UFCPrediction | null>(null);
  const [allPredictions, setAllPredictions] = useState<Record<string, UFCPrediction>>({});
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const { fighter_a: a, fighter_b: b } = selected;

  useEffect(() => {
    checkHealth()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'));
  }, []);

  // Prediction pour un combat donne (API ou fallback)
  const predictOne = useCallback(async (fight: UFCMatchFeatures): Promise<UFCPrediction> => {
    if (apiStatus === 'offline') {
      await new Promise((r) => setTimeout(r, 100));
      return simulateUFCPrediction(fight);
    }
    try {
      return await predictUFCMatch(fight);
    } catch {
      return simulateUFCPrediction(fight);
    }
  }, [apiStatus]);

  // Prechargement de tous les combats au montage
  useEffect(() => {
    if (apiStatus === 'checking') return;
    setLoadingAll(true);
    Promise.all(
      SAMPLE_FIGHTS.map((f) =>
        predictOne(f).then((p) => ({ fight_id: f.fight_id, prediction: p } as const))
      )
    ).then((results) => {
      const map: Record<string, UFCPrediction> = {};
      for (const r of results) {
        map[r.fight_id] = r.prediction;
      }
      setAllPredictions(map);
      setSelectedPrediction(map[SAMPLE_FIGHTS[0].fight_id]);
      setLoadingAll(false);
    });
  }, [apiStatus, predictOne]);

  // Changement de combat selectionne
  const handleSelect = useCallback((fight: UFCMatchFeatures) => {
    setSelected(fight);
    setSelectedPrediction(allPredictions[fight.fight_id] ?? null);
  }, [allPredictions]);

  return (
    <div>
      {apiStatus === 'offline' && (
        <div style={{
          background: 'rgba(148,163,184,0.08)',
          border: '1px solid var(--color-border-medium)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-sm) var(--space-md)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          color: 'var(--color-text-tertiary)',
          fontSize: 12,
        }}>
          🧪 Simulation mode - UFC API unavailable
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--space-lg)' }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 14, color: 'var(--color-text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
            marginBottom: 'var(--space-md)',
          }}>
            🥊 Today's Fights
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {SAMPLE_FIGHTS.map((f) => {
              const pred = allPredictions[f.fight_id] ?? null;
              return (
                <FightCard
                  key={f.fight_id}
                  fight={f}
                  prediction={pred}
                  loading={loadingAll && !pred}
                  error={null}
                  onSelect={handleSelect}
                  selected={selected.fight_id === f.fight_id}
                />
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {loadingAll && (
            <div className="card" style={{
              textAlign: 'center', padding: 'var(--space-2xl)',
              background: 'var(--color-card)', borderRadius: 'var(--radius-card)',
            }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Calculating predictions...</span>
            </div>
          )}

          {!loadingAll && selectedPrediction && (
            <>
              <div style={{
                background: 'var(--color-card)', borderRadius: 'var(--radius-card)',
                padding: 'var(--padding-card)', border: '1px solid var(--color-border)',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 'var(--space-md)',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: 16, color: 'var(--color-text-primary)',
                    }}>
                      {selected.event_name}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-body)', fontSize: 12,
                      color: 'var(--color-text-tertiary)', marginTop: 2,
                    }}>
                      {/* TODO: use i18n locale instead of hardcoded 'en-US' */}
                      {new Date(selected.event_date).toLocaleDateString('en-US', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </div>
                  </div>
                  <WeightClassBadge weightClass={selected.weight_class} />
                </div>

                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <StyleMatchupBadge styleA={a.fighter_style} styleB={b.fighter_style} />
                </div>

                {/* Barre proba */}
                <div style={{
                  height: 10, borderRadius: 5,
                  background: 'var(--color-bg-secondary)',
                  overflow: 'hidden', marginBottom: 'var(--space-md)',
                  position: 'relative',
                }}>
                  <div style={{
                    width: `${selectedPrediction.prob_a * 100}%`, height: '100%',
                    background: selectedPrediction.prob_a >= 0.55
                      ? 'linear-gradient(90deg, var(--color-accent-green), var(--color-accent-blue))'
                      : 'linear-gradient(90deg, var(--color-live), var(--color-danger))',
                    borderRadius: 5, transition: 'width 0.6s ease',
                  }} />
                  <div style={{
                    position: 'absolute', left: '50%', top: 0, bottom: 0,
                    width: 1, background: 'rgba(255,255,255,0.15)',
                  }} />
                </div>

                {/* A / VS / B */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                  gap: 'var(--space-md)', marginBottom: 'var(--space-lg)',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                      color: selectedPrediction.prob_a >= 0.55 ? 'var(--color-accent-green)' : 'var(--color-text-primary)',
                    }}>
                      {a.fighter_name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      <RecordBadge record={a.record} size="md" />
                      <StanceBadge stance={a.stance} size="md" />
                    </div>
                    {a.nickname && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic', marginTop: 2 }}>
                        "{a.nickname}"
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--color-text-primary)', lineHeight: 1 }}>
                      {(selectedPrediction.prob_a * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>
                      vs
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
                      color: 'var(--color-text-secondary)', lineHeight: 1, marginTop: 4,
                    }}>
                      {((1 - selectedPrediction.prob_a) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                      color: selectedPrediction.prob_a < 0.5 ? 'var(--color-accent-green)' : 'var(--color-text-primary)',
                    }}>
                      {b.fighter_name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
                      <RecordBadge record={b.record} size="md" />
                      <StanceBadge stance={b.stance} size="md" />
                    </div>
                    {b.nickname && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic', marginTop: 2 }}>
                        "{b.nickname}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Confiance + cotes */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-card)',
                  padding: 'var(--space-md)',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Confidence
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                      color: selectedPrediction.confidence >= 0.8 ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
                      marginTop: 2,
                    }}>
                      {selectedPrediction.confidence >= 0.8 ? 'High' : selectedPrediction.confidence >= 0.5 ? 'Medium' : 'Low'} ({(selectedPrediction.confidence * 100).toFixed(0)}%)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Opening Odds
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15,
                      color: 'var(--color-text-primary)', marginTop: 2,
                    }}>
                      {selected.opening_odds_a.toFixed(2)} / {selected.opening_odds_b.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Value Alert */}
              {selectedPrediction.value_alert && (
                <ValueAlertBanner
                  alert={selectedPrediction.value_alert}
                  fighterAName={a.fighter_name}
                  fighterBName={b.fighter_name}
                />
              )}

              {/* Methode de fin */}
              <div style={{
                background: 'var(--color-card)', borderRadius: 'var(--radius-card)',
                padding: 'var(--padding-card)', border: '1px solid var(--color-border)',
              }}>
                <h3 style={{
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12,
                  color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
                  letterSpacing: '0.5px', margin: '0 0 var(--space-sm)',
                }}>
                  Estimated Finish Method
                </h3>
                <MethodDistribution
                  koRate={selected.weight_class_avg_finish_rate}
                  subRate={selected.weight_class_avg_finish_rate * 0.35}
                  decRate={1 - (selected.weight_class_avg_finish_rate * 1.35)}
                />
              </div>

              {/* Facteurs cles */}
              <div style={{
                background: 'var(--color-card)', borderRadius: 'var(--radius-card)',
                padding: 'var(--padding-card)', border: '1px solid var(--color-border)',
              }}>
                <h3 style={{
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12,
                  color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
                  letterSpacing: '0.5px', margin: '0 0 var(--space-md)',
                }}>
                   Key Factors
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {selectedPrediction.key_factors.map((f, i) => (
                    <KeyFactorRow key={`${f.label}-${i}`} factor={f} />
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                Model: {selectedPrediction.model_version}
                {' · '}
                {new Date(selectedPrediction.timestamp).toLocaleTimeString('en-US')}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KeyFactorRow({ factor }: { factor: UFCKeyFactor }) {
  const isAAdvantage = factor.advantage === 'a';
  const isBAdvantage = factor.advantage === 'b';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--space-sm) var(--space-md)',
      background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-badge)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <span style={{ fontSize: 14 }}>{factor.icon}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary)' }}>
          {factor.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
        <span style={{
          fontSize: 12,
          fontWeight: isAAdvantage ? 700 : 400,
          color: isAAdvantage ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
        }}>
          {factor.fighter_a_value}
        </span>
        {factor.advantage !== 'neutral' && (
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            {isAAdvantage ? '\u25B2' : isBAdvantage ? '\u25BC' : '\u2014'}
          </span>
        )}
        <span style={{
          fontSize: 12,
          fontWeight: isBAdvantage ? 700 : 400,
          color: isBAdvantage ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
        }}>
          {factor.fighter_b_value}
        </span>
        <div style={{
          fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11,
          color: 'var(--color-text-tertiary)', minWidth: 32, textAlign: 'right',
        }}>
          W{(factor.weight * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}