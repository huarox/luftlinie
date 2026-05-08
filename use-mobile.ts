import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '@/hooks/useTheme';
import type { GameState } from '@/types/game';
import { fmtTime, PCOLS } from '@/types/game';
import { Compass } from 'lucide-react';

interface Props {
  state: GameState; onLeave: () => void; onToggleSound: () => void;
  onToggleOrient: () => void; mapOrientSpec: boolean;
}

function _hav(a: number, b: number, c: number, d: number) {
  const R = 6371000;
  const dl = (c - a) * Math.PI / 180;
  const do_ = (d - b) * Math.PI / 180;
  return R * 2 * Math.asin(Math.sqrt(Math.max(0, Math.sin(dl / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(do_ / 2) ** 2)));
}

export function SpectatorScreen({ state, onLeave, onToggleSound, onToggleOrient, mapOrientSpec }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pMk = useRef<Record<string, L.CircleMarker>>({});
  const pTrails = useRef<Record<string, L.Polyline>>({});
  const pHist = useRef<Record<string, Array<[number, number]>>>({});

  const ps = Object.entries(state.latestPlayers || {});
  const navs = ps.filter(([, p]: [string, any]) => p.role === 'navigator' && !p.eliminated);
  const arrived = navs.filter(([, p]: [string, any]) => p.arrived).length;
  const timer = state.startedAt ? fmtTime(Math.max(0, Math.floor((state.timeLimitSec * 1000 - (Date.now() - state.startedAt)) / 1000))) : '--:--';
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
    const lat = state.targetLat || 48.210, lon = state.targetLon || 16.363;
    L.circleMarker([lat, lon], { radius: 8, color: '#FF3B30', fillColor: 'rgba(255,59,48,.2)', fillOpacity: 1, weight: 2 }).addTo(m);
    L.circle([lat, lon], { radius: state.settings.arrRadius || 50, color: 'var(--text-secondary)', weight: 1.5, dashArray: '6,6', fill: false, opacity: 0.4 }).addTo(m);
    m.setView([lat, lon], 13);
    map.current = m;
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    ps.forEach(([id, p]: [string, any], i) => {
      if (p.lat && p.lon) {
        if (pMk.current[id]) m.removeLayer(pMk.current[id]);
        const c = PCOLS[i % PCOLS.length];
        const d = state.targetLat && state.targetLon ? _hav(p.lat, p.lon, state.targetLat, state.targetLon) : null;
        const label = p.name + (d != null ? ' \u00b7 ' + Math.round(d) + 'm' : '') + (p.arrived ? ' \u00b7 Arrived' : '');
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
  }, [state.latestPlayers, state.targetLat, state.targetLon]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            <span>{navs.length}</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 1 }}>Time Left</div>
          <div className={timerUrgent ? 'hud-timer hud-timer-urgent' : 'hud-timer'} style={{ fontSize: 20, lineHeight: 1 }}>{timer}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
          <button className="toolbar-btn" onClick={onToggleSound} style={{ opacity: state.soundEnabled ? 1 : 0.45 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{state.soundEnabled ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></> : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}</svg></button>
          <button className={'toolbar-btn' + (mapOrientSpec ? ' active' : '')} onClick={onToggleOrient} title="Toggle map orientation"><Compass size={16} /></button>
          <button className="pill pill-red pill-sm" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={onLeave}>Leave</button>
        </div>
      </div>

      {/* Bottom-left info pill - small, permanent */}
      <div className="glass" style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 500,
        borderRadius: 'var(--r-md)', padding: '10px 14px',
        maxWidth: 220, maxHeight: 200, overflowY: 'auto',
      }}>
        <div className="t-caption" style={{ fontWeight: 600, marginBottom: 6 }}>{arrived}/{navs.length} arrived</div>
        {navs.map(([id, p]: [string, any], i) => {
          const d = state.targetLat && state.targetLon && p.lat && p.lon ? _hav(p.lat, p.lon, state.targetLat, state.targetLon) : null;
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOLS[i % PCOLS.length], flexShrink: 0 }} />
                <span className="t-subhead">{p.name}</span>
                {p.arrived && <span style={{ fontSize: 10, color: 'var(--green)' }}>Arrived</span>}
              </div>
              <span className="t-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {p.arrived ? fmtTime(p.arrSec || 0) : d != null ? String(Math.round(d)) + 'm' : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
