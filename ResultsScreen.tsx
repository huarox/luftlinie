import { useEffect, useRef } from 'react';
import { Logo } from '@/components/Logo';
import { GlassCard } from '@/components/GlassCard';
import { Moon, Sun, Flag, LogIn } from 'lucide-react';
import type { GameState } from '@/types/game';

interface Props {
  state: GameState;
  onHost: () => void;
  onJoin: () => void;
  onToggleTheme: () => void;
  onDismissRejoin: () => void;
  onDoRejoin: () => void;
}

export function LandingScreen({ state, onHost, onJoin, onToggleTheme, onDismissRejoin, onDoRejoin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    let anim = 0;
    const resize = () => {
      cvs.width = cvs.offsetWidth * 2;
      cvs.height = cvs.offsetHeight * 2;
    };
    resize();
    const pts = [
      { x: 0.2, y: 0.3, r: 0.4, dx: 0.0003, dy: 0.0002 },
      { x: 0.7, y: 0.6, r: 0.35, dx: -0.0002, dy: 0.0003 },
      { x: 0.5, y: 0.2, r: 0.3, dx: 0.0002, dy: -0.0002 },
    ];
    const colors = state.theme === 'dark'
      ? ['rgba(0,122,255,0.12)', 'rgba(88,86,214,0.10)', 'rgba(0,199,255,0.08)']
      : ['rgba(0,122,255,0.10)', 'rgba(90,200,250,0.08)', 'rgba(175,82,222,0.06)'];
    const draw = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      pts.forEach((p, i) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < -0.2 || p.x > 1.2) p.dx *= -1;
        if (p.y < -0.2 || p.y > 1.2) p.dy *= -1;
        const g = ctx.createRadialGradient(
          p.x * cvs.width, p.y * cvs.height, 0,
          p.x * cvs.width, p.y * cvs.height, p.r * cvs.width
        );
        g.addColorStop(0, colors[i]);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cvs.width, cvs.height);
      });
      anim = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener('resize', resize);
    };
  }, [state.theme]);

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      />

      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6"
        style={{ animation: 'fade-up 0.5s var(--spring)' }}
      >
        <Logo size={100} />
        <h1 className="t-title1 mt-5">Luftlinie</h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 6, letterSpacing: '-0.01em' }}>
          You know how far. You don&apos;t know where.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320, marginTop: 32 }}>
          <GlassCard icon={Flag} title="Host a Game" desc="Create a new game and invite friends" onClick={onHost} />
          <GlassCard icon={LogIn} title="Join a Game" desc="Enter a code to join an existing game" onClick={onJoin} />
        </div>

        <button
          className="pill pill-ghost mt-6 gap-2"
          onClick={onToggleTheme}
        >
          {state.theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          <span style={{ fontSize: 14 }}>{state.theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>

      {state.rejoinCode && (
        <div className="relative z-10 px-5 pb-6" style={{ animation: 'slide-up 0.3s var(--spring)' }}>
          <div className="glass" style={{ borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="flex-1 min-w-0">
              <div className="t-callout" style={{ fontWeight: 600 }}>Rejoin game?</div>
              <div className="t-footnote">{state.rejoinCode} is still active</div>
            </div>
            <button className="pill pill-ghost pill-sm" onClick={onDismissRejoin}>Skip</button>
            <button
              className="pill pill-sm"
              style={{ background: 'var(--blue)', color: '#fff', height: 36, padding: '0 18px', borderRadius: 100, fontSize: 15, fontWeight: 600 }}
              onClick={onDoRejoin}
            >
              Rejoin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
