import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useTheme } from '@/hooks/useTheme';
import type { GameState } from '@/types/game';
import { fmtDist, distUnit, fmtTime } from '@/types/game';

interface Props {
  state: GameState;
  onToggleSound: () => void;
  onToggleView: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onRefresh: () => void;
}

export function NavActiveScreen({ state, onToggleSound, onToggleView, onLeave, onEnd, onRefresh }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tMk = useRef<L.CircleMarker | null>(null);
  const aMk = useRef<L.CircleMarker | null>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const [whisperVis, setWhisperVis] = useState(true);
  const [elimWarn, setElimWarn] = useState(false);
  const [facingDir, setFacingDir] = useState<'N' | 'E' | 'S' | 'W'>('N');

  const isHC = state.settings.gameMode === 'hotcold';
  const isWhisper = state.settings.gameMode === 'whisper';
  const isBlind = state.settings.blindStart && state.startedAt && Date.now() - state.startedAt < 60000;
  const isSailor = state.settings.gameMode === 'sailor';
  const isElim = state.settings.elimMode;
  const isDyn = state.settings.gameMode === 'dynamic';
  const isMulti = state.settings.gameMode === 'multi';
  const timer = state.startedAt ? fmtTime(Math.max(0, Math.floor((state.timeLimitSec * 1000 - (Date.now() - state.startedAt)) / 1000))) : '--:--';
  const ps = Object.entries(state.latestPlayers || {});
  const navs = ps.filter(([, p]: [string, any]) => p.role === 'navigator' && !p.eliminated);
  const arrived = navs.filter(([, p]: [string, any]) => p.arrived).length;

  const lastDist = state.lastDist ?? 999;

  const hcTrend = (() => {
    const h = state.hcHistory;
    if (h.length < 2) return 'neutral';
    const recent = h[h.length - 1].dist;
    const past = h[0].dist;
    return recent < past * 0.95 ? 'hot' : recent > past * 1.05 ? 'cold' : 'neutral';
  })();

  const prox = lastDist <= 15 ? 'rgba(52,199,89,0.08)' : lastDist <= 50 ? 'rgba(52,199,89,0.04)' : lastDist <= 100 ? 'rgba(255,149,0,0.03)' : lastDist <= 200 ? 'rgba(255,59,48,0.02)' : null;
  const hcBand = hcTrend === 'hot' ? 'rgba(255,59,48,0.1)' : hcTrend === 'cold' ? 'rgba(0,122,255,0.08)' : null;
  const bgColor = prox || hcBand || 'var(--bg)';

  // Compass bearing + needle
  useEffect(() => {
    if (!isSailor || !state.myLat || !state.myLon || !state.targetLat || !state.targetLon) return;
    const toRad = Math.PI / 180;
    const lat1 = state.myLat * toRad;
    const lat2 = state.targetLat * toRad;
    const dLon = (state.targetLon - state.myLon) * toRad;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    if (arrowRef.current) arrowRef.current.style.transform = 'rotate(' + bearing + 'deg)';
  }, [isSailor, state.myLat, state.myLon, state.targetLat, state.targetLon]);

  // Device heading for direction highlight
  useEffect(() => {
    if (!isSailor) return;
    const handler = (e: DeviceOrientationEvent) => {
      let heading = e.alpha || 0;
      const ev = e as any;
      if (ev.webkitCompassHeading) heading = ev.webkitCompassHeading;
      // Convert to cardinal
      const b = (heading + 360) % 360;
      if (b >= 315 || b < 45) setFacingDir('N');
      else if (b >= 45 && b < 135) setFacingDir('E');
      else if (b >= 135 && b < 225) setFacingDir('S');
      else setFacingDir('W');
    };
    window.addEventListener('deviceorientation', handler as any, true);
    return () => window.removeEventListener('deviceorientation', handler as any, true);
  }, [isSailor]);

  // Whisper
  useEffect(() => {
    if (!isWhisper) return;
    setWhisperVis(true);
    const t = setTimeout(() => setWhisperVis(false), 3000);
    const iv = setInterval(() => { setWhisperVis(true); setTimeout(() => setWhisperVis(false), 3000); }, 60000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [isWhisper]);

  // Elimination warning
  useEffect(() => {
    if (!isElim || !state.startedAt) return;
    const next = state.startedAt + 5 * 60 * 1000;
    const iv = setInterval(() => { setElimWarn(Date.now() > next - 60000 && Date.now() < next); }, 1000);
    return () => clearInterval(iv);
  }, [isElim, state.startedAt]);

  // Refresh
  useEffect(() => { const iv = setInterval(onRefresh, 10000); return () => clearInterval(iv); }, [onRefresh]);

  const theme = useTheme();

  // Map
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
    map.current = m;
  }, [theme]);

  // Map sync
  useEffect(() => {
    const m = map.current;
    if (!m || !state.targetLat || !state.targetLon) return;
    const tLat = isMulti && state.multiTargets ? state.multiTargets[state.multiCurrent]?.lat : state.targetLat;
    const tLon = isMulti && state.multiTargets ? state.multiTargets[state.multiCurrent]?.lon : state.targetLon;
    if (!tLat || !tLon) return;
    if (tMk.current) m.removeLayer(tMk.current);
    tMk.current = L.circleMarker([tLat, tLon], { radius: 6, color: '#FF3B30', fillColor: 'rgba(255,59,48,.2)', fillOpacity: 1, weight: 2 }).addTo(m);
    if (aMk.current) m.removeLayer(aMk.current);
    aMk.current = L.circle([tLat, tLon], { radius: state.settings.arrRadius || 50, color: 'var(--text-secondary)', weight: 1.5, dashArray: '6,6', fill: false, opacity: 0.4 }).addTo(m);
    if (state.myLat && state.myLon) m.panTo([state.myLat, state.myLon], { animate: true, duration: 0.8 });
  }, [state.targetLat, state.targetLon, state.multiTargets, state.multiCurrent, state.settings.arrRadius, state.myLat, state.myLon, isMulti]);

  const timerUrgent = timer.startsWith('00:') && timer !== '00:00';

  // Direction highlight colors
  const dirColor = (dir: 'N' | 'E' | 'S' | 'W') => facingDir === dir ? 'var(--text)' : 'var(--text-quaternary)';
  const dirWeight = (dir: 'N' | 'E' | 'S' | 'W') => facingDir === dir ? 800 : 500;
  const dirSize = (dir: 'N' | 'E' | 'S' | 'W') => facingDir === dir ? 18 : 13;

  return (
    <div className="absolute inset-0 screen-enter" style={{ background: bgColor, transition: 'background 0.5s' }}>
      {/* Map fills the whole area */}
      <div ref={el} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

      {/* Top HUD - identical structure to HostActiveScreen */}
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
          {isElim && <span className="t-caption" style={{ color: 'var(--orange)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></span>}
          {isDyn && state.dynamicMoveCount > 0 && <span className="t-caption" style={{ color: 'var(--yellow)' }}>{state.dynamicMoveCount}x</span>}
        </div>
        <div style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 1 }}>Time Left</div>
          <div className={timerUrgent ? 'hud-timer hud-timer-urgent' : 'hud-timer'} style={{ fontSize: 20, lineHeight: 1 }}>{timer}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
          <button className="toolbar-btn" onClick={onToggleSound} style={{ opacity: state.soundEnabled ? 1 : 0.45 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{state.soundEnabled ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></> : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}</svg></button>
          {state.isHost && <button className="toolbar-btn" onClick={onToggleView} title="Switch view"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg></button>}
          {state.isHost && <button className="pill pill-red pill-sm" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={onEnd}>End</button>}
          {!state.isHost && <button className="pill pill-red pill-sm" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={onLeave}>Leave</button>}
        </div>
      </div>

      {/* Warning banners */}
      {isDyn && <div style={{ position: 'absolute', top: 60, left: 8, right: 8, zIndex: 400, padding: '5px 12px', textAlign: 'center', background: 'rgba(255,204,0,0.08)', borderRadius: 'var(--r-sm)' }}><span className="t-caption" style={{ color: 'var(--yellow)', fontWeight: 600 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>Target moves every 3 min</span></div>}
      {isElim && elimWarn && <div style={{ position: 'absolute', top: 60, left: 8, right: 8, zIndex: 400, padding: '5px 12px', textAlign: 'center', background: 'rgba(255,59,48,0.08)', borderRadius: 'var(--r-sm)', animation: 'pulse-danger 2s infinite' }}><span className="t-caption" style={{ color: 'var(--red)', fontWeight: 600 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>Elimination soon - move closer!</span></div>}

      {/* Overlays */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ pointerEvents: 'none', zIndex: 200 }}>

        {/* Standard distance - Liquid Glass */}
        {!isHC && !isSailor && (!isWhisper || whisperVis) && !isBlind && (
          <div style={{ pointerEvents: 'auto', textAlign: 'center', animation: 'fade-up 0.25s var(--spring)' }}>
            <div className="glass" style={{ borderRadius: 28, padding: '20px 36px', minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              <div className="t-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600, fontSize: 11 }}>{isMulti ? 'Target ' + (state.multiCurrent + 1) + '/' + (state.multiTargets.length || 3) : 'Distance'}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
                <span className="t-mono" style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-3px', color: 'var(--text)', lineHeight: 1 }}>{fmtDist(lastDist)}</span>
                <span className="t-subhead" style={{ color: 'var(--text-secondary)', fontSize: 20, fontWeight: 500 }}>{distUnit(lastDist)}</span>
              </div>
              {/* Proximity indicator bar */}
              <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: lastDist >= 1000 ? '20%' : lastDist >= 500 ? '40%' : lastDist >= 200 ? '60%' : lastDist >= 50 ? '80%' : '100%',
                  borderRadius: 2,
                  background: lastDist <= 50 ? 'var(--green)' : lastDist <= 200 ? 'var(--orange)' : 'var(--blue)',
                  transition: 'all 0.5s var(--spring)',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Whisper hidden */}
        {isWhisper && !whisperVis && (
          <div style={{ pointerEvents: 'auto', textAlign: 'center' }}>
            <div className="glass" style={{ borderRadius: 20, padding: '20px 40px' }}>
              <div className="t-subhead" style={{ color: 'var(--text-tertiary)' }}>Distance hidden</div>
              <div className="t-footnote">Revealed once per minute</div>
            </div>
          </div>
        )}

        {/* Blind start */}
        {isBlind && (
          <div style={{ pointerEvents: 'auto', textAlign: 'center' }}>
            <div className="glass" style={{ borderRadius: 20, padding: '20px 40px' }}>
              <div className="t-title3">Blind Start</div>
              <div className="t-footnote" style={{ color: 'var(--text-secondary)' }}>Distance hidden for 60s</div>
            </div>
          </div>
        )}

        {/* Hot/Cold */}
        {isHC && (
          <div style={{ pointerEvents: 'auto', textAlign: 'center', animation: 'fade-up 0.25s var(--spring)' }}>
            <div className="glass" style={{ borderRadius: 24, padding: '24px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="t-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>Hot &amp; Cold</div>
              <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hcTrend === 'hot' ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-2.072-2.143-2.5-4.5C7.5 7.5 6 9 6 11c0 2.5 1.5 3.5 2.5 3.5z" fill="rgba(255,59,48,0.12)"/><path d="M12.5 17.5a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-2.072-2.143-2.5-4.5-.5 2-2 3.5-2 5.5 0 2.5 1.5 3.5 2.5 3.5z" fill="rgba(255,59,48,0.08)"/><path d="M12 22c3-1 5-3.5 5-7 0-3-2-5-3-7"/><path d="M9 16c1.5 0 2.5-.5 3-1.5"/></svg>
                ) : hcTrend === 'cold' ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/><circle cx="12" cy="12" r="4" stroke="#5AC8FA" fill="rgba(10,132,255,0.08)"/></svg>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-quaternary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                )}
              </div>
              <div className="t-subhead" style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>{hcTrend === 'hot' ? 'Getting warmer' : hcTrend === 'cold' ? 'Getting colder' : 'Move to sense'}</div>
            </div>
          </div>
        )}

        {/* === SAILOR - Find My Radar + Compass === */}
        {isSailor && (
          <div style={{ pointerEvents: 'auto', textAlign: 'center', animation: 'fade-up 0.25s var(--spring)' }}>
            <div style={{ position: 'relative', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Radar rings - pulsing */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', border: '1px solid var(--text-quaternary)', opacity: 0.15, animation: 'radar-expand 3s ease-out infinite' }} />
                <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: '1px solid var(--text-quaternary)', opacity: 0.12, animation: 'radar-expand 3s ease-out infinite 1s' }} />
                <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', border: '1px solid var(--text-quaternary)', opacity: 0.08, animation: 'radar-expand 3s ease-out infinite 2s' }} />
              </div>
              {/* Static rings */}
              <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute' }}>
                <circle cx="140" cy="140" r="130" fill="none" stroke="var(--text-quaternary)" strokeWidth="0.5" opacity="0.25" />
                <circle cx="140" cy="140" r="90" fill="none" stroke="var(--text-quaternary)" strokeWidth="0.5" opacity="0.15" />
                <circle cx="140" cy="140" r="45" fill="none" stroke="var(--text-quaternary)" strokeWidth="0.5" opacity="0.1" />
                {/* Crosshairs */}
                <line x1="140" y1="15" x2="140" y2="30" stroke="var(--text-quaternary)" strokeWidth="1" opacity="0.35" />
                <line x1="140" y1="250" x2="140" y2="265" stroke="var(--text-quaternary)" strokeWidth="1" opacity="0.35" />
                <line x1="15" y1="140" x2="30" y2="140" stroke="var(--text-quaternary)" strokeWidth="1" opacity="0.35" />
                <line x1="250" y1="140" x2="265" y2="140" stroke="var(--text-quaternary)" strokeWidth="1" opacity="0.35" />
              </svg>
              {/* Cardinal labels - facing direction lights up */}
              <span style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', fontSize: dirSize('N'), fontWeight: dirWeight('N'), color: dirColor('N'), transition: 'all 0.3s' }}>N</span>
              <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: dirSize('S'), fontWeight: dirWeight('S'), color: dirColor('S'), transition: 'all 0.3s' }}>S</span>
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: dirSize('E'), fontWeight: dirWeight('E'), color: dirColor('E'), transition: 'all 0.3s' }}>E</span>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: dirSize('W'), fontWeight: dirWeight('W'), color: dirColor('W'), transition: 'all 0.3s' }}>W</span>
              {/* Rotating needle */}
              <div ref={arrowRef} style={{ transition: 'transform 0.3s ease-out', zIndex: 2 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <polygon points="50,6 58,44 50,40 42,44" fill="var(--red)" />
                  <polygon points="50,94 58,56 50,60 42,56" fill="var(--text-quaternary)" opacity="0.6" />
                  <circle cx="50" cy="50" r="4" fill="var(--text)" />
                </svg>
              </div>
              {/* Center dot glow when facing target */}
              <div style={{
                position: 'absolute', width: 12, height: 12, borderRadius: '50%',
                background: facingDir === 'N' ? 'var(--green)' : 'var(--text-quaternary)',
                opacity: facingDir === 'N' ? 0.6 : 0.2,
                transition: 'all 0.5s',
              }} />
            </div>
            <div className="t-subhead" style={{ color: 'var(--text-tertiary)', marginTop: 12 }}>Follow the arrow</div>
            <div className="t-footnote" style={{ color: 'var(--text-quaternary)' }}>Facing {facingDir}</div>
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center" style={{ zIndex: 200 }}>
        <div className="glass" style={{ borderRadius: 'var(--r-md)', padding: '6px 14px' }}>
          <span className="t-caption">{arrived}/{navs.length} arrived</span>
        </div>
      </div>
    </div>
  );
}
