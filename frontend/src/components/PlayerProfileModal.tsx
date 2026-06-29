import { useEffect, useRef } from 'react';
import type { PlayerProfileData } from '../types';

interface Props {
  player: PlayerProfileData | null;
  onClose: () => void;
}

/* ── Mini barre de progression ── */
function StatBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-secondary)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color ?? 'var(--color-accent-green)', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export default function PlayerProfileModal({ player, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /* Fermeture par Escape */
  useEffect(() => {
    if (!player) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [player, onClose]);

  /* Fermeture par clic sur l'overlay */
  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!player) return null;

  const { career } = player;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-lg)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'var(--space-xl)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* ── Bouton fermer ── */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-secondary)',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* ── Photo + Identité ── */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            margin: '0 auto var(--space-md)',
            border: '3px solid var(--color-accent-green)',
            overflow: 'hidden',
            background: 'var(--color-bg-secondary)',
          }}>
            <img
              src={player.photoUrl}
              alt={player.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 22,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            {player.name}
          </h1>
          <div style={{ marginTop: 4, fontSize: 14, color: 'var(--color-text-secondary)' }}>
            <span style={{ marginRight: 8 }}>{player.country} ({player.countryCode})</span>
            <span style={{
              display: 'inline-block',
              background: 'var(--color-bg-secondary)',
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
            }}>
              #{player.rank}
            </span>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              Peak: #{player.peakRank} ({player.peakRankDate})
            </span>
          </div>
        </div>

        {/* ── Infos générales ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-sm)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          fontSize: 13,
        }}>
          <div><span className="text-tertiary">Âge</span><br /><span style={{ fontWeight: 600 }}>{player.age} ans</span></div>
          <div><span className="text-tertiary">Taille</span><br /><span style={{ fontWeight: 600 }}>{player.height} cm</span></div>
          <div><span className="text-tertiary">Poids</span><br /><span style={{ fontWeight: 600 }}>{player.weight} kg</span></div>
          <div><span className="text-tertiary">Main</span><br /><span style={{ fontWeight: 600 }}>{player.hand}</span></div>
          <div><span className="text-tertiary">Revers</span><br /><span style={{ fontWeight: 600 }}>{player.backhand}</span></div>
          <div><span className="text-tertiary">Pro depuis</span><br /><span style={{ fontWeight: 600 }}>{player.turnedPro}</span></div>
          <div style={{ gridColumn: 'span 2' }}>
            <span className="text-tertiary">Entraîneur</span><br />
            <span style={{ fontWeight: 600 }}>{player.coach}</span>
          </div>
        </div>

        {/* ── Carrière ── */}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0 0 var(--space-sm)',
        }}>
          Carrière
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-xs) var(--space-md)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          fontSize: 13,
        }}>
          <div><span className="text-tertiary">Matchs</span><br /><span style={{ fontWeight: 600 }}>{career.wins}-{career.losses} ({career.winPct}%)</span></div>
          <div><span className="text-tertiary">Titres</span><br /><span style={{ fontWeight: 600 }}>{career.titles}</span></div>
          <div><span className="text-tertiary">1<sup>re</sup> balle</span><br /><span style={{ fontWeight: 600 }}>{career.firstServeIn}%</span></div>
          <div><span className="text-tertiary">Points sur 1<sup>re</sup></span><br /><span style={{ fontWeight: 600 }}>{career.firstServeWon}%</span></div>
          <div><span className="text-tertiary">Points sur 2<sup>e</sup></span><br /><span style={{ fontWeight: 600 }}>{career.secondServeWon}%</span></div>
          <div><span className="text-tertiary">Points gagnés au service</span><br /><span style={{ fontWeight: 600 }}>{career.servePointsWon}%</span></div>
          <div><span className="text-tertiary">Points gagnés au retour</span><br /><span style={{ fontWeight: 600 }}>{career.returnPointsWon}%</span></div>
          <div><span className="text-tertiary">Break sauvés</span><br /><span style={{ fontWeight: 600 }}>{career.breakPointsSaved}%</span></div>
          <div style={{ gridColumn: 'span 2' }}>
            <span className="text-tertiary">Ratio de dominance</span><br />
            <span style={{ fontWeight: 600 }}>{career.dominanceRatio.toFixed(2)}</span>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <span className="text-tertiary">Gains en carrière</span><br />
            <span style={{ fontWeight: 600 }}>{career.prizeMoney}</span>
          </div>
        </div>

        {/* ── Surfaces ── */}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0 0 var(--space-sm)',
        }}>
          Surfaces
        </h3>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-lg)',
        }}>
          {player.surfaceSplits.map((s) => (
            <div key={s.surface} style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-sm) var(--space-md)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)' }}>
                  {s.surface}
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 16,
                  color: s.winPct >= 75 ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
                }}>
                  {s.winPct.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                {s.wins}-{s.losses} · SRV {s.servePointsWon.toFixed(1)}% · RET {s.returnPointsWon.toFixed(1)}% · DR {s.dominanceRatio.toFixed(2)}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--color-bg)', overflow: 'hidden' }}>
                <div style={{
                  width: `${s.winPct}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: s.winPct >= 75 ? 'var(--color-accent-green)' : s.winPct >= 60 ? 'var(--color-accent-blue)' : 'var(--color-live)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── EWMA (forme récente) ── */}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0 0 var(--space-sm)',
        }}>
          EWMA — forme récente
        </h3>
        <div style={{
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}>
          <StatBar label="Service (court terme)" value={player.ewma.shortTerm.srv * 100} color="var(--color-accent-blue)" />
          <StatBar label="Service (long terme)" value={player.ewma.longTerm.srv * 100} color="var(--color-accent-blue)" />
          <div style={{ height: 8 }} />
          <StatBar label="Retour (court terme)" value={player.ewma.shortTerm.ret * 100} color="var(--color-live)" />
          <StatBar label="Retour (long terme)" value={player.ewma.longTerm.ret * 100} color="var(--color-live)" />
        </div>

        {/* ── Métriques dérivées ── */}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0 0 var(--space-sm)',
        }}>
          Métriques Pariscore
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-sm)',
        }}>
          {[
            { label: 'Ratio de dominance', value: player.dominanceRatio.toFixed(2) },
            { label: 'Serve Edge', value: player.serveEdge > 0 ? `+${player.serveEdge.toFixed(2)}` : player.serveEdge.toFixed(2), color: player.serveEdge > 0 ? 'var(--color-accent-green)' : 'var(--color-live)' },
            { label: 'Clutch Factor', value: player.clutchFactor > 0 ? `+${player.clutchFactor.toFixed(2)}` : player.clutchFactor.toFixed(2), color: player.clutchFactor > 0 ? 'var(--color-accent-green)' : 'var(--color-live)' },
            { label: 'Pression Index', value: player.pressureIndex.toFixed(2) },
          ].map((m) => (
            <div key={m.label} style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-sm) var(--space-md)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{m.label}</div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: m.color ?? 'var(--color-text-primary)',
              }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
