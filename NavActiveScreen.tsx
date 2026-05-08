import { useState } from 'react';
import { GlassCard } from '@/components/GlassCard';
import type { GameState } from '@/types/game';
import { Navigation, Eye } from 'lucide-react';

interface Props {
  state: GameState;
  onSelect: (role: 'navigator' | 'spectator') => void;
}

export function HostRoleScreen({ state, onSelect }: Props) {
  const [choice, setChoice] = useState<'navigator' | 'spectator' | null>(null);

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <div className="bar">
        <div className="bar-title">New Game</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8" style={{ animation: 'fade-up 0.3s var(--spring)' }}>
        <div className="t-caption" style={{ marginBottom: 8, letterSpacing: '1px' }}>GAME {state.gameCode}</div>
        <h2 className="t-title2" style={{ marginBottom: 6 }}>How do you want to play?</h2>
        <p className="t-footnote" style={{ color: 'var(--text-secondary)', marginBottom: 32, textAlign: 'center' }}>Choose your role for this game. You can always switch later.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <GlassCard
            icon={Navigation}
            title="Navigator"
            desc="Place the target and race to find it"
            selected={choice === 'navigator'}
            onClick={() => setChoice('navigator')}
          />
          <GlassCard
            icon={Eye}
            title="Spectator"
            desc="Watch from the map, manage the game"
            selected={choice === 'spectator'}
            onClick={() => setChoice('spectator')}
          />
        </div>

        <button
          className="pill pill-primary pill-full"
          style={{ marginTop: 28, maxWidth: 320, opacity: choice ? 1 : 0.4, pointerEvents: choice ? 'auto' : 'none' }}
          onClick={() => choice && onSelect(choice)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
