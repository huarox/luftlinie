import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { IOSSwitch } from '@/components/IOSSwitch';
import type { GameState } from '@/types/game';
import { Link2, QrCode } from 'lucide-react';

interface Props { state: GameState; onBack: () => void; onStart: () => void; onToggleExcludeHost: () => void; onShowQR: () => void; onUpdateName: (n: string) => void; }

export function HostLobbyScreen({ state, onBack, onStart, onToggleExcludeHost, onShowQR, onUpdateName }: Props) {
  const [copied, setCopied] = useState(false);
  const players = Object.entries(state.latestPlayers || {});
  const navs = players.filter(([, p]: [string, any]) => p.role === 'navigator');
  const specs = players.filter(([, p]: [string, any]) => p.role === 'spectator');
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { } };

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <TopBar title="Lobby" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-5 py-5 space-y-5">
          {/* Game Code */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--separator)', overflow: 'hidden', animation: 'scale-in 0.2s var(--spring)' }}>
            <button className="crow w-full bg-transparent border-none cursor-pointer" style={{ flexDirection: 'column', alignItems: 'center', gap: 2, padding: '16px 20px' }} onClick={() => copy(state.gameCode || '')}>
              <div className="t-caption" style={{ fontWeight: 600 }}>Game Code</div>
              <div className="t-mono" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '4px', color: 'var(--text)', marginTop: 2 }}>{copied ? 'Copied' : state.gameCode}</div>
            </button>
            <div style={{ display: 'flex', borderTop: '1px solid var(--separator)' }}>
              <button className="pill pill-ghost flex-1 pill-sm" style={{ borderRadius: 0, borderRight: '1px solid var(--separator)' }} onClick={() => copy(`${window.location.origin}${window.location.pathname}?join=${state.gameCode}`)}><Link2 size={14} /> Copy Link</button>
              <button className="pill pill-ghost flex-1 pill-sm" style={{ borderRadius: 0 }} onClick={onShowQR}><QrCode size={14} /> QR Code</button>
            </div>
          </div>

          {/* Name */}
          <section><div className="t-caption mb-2">Your Name</div><div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)' }}><input className="field" style={{ border: 'none', borderRadius: 0, background: 'transparent' }} value={state.myName} onChange={e => onUpdateName(e.target.value)} maxLength={20} /></div></section>

          {/* Players */}
          <section><div className="t-caption mb-2">Players ({navs.length})</div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)', overflow: 'hidden' }}>
              {navs.length === 0 ? <div className="crow"><span className="t-footnote">Waiting for players...</span></div> : navs.map(([id, p]: [string, any]) => (
                <div key={id} className="crow"><span className="t-body">{p.name}</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', background: 'rgba(0,122,255,0.08)', padding: '3px 10px', borderRadius: 6 }}>Navigator</span></div>
              ))}
            </div>
          </section>

          {/* Settings */}
          <section><div className="t-caption mb-2">Settings</div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)', overflow: 'hidden' }}>
              <div className="crow"><span className="t-body">Mode</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{state.settings.mode === 'smart' ? 'Smart' : 'Manual'}</span></div>
              <div className="crow"><span className="t-body">Game</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{state.settings.gameMode}</span></div>
              <div className="crow"><span className="t-body">Difficulty</span><span style={{ color: 'var(--orange)', fontSize: 14 }}>{'\u2605'.repeat(state.settings.diff)}{'\u2606'.repeat(5 - state.settings.diff)}</span></div>
              <div className="crow"><span className="t-body">Exclude host</span><IOSSwitch checked={state.settings.excludeHost} onChange={onToggleExcludeHost} /></div>
            </div>
          </section>

          {specs.length > 0 && <section><div className="t-caption mb-2">Spectators ({specs.length})</div><div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)', overflow: 'hidden' }}>{specs.map(([id, p]: [string, any]) => <div key={id} className="crow"><span className="t-body">{p.name}</span><span className="t-footnote" style={{ fontWeight: 600, color: 'var(--green)' }}>Spectator</span></div>)}</div></section>}
          <div style={{ height: 16 }} />
        </div>
      </div>
      <div className="glass" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--glass-border)', padding: '14px 20px' }}>
        <button className="pill pill-primary pill-full" onClick={onStart}>Start Game</button>
      </div>
    </div>
  );
}
