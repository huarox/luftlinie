import { useState, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { GlassCard } from '@/components/GlassCard';
import type { GameState, Role } from '@/types/game';
import { Navigation, Eye } from 'lucide-react';
import { getDatabase, ref, get } from 'firebase/database';

interface Props { state: GameState; onBack: () => void; onJoin: (code: string, name: string, role: Role, team?: 'red' | 'blue' | null) => Promise<boolean>; }

export function JoinScreen({ state, onBack, onJoin }: Props) {
  const [code, setCode] = useState(state.gameCode || '');
  const [name, setName] = useState(state.myName || localStorage.getItem('ll_nickname') || '');
  const [role, setRole] = useState<Role>('navigator');
  const [team, setTeam] = useState<'red' | 'blue' | null>(null);
  const [busy, setBusy] = useState(false);
  const [gameTeamsMode, setGameTeamsMode] = useState(false);
  const ok = code.length >= 4 && name.trim().length > 0;

  // Fetch game settings when code changes
  useEffect(() => {
    if (code.length < 4) { setGameTeamsMode(false); return; }
    const c = code.trim().toUpperCase();
    get(ref(getDatabase(), `games/${c}`)).then(snap => {
      if (snap.exists()) setGameTeamsMode(!!snap.val().teamsMode);
    }).catch(() => {});
  }, [code]);

  const handleJoin = async () => {
    if (!ok || busy) return;
    if (gameTeamsMode && role === 'navigator' && !team) return;
    setBusy(true);
    localStorage.setItem('ll_nickname', name.trim());
    await onJoin(code.trim().toUpperCase(), name.trim(), role, team);
    setBusy(false);
  };

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <TopBar title="Join Game" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-5 py-5 space-y-5">
          <section style={{ animation: 'fade-up 0.2s var(--spring)' }}>
            <div className="t-caption mb-2">Game Code</div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)' }}>
              <input className="field t-mono" style={{ border: 'none', borderRadius: 0, background: 'transparent', fontSize: 22, letterSpacing: '3px', fontWeight: 700 }} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCD12" maxLength={8} autoCapitalize="characters" autoComplete="off" autoCorrect="off" />
            </div>
          </section>

          <section style={{ animation: 'fade-up 0.25s var(--spring)' }}>
            <div className="t-caption mb-2">Your Name</div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)' }}>
              <input className="field" style={{ border: 'none', borderRadius: 0, background: 'transparent' }} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={20} autoCapitalize="words" />
            </div>
          </section>

          <section style={{ animation: 'fade-up 0.3s var(--spring)' }}>
            <div className="t-caption mb-2">Role</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <GlassCard
                icon={Navigation}
                title="Navigator"
                desc="Race to find the secret target"
                selected={role === 'navigator'}
                onClick={() => setRole('navigator')}
              />
              <GlassCard
                icon={Eye}
                title="Spectator"
                desc="Watch the game from the map"
                selected={role === 'spectator'}
                onClick={() => setRole('spectator')}
              />
            </div>
          </section>

          {gameTeamsMode && role === 'navigator' && (
            <section style={{ animation: 'fade-up 0.35s var(--spring)' }}>
              <div className="t-caption mb-2">Team</div>
              <div className="flex gap-2">
                {(['red', 'blue'] as const).map(t => {
                  const c = t === 'red' ? '#FF3B30' : '#007AFF';
                  const active = team === t;
                  return (
                    <button key={t} className="btn pill pill-sm flex-1 pill-full" onClick={() => setTeam(t)} style={{ background: active ? c : 'var(--bg-elevated)', color: active ? '#fff' : 'var(--text-secondary)', border: '1px solid ' + (active ? 'transparent' : 'var(--separator)') }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: active ? '#fff' : c, marginRight: 6 }} />
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          <div style={{ height: 8 }} />
        </div>
      </div>
      <div className="glass" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--glass-border)', padding: '14px 20px' }}>
        <button className="pill pill-primary pill-full" disabled={!ok || busy} onClick={handleJoin}>{busy ? 'Joining...' : 'Join Game'}</button>
      </div>
    </div>
  );
}
