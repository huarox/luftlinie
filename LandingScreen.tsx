import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useTheme } from '@/hooks/useTheme';
import type { GameState } from '@/types/game';
import { fmtTime, PCOLS } from '@/types/game';
import { Link2, QrCode, Compass, Eye, Zap } from 'lucide-react';

interface Props {
  state: GameState;
  onToggleView: () => void;
  onEnd: () => void;
  onToggleSound: () => void;
  onToggleOrient: () => void;
  mapOrientHost: boolean;
  specRequests: Array<{ token: string; name: string; ts: number }>;
  onApproveSpec: (token: string) => void;
  onDenySpec: (token: string) => void;
  onShowQR: () => void;
}

function _hav(a: number, b: number, c: number, d: number) {
  const R = 6371000;
  const dl = (c - a) * Math.PI / 180;
  const do_ = (d - b) * Math.PI / 180;
  return R * 2 * Math.asin(Math.sqrt(Math.max(0, Math.sin(dl / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(do_ / 2) ** 2)));
}

export function HostActiveScreen({ state, onToggleView, onEnd, onToggleSound, onToggleOrient, mapOrientHost, specRequests, onApproveSpec, onDenySpec, onShowQR }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pMk = useRef<Record<string, L.CircleMarker>>({});
  const pTrails = useRef<Record<string, L.Polyline>>({});
  const pHist = useRef<Record<string, Array<[number, number]>>>({});
  const [copied, setCopied] = useState(false);
  const [elimCd, setElimCd] = useState('');

  const ps = Object.entries(state.latestPlayers || {});
  const navs = ps.filter(([, p]: [string, any]) => p.role === 'navigator' && !p.eliminated);
  const arrived = navs.filter(([, p]: [string, any]) => p.arrived).length;
  const timer = state.startedAt ? fmtTime(Math.max(0, Math.floor((state.timeLimitSec * 1000 - (Date.now() - state.startedAt)) / 1000))) : '--:--';
  const isElim = state.settings.elimMode;

  useEffect(() => {
    if (!isElim || !state.startedAt) return;
    const iv = setInterval(() => {
      const elapsed = Date.now() - state.startedAt!;
      const nextElimMs = (Math.floor(elapsed / (5 * 60 * 1000)) + 1) * 5 * 60 * 1000;
      const sec = Math.max(0, Math.floor((nextElimMs - elapsed) / 1000));
      setElimCd(fmtTime(sec));
    }, 1000);
    return () => clearInterval(iv);
  }, [isElim, state.startedAt]);

  const timerUrgent = timer.startsWith('00:') && timer !== '00:00';
  const theme = useTheme();

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.tileLayer(
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, subdomains: 'abc' }
    ).addTo(m);
    const lat = state.targetLat || 48.210;
    const lon = state.targetLon || 16.363;
    L.circleMarker([lat, lon], { radius: 8, color: '#FF3B30', fillColor: 'rgba(255,59,48,.2)', fillOpacity: 1, weight: 2 }).addTo(m);
    L.circle([lat, lon], { radius: state.settings.arrRadius || 50, color: 'var(--text-secondary)', weight: 1.5, dashArray: '6,6', fill: false, opacity: 0.4 }).addTo(m);
    m.setView([state.myLat || lat, state.myLon || lon], 13);
    map.current = m;
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    ps.forEach(([id, p]: [string, any], i) => {
      if (p.lat && p.lon) {
        if (pMk.current[id]) m.removeLayer(pMk.current[id]);
        const c = PCOLS[i % PCOLS.length];
        const d = state.targetLat && state.targetLon ? _hav(p.lat, p.lon, state.targetLat, state.targetLon) : null;
        const label = p.name + (d != null ? ' · ' + Math.round(d) + 'm' : '') + (p.arrived ? ' · Arrived' : '');
        pMk.current[id] = L.circleMarker([p.lat, p.lon], { radius: 7, color: c, fillColor: c, fillOpacity: 0.75, weight: 2.5 }).addTo(m).bindPopup(label);

        if (!pHist.current[id]) pHist.current[id] = [];
        const hist = pHist.current[id];
        const pt: [number, number] = [+p.lat, +p.lon];
        const last = hist[hist.length - 1];
        if (!last || _hav(last[0], last[1], pt[0], pt[1]) > 5) hist.push(pt);
        if (hist.length > 50) hist.shift();

        if (hist.length > 1) {
          if (pTrails.current[id]) m.removeLayer(pTrails.current[id]);
          pTrails.current[id] = L.polyline(hist, { color: c, weight: 2, opacity: 0.5, dashArray: '5 4' }).addTo(m);
        }
      }
    });
  }, [state.latestPlayers, state.targetLat, state.targetLon, theme]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname + '?join=' + state.gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no op */ }
  };

  return (
    <div className="absolute inset-0 screen-enter" style={{ background: 'var(--bg)' }}>
      {/* Map fills the whole area */}
      <div ref={el} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

      {/* Top HUD - glass style, high z-index */}
      <div className="glass" style={{
        position: 'absolute', top: 8, left: 8, right: 8, zIndex: 500,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
        gap: 8, padding: '8px 12px', borderRadius: 'var(--r-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span>{navs.length}</span>
          </div>
          {isElim && elimCd && (
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--orange)', padding: '3px 10px', borderRadius: 20, background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={12} />
              {elimCd}
            </span>
          )}
        </div>
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 1 }}>Time Left</div>
          <div className={timerUrgent ? 'hud-timer hud-timer-urgent' : 'hud-timer'} style={{ fontSize: 20, lineHeight: 1 }}>{timer}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
          <button className={'toolbar-btn' + (mapOrientHost ? ' active' : '')} onClick={onToggleOrient} title="Toggle map orientation"><Compass size={16} /></button>
          <button className="toolbar-btn" onClick={onToggleSound} style={{ opacity: state.soundEnabled ? 1 : 0.45 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{state.soundEnabled ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></> : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}</svg></button>
          <button className="toolbar-btn" style={{ background: 'rgba(0,122,255,0.1)', borderColor: 'rgba(0,122,255,0.25)', color: 'var(--blue)' }} onClick={onToggleView} title="Switch to navigator view"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg></button>
          <button className="pill pill-red pill-sm" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={onEnd}>End</button>
        </div>
      </div>

      {/* Bottom-left info pill - small, permanent */}
      <div className="glass" style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 500,
        borderRadius: 'var(--r-md)', padding: '10px 14px',
        maxWidth: 220, maxHeight: 200, overflowY: 'auto',
      }}>
        {/* Spectator requests */}
        {specRequests.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div className="t-caption" style={{ fontWeight: 600, marginBottom: 4, color: 'var(--orange)' }}>Requests ({specRequests.length})</div>
            {specRequests.map(r => (
              <div key={r.token} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span className="t-footnote" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={12} />{r.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }} onClick={() => onDenySpec(r.token)}>Deny</button>
                  <button style={{ fontSize: 11, color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }} onClick={() => onApproveSpec(r.token)}>Allow</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Compact player list */}
        <div className="t-caption" style={{ fontWeight: 600, marginBottom: 4 }}>{arrived}/{navs.length} arrived</div>
        {navs.slice(0, 4).map(([id, p]: [string, any], i) => {
          const d = state.targetLat && state.targetLon && p.lat && p.lon ? _hav(p.lat, p.lon, state.targetLat, state.targetLon) : null;
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: PCOLS[i % PCOLS.length], flexShrink: 0 }} />
                <span className="t-footnote">{p.name}</span>
              </div>
              <span className="t-mono" style={{ fontSize: 11, color: p.arrived ? 'var(--green)' : 'var(--text-secondary)' }}>
                {p.arrived ? fmtTime(p.arrSec || 0) : d != null ? String(Math.round(d)) + 'm' : '-'}
              </span>
            </div>
          );
        })}
        {navs.length > 4 && <div className="t-footnote" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>+{navs.length - 4} more</div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid var(--glass-border)', paddingTop: 8 }}>
          <button style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} onClick={onShowQR}><QrCode size={12} />QR</button>
          <button style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }} onClick={copyLink}><Link2 size={12} />{copied ? 'Copied' : 'Link'}</button>
        </div>
      </div>
    </div>
  );
}
