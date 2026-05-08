import { useEffect, useRef, useState, useCallback } from 'react';
import { TopBar } from '@/components/TopBar';
import { useTheme } from '@/hooks/useTheme';
import { DIFFICULTY, HOME } from '@/types/game';
import type { GameState } from '@/types/game';
import { hav } from '@/types/game';
import { Crosshair, Loader2 } from 'lucide-react';
import L from 'leaflet';

interface Props { state: GameState; onBack: () => void; onConfirm: (t: { lat: number; lon: number } | null, m?: Array<{ lat: number; lon: number }> | null) => void; findSmartTarget: (lat: number, lon: number, k: number) => Promise<{ lat: number; lon: number }>; }

export function MapScreen({ state, onBack, onConfirm, findSmartTarget }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const ring = useRef<L.Circle | null>(null);
  const smartPins = useRef<L.CircleMarker[]>([]);
  const [dropped, setDropped] = useState(false);
  const [searching, setSearching] = useState(false);
  const [ok, setOk] = useState(false);
  const theme = useTheme();

  const idealM = state.settings.idealMin * 60;
  const limit = Math.round(state.settings.idealMin * DIFFICULTY.mult[state.settings.diff]);
  const myLat = state.myLat || HOME.lat, myLon = state.myLon || HOME.lon;

  const initMap = useCallback(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false }).setView([myLat, myLon], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.tileLayer(
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, subdomains: 'abc' }
    ).addTo(m);
    L.marker([myLat, myLon], { icon: L.divIcon({ html: '<div style="width:14px;height:14px;background:#007AFF;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(m);
    m.on('click', (e: any) => { if (state.settings.mode !== 'manual') return; const { lat, lng: lon } = e.latlng; if (hav(myLat, myLon, lat, lon) > idealM * 2.5) return; setDropped(true); setOk(true); if (pin.current) m.removeLayer(pin.current); pin.current = L.circleMarker([lat, lon], { radius: 8, color: '#FF3B30', fillColor: 'rgba(255,59,48,.2)', fillOpacity: 1, weight: 2 }).addTo(m); if (ring.current) m.removeLayer(ring.current); ring.current = L.circle([lat, lon], { radius: idealM, color: '#007AFF', weight: 1.5, dashArray: '6,6', fill: false, opacity: 0.4 }).addTo(m); });
    map.current = m;
  }, [myLat, myLon, state.settings.mode, idealM, theme]);

  useEffect(() => { initMap(); return () => { if (map.current) { map.current.remove(); map.current = null; } }; }, [initMap]);

  const searchSmart = useCallback(async () => { setSearching(true); smartPins.current.forEach(p => map.current?.removeLayer(p)); smartPins.current = []; try { const k = (state.settings.idealMin * DIFFICULTY.mult[state.settings.diff]) / 60; for (let i = 0; i < 3; i++) { const t = await findSmartTarget(myLat, myLon, k); const c = ['#007AFF', '#34C759', '#AF52DE'][i]; const p = L.circleMarker([t.lat, t.lon], { radius: 7, color: c, fillColor: c, fillOpacity: 0.25, weight: 2 }).addTo(map.current!).bindPopup(`Target ${i + 1}`); smartPins.current.push(p); } setOk(true); } catch { } finally { setSearching(false); } }, [state.settings, myLat, myLon, findSmartTarget]);

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <TopBar title={state.settings.mode === 'smart' ? 'Smart Target' : 'Place Target'} onBack={onBack} />
      <div className="relative flex-1" style={{ minHeight: 0 }}>
        <div ref={el} style={{ width: '100%', height: '100%' }} />
        {state.settings.mode === 'manual' && !dropped && (
          <div className="glass" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', borderRadius: 10, padding: '8px 16px', zIndex: 400 }}>
            <span className="t-footnote" style={{ fontWeight: 500 }}>Tap the map to place target</span>
          </div>
        )}
        {state.settings.mode === 'smart' && !searching && smartPins.current.length === 0 && (
          <button className="pill pill-primary absolute" style={{ bottom: 160, left: '50%', transform: 'translateX(-50%)', zIndex: 400 }} onClick={searchSmart}><Crosshair size={16} /> Find Smart Target</button>
        )}
        {searching && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-[400]" style={{ background: 'rgba(0,0,0,.6)' }}><Loader2 size={24} className="animate-spin" style={{ color: 'white' }} /><span style={{ color: 'rgba(255,255,255,.7)', fontSize: 14 }}>Searching...</span></div>}
        <button className="fab absolute" style={{ bottom: 150, right: 14, zIndex: 400 }} onClick={() => map.current?.panTo([myLat, myLon])}><Crosshair size={15} /></button>
      </div>
      <div style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--separator)', padding: '14px 20px' }}>
        <div className="crow" style={{ padding: '4px 0' }}><span className="t-footnote">Radius</span><span className="t-callout" style={{ color: 'var(--blue)' }}>{idealM >= 1000 ? (idealM / 1000).toFixed(1) + ' km' : Math.round(idealM) + ' m'}</span></div>
        <div className="crow" style={{ padding: '4px 0', borderTop: '1px solid var(--separator)' }}><span className="t-footnote">Time limit</span><span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>{limit} min</span></div>
        <button className="pill pill-primary pill-full" style={{ marginTop: 6 }} disabled={!ok} onClick={() => { if (state.settings.mode === 'smart' && smartPins.current.length >= 3) { const pts = smartPins.current.map(m => { const l = m.getLatLng(); return { lat: l.lat, lon: l.lng }; }); onConfirm(null, pts); } else if (pin.current) { const l = pin.current.getLatLng(); onConfirm({ lat: l.lat, lon: l.lng }); } }}>{state.settings.mode === 'smart' ? 'Lock These Targets' : 'Lock Target'}</button>
      </div>
    </div>
  );
}
