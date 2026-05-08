import { TopBar } from '@/components/TopBar';
import type { GameState } from '@/types/game';

interface Props { state: GameState; onBack: () => void; }

export function NavWaitScreen({ state, onBack }: Props) {
  const ps = Object.entries(state.latestPlayers || {});
  const navs = ps.filter(([, p]: [string, any]) => p.role === 'navigator');

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <TopBar title={`Game ${state.gameCode}`} onBack={onBack} />

      <div className="flex-1 flex flex-col items-center justify-center px-8" style={{ animation: 'fade-up 0.3s var(--spring)' }}>
        {/* Animated radar */}
        <div style={{ position: 'relative', width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ position: 'absolute', borderRadius: '50%', border: '1.5px solid var(--blue)', opacity: 0.25, animation: 'radar-expand 2.4s ease-out infinite', width: 34, height: 34 }} />
          <div style={{ position: 'absolute', borderRadius: '50%', border: '1.5px solid var(--blue)', opacity: 0.25, animation: 'radar-expand 2.4s ease-out infinite 0.65s', width: 60, height: 60 }} />
          <div style={{ position: 'absolute', borderRadius: '50%', border: '1.5px solid var(--blue)', opacity: 0.25, animation: 'radar-expand 2.4s ease-out infinite 1.3s', width: 88, height: 88 }} />
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px var(--blue)', opacity: 0.45, zIndex: 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--bg-elevated)" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
        </div>

        <div className="t-title3">{state.myName}</div>
        <p className="t-footnote mt-2" style={{ color: 'var(--text-secondary)' }}>Waiting for host to start...</p>

        {/* Role pill */}
        <div className="glass" style={{ marginTop: 12, fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' as const, padding: '5px 16px', borderRadius: 20, color: 'var(--blue)' }}>
          Navigator
        </div>

        {/* Player list */}
        {navs.length > 0 && (
          <div style={{ marginTop: 20, width: '100%', maxWidth: 280 }}>
            <div className="t-caption" style={{ textAlign: 'center', marginBottom: 6 }}>{navs.length} player{navs.length > 1 ? 's' : ''} joined</div>
            {navs.map(([id, p]: [string, any]) => (
              <div key={id} className="glass" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: 10, boxShadow: 'var(--e1)', marginBottom: 5 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', marginRight: 10, flexShrink: 0 }}>{p.name.charAt(0).toUpperCase()}</span>
                <span className="t-body">{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
