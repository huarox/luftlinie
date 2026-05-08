import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Trophy, AlertTriangle, Car } from 'lucide-react';

export function CountdownOverlay({ num }: { num: number }) {
  return <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,.7)' }}><span className="t-mono" style={{ fontSize: 96, fontWeight: 800, color: '#fff', animation: 'countdown-pop 0.3s var(--bounce)' }}>{num === 0 ? 'GO' : num}</span></div>;
}

export function ArrivalOverlay({ onShowResults }: { onShowResults: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,.5)' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '2px solid rgba(52,199,89,.5)', animation: 'ring-out 1.2s ease forwards' }} />
      <Trophy size={48} style={{ color: '#34C759', marginBottom: 12 }} />
      <div className="t-title2" style={{ color: '#fff' }}>You arrived!</div>
      <button className="pill pill-primary mt-6" style={{ minWidth: 170 }} onClick={onShowResults}>View Results</button>
    </div>
  );
}

export function EliminatedOverlay() {
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,.55)' }}>
      <AlertTriangle size={44} style={{ color: '#FF9500', marginBottom: 12 }} />
      <div className="t-title2" style={{ color: '#fff' }}>Eliminated</div>
      <p className="t-footnote" style={{ color: 'rgba(255,255,255,.6)', marginTop: 4 }}>Furthest from target</p>
    </div>
  );
}

export function SpeedWarnOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-8" style={{ background: 'rgba(0,0,0,.55)' }}>
      <Car size={40} style={{ color: '#5AC8FA', marginBottom: 12 }} />
      <div className="t-title2" style={{ color: '#fff' }}>Slow Down</div>
      <p className="t-footnote" style={{ color: 'rgba(255,255,255,.65)', textAlign: 'center', marginTop: 8 }}>Are you driving? For safety, have a passenger navigate or pull over.</p>
      <button className="pill pill-primary mt-6" style={{ minWidth: 180 }} onClick={onDismiss}>I&apos;m a passenger</button>
    </div>
  );
}

export function AbortSheet({ onAbort, onCancel }: { onAbort: () => void; onCancel: () => void }) {
  return <div className="fixed inset-0 z-[310] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,.35)' }}><div className="glass mx-3 mb-2 overflow-hidden" style={{ borderRadius: 16, animation: 'slide-up 0.2s var(--spring)' }}><div className="crow justify-center" style={{ borderBottom: '1px solid var(--glass-border)', padding: '8px 16px' }}><span className="t-caption" style={{ fontWeight: 600 }}>End Game</span></div><button className="pill pill-red pill-full" style={{ borderRadius: 0, height: 56, fontSize: 17 }} onClick={onAbort}>End Game for Everyone</button></div><button className="pill pill-glass mx-3 mb-4 pill-full" style={{ borderRadius: 16, height: 50, fontSize: 17 }} onClick={onCancel}>Cancel</button></div>;
}

/* ─── QR Sheet (drops from top like original) ─── */
export function QRSheet({ code, onClose }: { code: string; onClose: () => void }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!cvs.current || !code) return;
    QRCode.toCanvas(cvs.current, `${window.location.origin}${window.location.pathname}?join=${code}`, {
      width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' }
    }).catch(() => {});
  }, [code]);

  return (
    <div className="fixed inset-0 z-[310] flex items-start justify-center" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(12px) saturate(180%)', WebkitBackdropFilter: 'blur(12px) saturate(180%)' }} onClick={onClose}>
      <div style={{ animation: 'slide-down 0.35s var(--spring)', width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="glass mx-3 mt-4 overflow-hidden" style={{ borderRadius: '0 0 24px 24px', background: 'var(--bg-elevated)', border: '1px solid var(--separator)', boxShadow: 'var(--e3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 24px 24px' }}>
            <div className="t-title2" style={{ marginBottom: 4 }}>Scan to Join</div>
            <div className="t-footnote" style={{ color: 'var(--text-secondary)', marginBottom: 18 }}>Game Code: {code}</div>
            <div style={{ borderRadius: 12, overflow: 'hidden', display: 'inline-block' }}>
              <canvas ref={cvs} style={{ display: 'block' }} />
            </div>
            <button className="pill pill-glass pill-full mt-4" style={{ height: 44, fontSize: 15 }} onClick={onClose}>Done</button>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--separator)', margin: '12px auto 0' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return <div className="fixed bottom-6 left-0 right-0 z-[320] flex justify-center pointer-events-none" style={{ transition: 'all 0.25s ease', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}><div className="glass" style={{ borderRadius: 100, padding: '10px 20px', fontSize: 14, fontWeight: 500 }}>{msg}</div></div>;
}
