import { useRef, useEffect, useState, useCallback } from 'react';
import L from 'leaflet';
import type { GameState } from '@/types/game';
import { fmtDist, distUnit, fmtTime, PCOLS, MODE_INFO } from '@/types/game';
import { Home, Copy, Trophy, Share } from 'lucide-react';

interface Props { state: GameState; onHome: () => void; }

export function ResultsScreen({ state, onHome }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const ps = Object.entries(state.latestPlayers || {});
  const navs = ps.filter(([, p]: [string, any]) => p.role === 'navigator');
  const sorted = [...navs].sort(([, a]: [string, any], [, b]: [string, any]) => {
    if (a.arrived && !b.arrived) return -1;
    if (!a.arrived && b.arrived) return 1;
    if (a.arrived && b.arrived) return (a.arrSec || 0) - (b.arrSec || 0);
    return (b.startDist || 0) - (a.startDist || 0);
  });
  const winner = sorted.length > 0 && sorted[0][1].arrived ? sorted[0][1] : null;
  const modeInfo = MODE_INFO[state.settings.gameMode];
  const diffStars = Array(state.settings.diff).fill('*').join('');
  const arrivedCount = navs.filter(([, p]: [string, any]) => p.arrived).length;
  const timeLimitText = state.timeLimitSec ? `${Math.floor(state.timeLimitSec / 60)} min` : '-';

  useEffect(() => {
    if (!mapEl.current || map.current || view !== 'map') return;
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    L.tileLayer(
      isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, subdomains: 'abc' }
    ).addTo(m);
    if (state.targetLat && state.targetLon) {
      L.circleMarker([state.targetLat, state.targetLon], { radius: 8, color: '#FF3B30', fillColor: 'rgba(255,59,48,.2)', fillOpacity: 1, weight: 2 }).addTo(m);
    }
    navs.forEach((entry: [string, any], i: number) => {
      const p = entry[1];
      if (p.lat && p.lon) L.circleMarker([p.lat, p.lon], { radius: 6, color: PCOLS[i % PCOLS.length], fillColor: PCOLS[i % PCOLS.length], fillOpacity: 0.7, weight: 2 }).addTo(m);
    });
    m.setView([state.myLat || state.targetLat || 48.210, state.myLon || state.targetLon || 16.363], 13);
    map.current = m;
  }, [view]);

  function rankLabel(p: any) {
    if (p.arrived) return p.arrSec != null ? fmtTime(p.arrSec) : 'Arrived';
    if (p.startDist) return `${fmtDist(p.startDist)} ${distUnit(p.startDist)}`;
    return '-';
  }

  function rankColor(p: any, idx: number) {
    if (p.arrived) return idx === 0 ? 'var(--orange)' : 'var(--green)';
    return 'var(--bg)';
  }

  function copyResultText() {
    const t = winner ? `${winner.name} won in ${fmtTime(winner.arrSec || 0)}!` : 'Luftlinie Results';
    navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* -- Generate share card canvas -- */
  const generateCard = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = Math.min(window.devicePixelRatio || 2, 3);
    const W = 800;
    const H = winner ? 520 : 440;
    cvs.width = W * dpr;
    cvs.height = H * dpr;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    (ctx as any).roundRect(0, 0, W, H, 28);
    ctx.fill();

    ctx.fillStyle = modeInfo?.color || '#000';
    ctx.beginPath();
    (ctx as any).roundRect(40, 36, 6, 48, 3);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = '700 36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Luftlinie', 60, 68);
    ctx.fillStyle = '#8E8E93';
    ctx.font = '500 18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(modeInfo?.name || state.settings.gameMode, 60, 94);

    let y = 140;
    if (winner) {
      ctx.fillStyle = '#F5F5F7';
      ctx.beginPath();
      (ctx as any).roundRect(40, y, W - 80, 120, 18);
      ctx.fill();
      // Draw trophy icon
      ctx.save();
      ctx.translate(68, y + 26);
      ctx.scale(1.8, 1.8);
      ctx.fillStyle = '#FF9500';
      ctx.beginPath();
      ctx.moveTo(2, 3); ctx.lineTo(22, 3); ctx.lineTo(22, 9);
      ctx.bezierCurveTo(22, 14, 18, 17, 12, 18);
      ctx.lineTo(12, 22); ctx.lineTo(17, 22); ctx.lineTo(17, 24); ctx.lineTo(7, 24); ctx.lineTo(7, 22); ctx.lineTo(12, 22);
      ctx.lineTo(12, 18); ctx.bezierCurveTo(6, 17, 2, 14, 2, 9); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFB340';
      ctx.beginPath(); ctx.arc(12, 12, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#000';
      ctx.font = '700 30px -apple-system, sans-serif';
      ctx.fillText(winner.name, 130, y + 62);
      ctx.fillStyle = '#8E8E93';
      ctx.font = '500 18px -apple-system, sans-serif';
      ctx.fillText(`Winner · ${fmtTime(winner.arrSec || 0)}`, 130, y + 90);
      y += 150;
    }

    ctx.fillStyle = '#000';
    ctx.font = '600 16px -apple-system, sans-serif';
    ctx.fillText('Results', 40, y);
    y += 16;

    sorted.slice(0, 6).forEach(([_, p]: [string, any], i) => {
      y += 42;
      const arrived = p.arrived;
      ctx.fillStyle = arrived ? (i === 0 ? '#34C759' : '#E5F5E9') : '#F2F2F7';
      ctx.beginPath();
      ctx.arc(60, y - 6, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = arrived ? '#fff' : '#8E8E93';
      ctx.font = '600 14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, 60, y - 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000';
      ctx.font = '500 18px -apple-system, sans-serif';
      ctx.fillText(p.name, 90, y);
      ctx.fillStyle = '#8E8E93';
      ctx.font = '500 16px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      const label = arrived ? fmtTime(p.arrSec || 0) : p.startDist ? `${fmtDist(p.startDist)} ${distUnit(p.startDist)}` : '-';
      ctx.fillText(label, W - 40, y);
      ctx.textAlign = 'left';
    });

    y = H - 30;
    ctx.fillStyle = '#D1D1D6';
    ctx.font = '500 13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('luftlinie.app', W / 2, y);
    ctx.textAlign = 'left';
  }, [winner, sorted, modeInfo, state.settings.gameMode]);

  useEffect(() => { if (shareOpen) generateCard(); }, [shareOpen, generateCard]);

  const doShare = async () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    try {
      const blob = await new Promise<Blob>((res) => cvs.toBlob(b => res(b!), 'image/png'));
      const file = new File([blob], 'luftlinie-result.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Luftlinie Result' });
        return;
      }
    } catch { /* no op */ }
    try {
      const cvs2 = canvasRef.current;
      if (!cvs2) return;
      cvs2.toBlob((b) => {
        if (!b) return;
        navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
      }, 'image/png');
    } catch { /* no op */ }
  };

  const ListView = () => (
    <div className="px-5 py-4 space-y-5">
      {winner && (
        <div style={{ textAlign: 'center', padding: '24px 0', animation: 'fade-up 0.3s var(--spring)' }}>
          <div style={{ fontSize: 44 }}>
            <Trophy size={44} style={{ color: 'var(--orange)' }} />
          </div>
          <h2 className="t-title1 mt-3">{winner.name}</h2>
          <p className="t-footnote" style={{ color: 'var(--text-secondary)' }}>Winner · {modeInfo?.name}</p>
          {winner.arrSec != null && <p className="t-callout" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{fmtTime(winner.arrSec)}</p>}
        </div>
      )}

      <button className="pill pill-primary pill-full gap-2" style={{ height: 48 }} onClick={() => setShareOpen(true)}>
        <Share size={16} /> Share Result
      </button>

      <section>
        <div className="t-caption mb-2">Game Info</div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)', overflow: 'hidden' }}>
          <div className="crow"><span className="t-body">Mode</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{modeInfo?.name || state.settings.gameMode}</span></div>
          <div className="crow"><span className="t-body">Difficulty</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{diffStars || '-'}</span></div>
          <div className="crow"><span className="t-body">Players</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{navs.length}</span></div>
          <div className="crow"><span className="t-body">Arrived</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{arrivedCount}</span></div>
          <div className="crow"><span className="t-body">Time Limit</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{timeLimitText}</span></div>
        </div>
      </section>

      <section>
        <div className="t-caption mb-2">Ranking</div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r)', border: '1px solid var(--separator)', overflow: 'hidden' }}>
          {sorted.map(([id, p]: [string, any], i) => (
            <div key={id} className="crow" style={{ borderTop: i > 0 ? '1px solid var(--separator)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: rankColor(p, i), color: p.arrived ? '#fff' : 'var(--text-tertiary)' }}>{i + 1}</span>
                <span className="t-body">{p.name}</span>
              </div>
              <span className="t-mono" style={{ fontSize: 14, color: p.arrived ? 'var(--green)' : 'var(--text-secondary)' }}>
                {rankLabel(p)}
              </span>
            </div>
          ))}
        </div>
      </section>
      <div style={{ height: 24 }} />
    </div>
  );

  const MapView = () => (
    <div className="p-4">
      <div ref={mapEl} style={{ width: '100%', height: '60vh', borderRadius: 12 }} />
    </div>
  );

  const isDark = state.theme === 'dark';
  const shareBg = isDark ? '#1C1C1E' : '#fff';
  const shareText = isDark ? '#fff' : '#000';

  const ShareSheet = () => (
    <div className="fixed inset-0 z-[310] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,.4)' }} onClick={() => setShareOpen(false)}>
      <div style={{ animation: 'slide-up 0.3s var(--spring)' }} onClick={e => e.stopPropagation()}>
        <div className="mx-3 mb-3 overflow-hidden" style={{ borderRadius: 20, background: shareBg, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D1D6' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 20px 20px' }}>
            <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 400, borderRadius: 16, display: 'block' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, width: '100%' }}>
              <button className="pill pill-ghost pill-sm flex-1 gap-1" style={{ height: 40, fontSize: 14 }} onClick={copyResultText}>
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="pill pill-primary flex-1 gap-1" style={{ height: 40, fontSize: 14 }} onClick={doShare}>
                <Share size={14} /> Share
              </button>
            </div>
          </div>
        </div>
        <button className="pill mx-3 mb-6 pill-full" style={{ borderRadius: 14, height: 52, fontSize: 17, fontWeight: 600, background: isDark ? 'rgba(60,60,60,0.9)' : 'rgba(255,255,255,.9)', color: shareText }} onClick={() => setShareOpen(false)}>
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <div className="bar">
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 60, zIndex: 1 }}>
          <button className="pill pill-ghost pill-sm gap-1" onClick={onHome}>
            <Home size={16} /> Home
          </button>
        </div>
        <div className="bar-title">Results</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 60, zIndex: 1 }} />
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', flexShrink: 0 }}>
        {(['list', 'map'] as const).map(m => {
          const active = view === m;
          const borderColor = active ? 'var(--text-secondary)' : 'var(--separator)';
          return (
            <button key={m} className="pill pill-sm flex-1" onClick={() => setView(m)} style={{ background: active ? 'var(--text-secondary)' : 'var(--bg-elevated)', color: active ? '#fff' : 'var(--text-secondary)', borderRadius: 8, height: 34, border: `1px solid ${borderColor}` }}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {view === 'list' ? <ListView /> : <MapView />}
      </div>

      {shareOpen && <ShareSheet />}
    </div>
  );
}
