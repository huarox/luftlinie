import { Users, Volume2, VolumeX, Globe, Smartphone } from 'lucide-react';

interface GameBarProps {
  timer: string;
  playerCount: number;
  gpsStatus: 'live' | 'poor' | 'blocked';
  gpsAccuracy?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onToggleOrient?: () => void;
  onToggleView?: () => void;
  onEnd?: () => void;
  onLeave?: () => void;
  showHostBack?: boolean;
  onHostBack?: () => void;
  elimCountdown?: string;
  whisperCountdown?: string;
  rightExtra?: React.ReactNode;
}

export function GameBar({
  timer, playerCount, gpsStatus, gpsAccuracy,
  soundEnabled, onToggleSound, onToggleOrient, onToggleView,
  onEnd, onLeave, showHostBack, onHostBack,
  elimCountdown, whisperCountdown, rightExtra
}: GameBarProps) {
  const gpsDotColor = gpsStatus === 'live' ? 'var(--green)' : gpsStatus === 'poor' ? 'var(--orange)' : 'var(--red)';
  const gpsText = gpsStatus === 'live' ? 'Live' : gpsStatus === 'poor' ? `~${Math.round(gpsAccuracy || 100)}m` : 'Blocked';
  const timerUrgent = timer.startsWith('00:') && parseInt(timer.slice(3)) < 60 && timer !== '00:00';

  return (
    <div className="game-bar select-none">
      <div className="game-bar-left">
        <div className="flex items-center gap-[5px]" style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>
          <Users size={13} strokeWidth={2} />
          <span>{playerCount || '\u2014'}</span>
        </div>
        {elimCountdown && (
          <span className="text-[11px] font-bold tracking-[.5px] rounded-[20px] px-[10px] py-[4px]"
            style={{ color: 'var(--orange)', background: 'rgba(255,159,10,.1)', border: '1px solid rgba(255,159,10,.2)' }}>
            {elimCountdown}
          </span>
        )}
        {whisperCountdown && (
          <span className="text-[13px] font-bold rounded-[20px] px-[10px] py-[3px]"
            style={{ color: 'var(--purple)', background: 'rgba(191,90,242,.1)', border: '1px solid rgba(191,90,242,.2)' }}>
            {whisperCountdown}
          </span>
        )}
      </div>
      <div className="game-bar-center">
        <div className="gbar-lbl">Time Left</div>
        <div className={`gbar-timer ${timerUrgent ? 'urgent' : ''}`}>{timer}</div>
      </div>
      <div className="game-bar-right">
        <div className="flex items-center gap-1 text-[11px] font-bold tracking-[.5px] rounded-[20px] px-[10px] py-[4px]"
          style={{ color: gpsDotColor, background: gpsStatus === 'live' ? 'rgba(52,199,89,.1)' : 'var(--surf2)', border: '1px solid var(--border2)' }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: gpsDotColor }} />
          <span>{gpsText}</span>
        </div>
        <button className={`toolbar-btn sound-btn ${soundEnabled ? 'active' : ''}`} onClick={onToggleSound}>
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        {onToggleOrient && (
          <button className="toolbar-btn" onClick={onToggleOrient}>
            <Globe size={18} strokeWidth={2} />
          </button>
        )}
        {onToggleView && (
          <button className="toolbar-btn" onClick={onToggleView}>
            <Smartphone size={18} strokeWidth={2} />
          </button>
        )}
        {showHostBack && onHostBack && (
          <button className="toolbar-btn" onClick={onHostBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}
        {onEnd && (
          <button className="apple-btn-destruct" onClick={onEnd}>End</button>
        )}
        {onLeave && (
          <button className="apple-btn-destruct" onClick={onLeave}>Leave</button>
        )}
        {rightExtra}
      </div>
    </div>
  );
}
