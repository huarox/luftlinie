import { useState, useCallback, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, update, get, serverTimestamp } from 'firebase/database';
import type { GameState, GameSettings, Screen, Role } from '@/types/game';
import { hav, noiseDist, randCode, randToken, haptic, DIFFICULTY, PROX_BANDS } from '@/types/game';

// ─── Firebase ───
const db = getDatabase(initializeApp({
  apiKey: "AIzaSyBVPDeqopZPQNsK_LEfVpG8UUEiZakSYWI",
  authDomain: "luftlinie-4ea9a.firebaseapp.com",
  databaseURL: "https://luftlinie-4ea9a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "luftlinie-4ea9a",
  storageBucket: "luftlinie-4ea9a.firebasestorage.app",
  messagingSenderId: "326189819495",
  appId: "1:326189819495:web:9a9418e75b4e1198c516c2"
}));

// ─── Audio ───
let _ctx: AudioContext | null = null;
function ctx() { try { if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (_ctx?.state === 'suspended') _ctx.resume(); return _ctx; } catch { return null; } }
function tone(f: number, d = 0.08, v = 0.18, t: OscillatorType = 'sine') {
  const c = ctx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.connect(g); g.connect(c.destination); o.type = t; o.frequency.value = f;
  const n = c.currentTime; g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(v, n + 0.01); g.gain.exponentialRampToValueAtTime(0.001, n + d);
  o.start(n); o.stop(n + d + 0.05);
}
function chimeArrive() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 0.2), i * 110)); }
function chimeStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.12, 0.2), i * 80)); }
function chimeJoin() { [587, 880].forEach((f, i) => setTimeout(() => tone(f, 0.1, 0.12), i * 120)); }

// ─── Session ───
function saveS(code: string | null, token: string | null, name: string, role: Role) { try { localStorage.setItem('ll_s', JSON.stringify({ code, token, name, role, ts: Date.now() })); } catch { } }
function clearS() { try { localStorage.removeItem('ll_s'); } catch { } }
function saveStats(st: any) { try { localStorage.setItem('ll_stats', JSON.stringify(st)); } catch { } }

// ─── Initial State ───
function mkState(): GameState {
  return {
    settings: { idealMin: 30, diff: 3, arrRadius: 50, mode: 'manual', gameMode: 'standard', blindStart: false, blindFinish: true, excludeHost: true, teamsMode: false, elimMode: false, whisperMode: false },
    gameCode: null, isHost: false, myToken: null, myName: 'You', myTeam: null, role: 'navigator',
    hostPlayerToken: null, hostViewActive: true,
    rejoinCode: null, rejoinToken: null, rejoinName: null, rejoinRole: null,
    targetLat: null, targetLon: null, noiseSeed: 0.5, timeLimitSec: 3600, startedAt: null, status: 'idle',
    multiTargets: [], multiCurrent: 0, multiArrived: 0,
    startDist: null, lastDist: null, arrived: false, arrivalElapsed: null, eliminated: false,
    blindStartDist: 0, blindUnlocked: false, blindStartLat: null, blindStartLon: null,
    myLat: null, myLon: null, lastAccuracy: null, prevLat: null, prevLon: null, prevGPSTime: null, speedKmh: 0, speedWarnShown: false,
    myTrail: [], playerTrails: {},
    timerIv: null, whisperIv: null, whisperNext: 0, elimIv: null, nextElimTime: 0, elimRound: 0, dynamicMoveIv: null, dynamicMoveCount: 0,
    hcHistory: [], latestPlayers: {}, soundEnabled: true, screen: 'land', theme: 'light',
  };
}

// ─── Hook ───
export function useGameState() {
  const [state, setState] = useState<GameState>(mkState());
  const sRef = useRef(state); sRef.current = state;

  // Cleanup refs
  const gpsW = useRef<number | null>(null);
  const gpsI = useRef<ReturnType<typeof setInterval> | null>(null);
  const pUnsub = useRef<(() => void) | null>(null);
  const gUnsub = useRef<(() => void) | null>(null);
  const wl = useRef<any>(null);
  const lpB = useRef(-1);
  const lpT = useRef(0);

  // ─── Setters ───
  const setS = useCallback((p: Partial<GameState>) => { setState(prev => { const n = { ...prev, ...p }; sRef.current = n; return n; }); }, []);
  const setScreen = useCallback((screen: Screen) => setS({ screen }), [setS]);
  const updateSettings = useCallback((p: Partial<GameSettings>) => setState(prev => { const n = { ...prev, settings: { ...prev.settings, ...p } }; sRef.current = n; return n; }), []);

  // ─── Toast ───
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const tt = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string, dur = 2800) => { setToastMsg(msg); setShowToast(true); haptic('light'); if (tt.current) clearTimeout(tt.current); tt.current = setTimeout(() => setShowToast(false), dur); }, []);

  // ─── Overlays ───
  const [showArrive, setShowArrive] = useState(false);
  const [showEliminated, setShowEliminated] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [showSpeedWarn, setShowSpeedWarn] = useState(false);
  const [showAbortSheet, setShowAbortSheet] = useState(false);
  const [showQRSheet, setShowQRSheet] = useState(false);

  const toggleTheme = useCallback(() => setState(p => { const t: 'light' | 'dark' = p.theme === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', t); const n = { ...p, theme: t }; sRef.current = n; return n; }), []);
  const toggleSound = useCallback(() => setS({ soundEnabled: !sRef.current.soundEnabled }), [setS]);

  // ─── GPS ───
  const onGPS = useCallback((pos: GeolocationPosition) => {
    const s = sRef.current; const lat = pos.coords.latitude, lon = pos.coords.longitude, now = Date.now();
    if (s.prevLat != null && s.prevLon != null) {
      const dt = (now - (s.prevGPSTime || 0)) / 1000;
      if (dt > 0 && (hav(s.prevLat, s.prevLon, lat, lon) / dt) * 3.6 > 80 && !s.speedWarnShown) { setShowSpeedWarn(true); setS({ speedWarnShown: true }); }
    }
    const trail = [...s.myTrail]; const last = trail[trail.length - 1]; if (!last || hav(last[0], last[1], lat, lon) > 5) trail.push([lat, lon]);
    const bsl = s.settings.blindStart && !s.blindStartLat ? lat : s.blindStartLat;
    const bso = s.settings.blindStart && !s.blindStartLon ? lon : s.blindStartLon;
    setS({ prevLat: lat, prevLon: lon, prevGPSTime: now, myLat: lat, myLon: lon, lastAccuracy: pos.coords.accuracy, myTrail: trail, blindStartLat: bsl, blindStartLon: bso, speedKmh: s.prevLat != null && s.prevLon != null ? (hav(s.prevLat, s.prevLon, lat, lon) / Math.max(1, now - (s.prevGPSTime || now)) * 1000) * 3.6 : 0 });
  }, [setS]);

  const onGPSErr = useCallback((e: GeolocationPositionError) => { toast(e.code === 1 ? 'Enable location access' : 'GPS signal lost'); }, [toast]);

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) { toast('GPS not available'); return; }
    if (!window.isSecureContext) { toast('HTTPS required'); return; }
    gpsW.current = navigator.geolocation.watchPosition(onGPS, onGPSErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    gpsI.current = setInterval(() => navigator.geolocation.getCurrentPosition(onGPS, () => {}, { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }), 1000);
    // Wake lock
    (async () => { if ('wakeLock' in navigator) try { wl.current = await (navigator as any).wakeLock.request('screen'); } catch { } })();
  }, [onGPS, onGPSErr, toast]);

  const stopGPS = useCallback(() => {
    if (gpsW.current != null) { navigator.geolocation.clearWatch(gpsW.current); gpsW.current = null; }
    if (gpsI.current != null) { clearInterval(gpsI.current); gpsI.current = null; }
    try { wl.current?.release(); } catch { } wl.current = null;
  }, []);

  // ─── Firebase Listeners ───
  const startSpecListener = useCallback((code: string) => { onValue(ref(db, `games/${code}/specRequests`), snap => { const raw = snap.val() || {}; setSpecRequests(Object.entries(raw).map(([token, v]: [string, any]) => ({ token, name: v.name, ts: v.ts }))); }); }, []);

  const startListeners = useCallback((code: string) => {
    if (pUnsub.current) return;
    pUnsub.current = onValue(ref(db, `games/${code}/players`), snap => setS({ latestPlayers: snap.val() || {} }));
    startSpecListener(code);
    gUnsub.current = onValue(ref(db, `games/${code}`), snap => {
      if (!snap.exists()) return;
      const g = snap.val(), s = sRef.current;
      if (g.targetLat && (g.targetLat !== s.targetLat || g.targetLon !== s.targetLon)) setS({ targetLat: g.targetLat, targetLon: g.targetLon });
      if (g.multiTargets && !s.multiTargets.length) setS({ multiTargets: g.multiTargets, multiCurrent: 0 });
      if (g.status === 'active' && s.status !== 'active') {
        setS({ status: 'active', startedAt: g.startedAt, targetLat: g.targetLat, targetLon: g.targetLon, noiseSeed: g.noiseSeed, timeLimitSec: g.timeLimitSec, settings: { ...s.settings, arrRadius: g.arrRadius || s.settings.arrRadius } });
        if (s.screen === 'nwait') { setShowCountdown(true); setCountdownNum(3); let n = 3; const tick = () => { n--; if (n >= 0) { setCountdownNum(n); tone(n === 0 ? 880 : 440, 0.08, 0.18); haptic('light'); } if (n < 0) { setShowCountdown(false); haptic('medium'); chimeStart(); const st = sRef.current; if (st.role === 'spectator') setS({ screen: 'spectator' }); else { setS({ screen: 'nactive' }); startGPS(); } return; } setTimeout(tick, 1000); }; setTimeout(tick, 1000); }
      }
      if ((g.status === 'finished' || g.status === 'aborted') && s.status === 'active') {
        setS({ status: g.status });
        const s2 = sRef.current; if (s2.timerIv) clearInterval(s2.timerIv); if (s2.dynamicMoveIv) clearInterval(s2.dynamicMoveIv); if (s2.elimIv) clearInterval(s2.elimIv);
        get(ref(db, `games/${code}/players`)).then(snap => setS({ latestPlayers: snap.val() || {}, screen: 'results' }));
        if (g.status === 'aborted' && !s.isHost) toast('Host ended the game', 2000);
      }
    });
  }, [setS, startGPS, toast]);

  const stopListeners = useCallback(() => {
    const c = sRef.current.gameCode; if (!c) return;
    off(ref(db, `games/${c}/players`)); off(ref(db, `games/${c}`));
    pUnsub.current = null; gUnsub.current = null;
  }, []);

  // ─── Position Update ───
  const sendPos = useCallback(async (_manual = false) => {
    const s = sRef.current;
    if (!s.myToken || !s.myLat || !s.myLon || s.status !== 'active') return;
    if (!s.targetLat || !s.targetLon) return;
    const dist = hav(s.myLat, s.myLon, s.targetLat, s.targetLon);
    const noised = noiseDist(dist, s.noiseSeed);
    const upd: any = { lat: s.myLat, lon: s.myLon, speedKmh: s.speedKmh, lastSeen: serverTimestamp() };
    if (!s.startDist) { upd.startDist = dist; setS({ startDist: dist }); }

    // Arrival
    if (!s.arrived && dist <= s.settings.arrRadius) {
      const elapsed = s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0;
      // Multi-target advance
      if (s.settings.gameMode === 'multi' && s.multiTargets.length > 0 && s.multiCurrent < s.multiTargets.length - 1) {
        const nc = s.multiCurrent + 1;
        setS({ multiCurrent: nc, targetLat: s.multiTargets[nc].lat, targetLon: s.multiTargets[nc].lon, multiArrived: s.multiArrived + 1, startDist: null });
        await update(ref(db, `games/${s.gameCode}`), { targetLat: s.multiTargets[nc].lat, targetLon: s.multiTargets[nc].lon });
        chimeArrive(); haptic('heavy'); toast(`Target ${s.multiArrived + 1}/${s.multiTargets.length} found!`, 3000); return;
      }
      upd.arrived = true; upd.arrSec = elapsed;
      setS({ arrived: true, arrivalElapsed: elapsed });
      await update(ref(db, `games/${s.gameCode}/players/${s.myToken}`), upd);
      chimeArrive(); haptic('heavy'); setShowArrive(true);
      if (!s.settings.blindFinish) { await update(ref(db, `games/${s.gameCode}`), { status: 'finished' }); }
      else {
        const snap = await get(ref(db, `games/${s.gameCode}/players`));
        const allP = snap.val() || {}; const navs = Object.values(allP).filter((p: any) => p.role === 'navigator');
        if (navs.length > 0 && navs.every((p: any) => p.arrived || p.eliminated)) await update(ref(db, `games/${s.gameCode}`), { status: 'finished' });
      }
      return;
    }
    try { await update(ref(db, `games/${s.gameCode}/players/${s.myToken}`), upd); } catch { }
    // Hot/cold history
    const hc = [...s.hcHistory, { dist, ts: Date.now() }]; while (hc.length > 1 && hc[0].ts < Date.now() - 8000) hc.shift();
    setS({ hcHistory: hc, lastDist: noised });
    // Proximity sound (skip for special modes)
    const special = s.settings.gameMode === 'hotcold' || s.settings.gameMode === 'sailor' || s.settings.whisperMode;
    if (!special && !s.settings.blindStart) {
      if (sRef.current.soundEnabled) {
        const idx = PROX_BANDS.findIndex(b => dist < b.max && dist >= b.min); if (idx < 0) return;
        const band = PROX_BANDS[idx]; const now = Date.now();
        if (idx !== lpB.current) { lpB.current = idx; lpT.current = 0; const tones = [0, 330, 440, 550, 660, 880]; tone(tones[idx + 1] || 440, 0.07, band.vol); if (idx >= 3) haptic('light'); return; }
        if (now - lpT.current < band.cd) return; lpT.current = now; tone(band.freq, 0.07, band.vol);
      }
    }
  }, [setS, toast]);

  // ─── Blind Start ───
  const checkBlind = useCallback(() => {
    const s = sRef.current;
    if (!s.settings.blindStart || s.blindUnlocked) return;
    if (s.blindStartLat != null && s.blindStartLon != null && s.myLat != null && s.myLon != null) {
      if (hav(s.blindStartLat, s.blindStartLon, s.myLat, s.myLon) >= 300) {
        setS({ blindUnlocked: true }); tone(523, 0.1, 0.15); setTimeout(() => tone(659, 0.15, 0.18), 100); haptic('medium');
        toast('Distance unlocked \u2014 you\'ve moved 300m from start', 2500);
      }
    }
  }, [setS, toast]);

  // ─── Create Game ───
  const createGame = useCallback(async () => {
    let code = randCode(); let snap = await get(ref(db, `games/${code}`)); if (snap.exists()) code = randCode();
    const noiseSeed = Math.random(); const s = sRef.current.settings;
    const timeLimitSec = Math.round(s.idealMin * DIFFICULTY.mult[s.diff] * 60);
    const isMulti = s.gameMode === 'multi';
    await set(ref(db, `games/${code}`), { status: 'lobby', idealMin: s.idealMin, diff: s.diff, arrRadius: s.arrRadius, timeLimitSec, noiseSeed, hostRole: 'spectator', elimMode: s.elimMode, blindStart: s.blindStart, blindFinish: s.blindFinish, excludeHost: s.excludeHost, gameMode: s.gameMode, whisperMode: s.whisperMode, teamsMode: s.teamsMode, targetLat: null, targetLon: null, startedAt: null, multiTargets: isMulti ? [] : null, multiCount: isMulti ? 3 : null, createdAt: serverTimestamp() });
    return { code, noiseSeed, timeLimitSec };
  }, []);

  // ─── Smart Target ───
  const findSmartTarget = useCallback(async (myLat: number, myLon: number, idealKm: number) => {
    const minKm = idealKm * 0.82, maxKm = idealKm * 1.12;
    for (const searchR of [1200, 1500, 2000]) {
      for (let a = 0; a < 5; a++) {
        const bear = Math.random() * 360, rad = bear * Math.PI / 180;
        const cLat = myLat + (idealKm / 111) * Math.cos(rad);
        const cLon = myLon + (idealKm / (111 * Math.cos(myLat * Math.PI / 180))) * Math.sin(rad);
        const q = `[out:json][timeout:14];(way[highway~"^(living_street|residential|unclassified|tertiary|service)$"][access!~"^(private|no|customers|permit|military|restricted|destination|delivery)$"][motor_vehicle!~"^(no|private)$"](around:${searchR},${cLat.toFixed(5)},${cLon.toFixed(5)}););out geom 50;`;
        try {
          const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
          const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctrl.signal });
          clearTimeout(t); if (!res.ok) continue;
          const data = await res.json();
          const ways = (data.elements || []).filter((w: any) => { const t = w.tags || {}; return !t.barrier && (!t.access || !/private|no|customers|permit|military|restricted|destination|delivery/i.test(t.access)); });
          if (!ways.length) continue;
          const hw: Record<string, number> = { living_street: 0, residential: 1, unclassified: 2, tertiary: 3, service: 4 };
          ways.sort((a: any, b: any) => (hw[a.tags?.highway] ?? 9) - (hw[b.tags?.highway] ?? 9));
          const pool: Array<{ lat: number; lon: number }> = [];
          for (const w of ways.slice(0, 8)) { const g = w.geometry || []; if (!g.length) continue; pool.push({ lat: g[g.length - 1].lat, lon: g[g.length - 1].lon }); pool.push({ lat: g[0].lat, lon: g[0].lon }); if (g.length > 2) { const m = g[Math.floor(g.length / 2)]; pool.push({ lat: m.lat, lon: m.lon }); } }
          const valid = pool.filter(n => { const d = hav(myLat, myLon, n.lat, n.lon) / 1000; return d >= minKm && d <= maxKm; });
          if (valid.length) return valid[Math.floor(Math.random() * valid.length)];
        } catch { }
      }
    }
    const br = Math.random() * 360, r = br * Math.PI / 180;
    return { lat: myLat + (idealKm / 111) * Math.cos(r), lon: myLon + (idealKm / (111 * Math.cos(myLat * Math.PI / 180))) * Math.sin(r) };
  }, []);

  // ─── Lock & Start ───
  const lockStart = useCallback(async () => {
    const s = sRef.current; if (!s.targetLat) { toast('Set a target first'); return; }
    const tok = randToken();
    await update(ref(db, `games/${s.gameCode}`), { status: 'active', startedAt: serverTimestamp() });
    setS({ myToken: tok, hostPlayerToken: tok });
    await update(ref(db, `games/${s.gameCode}/players/${tok}`), { name: s.myName.slice(0, 32), role: 'spectator', lat: null, lon: null, speedKmh: 0, arrived: false, eliminated: false, arrSec: null, startDist: null, joinedAt: serverTimestamp(), lastSeen: serverTimestamp() });
    saveS(s.gameCode, tok, s.myName, 'spectator');
    const snap = await get(ref(db, `games/${s.gameCode}`)); const g = snap.val();
    // Countdown
    setShowCountdown(true); setCountdownNum(3); let n = 3;
    const tick = () => {
      n--; if (n >= 0) { setCountdownNum(n); tone(n === 0 ? 880 : 440, 0.08, 0.18); haptic('light'); }
      if (n < 0) {
        setShowCountdown(false); haptic('medium'); chimeStart();
        setS({ screen: 'hactive', status: 'active', startedAt: g.startedAt, hostViewActive: true });
        // Dynamic: move target every 3 min
        if (s.settings.gameMode === 'dynamic') {
          const iv = setInterval(() => { const st = sRef.current; if (st.status !== 'active') return; const b = Math.random() * 360 * Math.PI / 180; const sm = 50 + Math.random() * 50; const nl = (st.targetLat || 0) + (sm / 111000) * Math.cos(b); const no = (st.targetLon || 0) + (sm / (111000 * Math.cos((st.targetLat || 0) * Math.PI / 180))) * Math.sin(b); setS({ targetLat: nl, targetLon: no, dynamicMoveCount: st.dynamicMoveCount + 1 }); update(ref(db, `games/${st.gameCode}`), { targetLat: nl, targetLon: no }); toast('Target moved!', 2500); tone(440, 0.1, 0.1); }, 3 * 60 * 1000);
          setS({ dynamicMoveIv: iv });
        }
        // Elimination: cull furthest every 5 min
        if (s.settings.elimMode) {
          const iv = setInterval(async () => { const st = sRef.current; if (st.status !== 'active') return; try { const ps = await get(ref(db, `games/${st.gameCode}/players`)); const all = ps.val() || {}; const entries = Object.entries(all).filter(([, p]: [string, any]) => p.role === 'navigator' && !p.arrived && !p.eliminated); if (entries.length <= 1) return; let furthest: [string, any] | null = null, maxD = -1; entries.forEach(([id, p]: [string, any]) => { if (p.lat && p.lon && st.targetLat && st.targetLon) { const d = hav(p.lat, p.lon, st.targetLat, st.targetLon); if (d > maxD) { maxD = d; furthest = [id, p]; } } }); if (furthest) { await update(ref(db, `games/${st.gameCode}/players/${furthest[0]}`), { eliminated: true, eliminatedAt: Date.now() }); const ps2 = await get(ref(db, `games/${st.gameCode}/players`)); const rem = Object.values(ps2.val() || {}).filter((p: any) => p.role === 'navigator' && !p.arrived && !p.eliminated); if (rem.length <= 1) await update(ref(db, `games/${st.gameCode}`), { status: 'finished' }); } } catch { } }, 5 * 60 * 1000);
          setS({ elimIv: iv });
        }
        return;
      }
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);
  }, [setS, toast]);

  // ─── Join ───
  const joinGame = useCallback(async (code: string, name: string, role: Role = 'navigator', team?: 'red' | 'blue' | null) => {
    if (!code) { toast('Enter a game code'); return false; }
    try {
      const snap = await get(ref(db, `games/${code}`)); if (!snap.exists()) throw new Error('Game not found');
      const g = snap.val(); if (g.status === 'aborted') throw new Error('Game has ended'); if (g.status === 'finished') throw new Error('Game already finished');
      const tok = randToken();
      setS({ gameCode: code, myName: name, myToken: tok, role, timeLimitSec: g.timeLimitSec, noiseSeed: g.noiseSeed, settings: { ...sRef.current.settings, arrRadius: g.arrRadius || 50, gameMode: g.gameMode || 'standard', elimMode: !!g.elimMode, blindStart: !!g.blindStart, blindFinish: g.blindFinish !== false, excludeHost: g.excludeHost !== false, whisperMode: !!g.whisperMode, teamsMode: !!g.teamsMode } });
      localStorage.setItem('ll_nickname', name);
      if (role === 'spectator') { await set(ref(db, `games/${code}/players/${tok}`), { name: name.slice(0, 32), role: 'spectator', lat: null, lon: null, speedKmh: 0, arrived: false, eliminated: false, arrSec: null, startDist: null, specApproved: false, joinedAt: serverTimestamp(), lastSeen: serverTimestamp() }); await set(ref(db, `games/${code}/specRequests/${tok}`), { name: name.slice(0, 32), ts: serverTimestamp() }); }
      else { await set(ref(db, `games/${code}/players/${tok}`), { name: name.slice(0, 32), role: 'navigator', team: team || null, lat: null, lon: null, speedKmh: 0, arrived: false, eliminated: false, arrSec: null, startDist: null, joinedAt: serverTimestamp(), lastSeen: serverTimestamp() }); }
      saveS(code, tok, name, role); chimeJoin(); haptic('medium'); startListeners(code);
      if (g.status === 'active') { if (role === 'spectator') setS({ screen: 'spectator', status: 'active', startedAt: g.startedAt, targetLat: g.targetLat, targetLon: g.targetLon }); else { setS({ screen: 'nactive', status: 'active', startedAt: g.startedAt, targetLat: g.targetLat, targetLon: g.targetLon }); startGPS(); } }
      else setS({ screen: role === 'spectator' ? 'spectator' : 'nwait' });
      return true;
    } catch (e: any) { toast(e.message); return false; }
  }, [setS, toast, startListeners, startGPS]);

  // ─── Actions ───
  const goHome = useCallback(() => { stopGPS(); stopListeners(); clearS(); const t = sRef.current.theme; setState(mkState()); sRef.current = mkState(); setS({ theme: t }); }, [setS, stopGPS, stopListeners]);
  const abortGame = useCallback(async () => { const s = sRef.current; await update(ref(db, `games/${s.gameCode}`), { status: 'aborted' }); if (s.timerIv) clearInterval(s.timerIv); if (s.dynamicMoveIv) clearInterval(s.dynamicMoveIv); if (s.elimIv) clearInterval(s.elimIv); stopGPS(); }, [stopGPS]);
  const dismissSpeed = useCallback(() => setShowSpeedWarn(false), []);
  const showResults = useCallback(() => { setShowArrive(false); setS({ screen: 'results' }); }, [setS]);
  const toggleMyView = useCallback(() => setState(p => { const hv = !p.hostViewActive; const n = { ...p, hostViewActive: hv, screen: (hv ? 'hactive' : 'nactive') as Screen }; sRef.current = n; return n; }), []);
  const goHostView = useCallback(() => setS({ screen: 'hactive', hostViewActive: true }), [setS]);

  // ─── Spectator Approval ───
  const [specRequests, setSpecRequests] = useState<Array<{ token: string; name: string; ts: number }>>([]);
  const approveSpec = useCallback(async (token: string) => { const s = sRef.current; if (!s.gameCode) return; await update(ref(db, `games/${s.gameCode}/players/${token}`), { specApproved: true }); await update(ref(db, `games/${s.gameCode}/specRequests/${token}`), null as any); tone(523, 0.1, 0.15); haptic('medium'); }, []);
  const denySpec = useCallback(async (token: string) => { const s = sRef.current; if (!s.gameCode) return; await update(ref(db, `games/${s.gameCode}/players/${token}`), null as any); await update(ref(db, `games/${s.gameCode}/specRequests/${token}`), null as any); haptic('light'); }, []);

  // ─── Map Orientation ───
  const [mapOrientHost, setMapOrientHost] = useState(false);
  const [mapOrientSpec, setMapOrientSpec] = useState(false);
  const toggleMapOrient = useCallback((which: 'host' | 'spec') => { if (which === 'host') setMapOrientHost(p => !p); else setMapOrientSpec(p => !p); }, []);

  // ─── Rejoin ───
  const checkRejoin = useCallback(() => { try { const raw = localStorage.getItem('ll_s'); if (!raw) return; const { code, token, name, role, ts } = JSON.parse(raw); if (!code || !token || Date.now() - ts > 4 * 3600 * 1000) { clearS(); return; } get(ref(db, `games/${code}/status`)).then(snap => { const st = snap.val(); if (st === 'active' || st === 'lobby') setS({ rejoinCode: code, rejoinToken: token, rejoinName: name, rejoinRole: role }); else clearS(); }).catch(() => {}); } catch { } }, [setS]);
  const doRejoin = useCallback(async () => { const s = sRef.current; if (!s.rejoinCode || !s.rejoinToken) return; try { const snap = await get(ref(db, `games/${s.rejoinCode}`)); if (!snap.exists()) { toast('Game no longer exists'); clearS(); return; } const g = snap.val(); if (g.status !== 'active' && g.status !== 'lobby') { toast('Game has ended'); clearS(); return; } setS({ gameCode: s.rejoinCode, myToken: s.rejoinToken, myName: s.rejoinName || 'You', role: s.rejoinRole || 'navigator', screen: g.status === 'active' ? 'nactive' : 'nwait', status: g.status === 'active' ? 'active' : 'idle', startedAt: g.startedAt, targetLat: g.targetLat, targetLon: g.targetLon, timeLimitSec: g.timeLimitSec, noiseSeed: g.noiseSeed }); startListeners(s.rejoinCode); if (g.status === 'active') startGPS(); toast('Rejoined game ' + s.rejoinCode); } catch { } }, [setS, toast, startListeners, startGPS]);
  const dismissRejoin = useCallback(() => { setS({ rejoinCode: null, rejoinToken: null }); clearS(); }, [setS]);

  // ─── Stats ───
  const saveGameStats = useCallback((elapsed: number, won: boolean) => { const st = loadStats(); st.games++; if (won) st.wins++; if (elapsed && (!st.bestTime || elapsed < st.bestTime)) st.bestTime = elapsed; const trail = sRef.current.myTrail; if (trail.length > 1) { let walked = 0; for (let i = 1; i < trail.length; i++) walked += hav(trail[i - 1][0], trail[i - 1][1], trail[i][0], trail[i][1]); if (sRef.current.startDist && walked > 0) { st.totalEff += Math.round((sRef.current.startDist / walked) * 100); st.effCount++; } st.totalDist += walked; } saveStats(st); }, []);
  const loadStats = useCallback(() => { try { const r = localStorage.getItem('ll_stats'); if (r) return JSON.parse(r); } catch { } return { games: 0, wins: 0, bestTime: null, totalEff: 0, effCount: 0, totalDist: 0 }; }, []);

  // ─── Init ───
  useEffect(() => {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) { document.documentElement.setAttribute('data-theme', 'dark'); setS({ theme: 'dark' }); }
    if (navigator.geolocation && window.isSecureContext) navigator.geolocation.getCurrentPosition(p => setS({ myLat: p.coords.latitude, myLon: p.coords.longitude }), () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
    const saved = localStorage.getItem('ll_nickname'); if (saved) setS({ myName: saved });
    const jc = new URLSearchParams(location.search).get('join'); if (jc) { setS({ gameCode: jc }); setScreen('join'); }
    setTimeout(checkRejoin, 800);
    return () => { stopGPS(); stopListeners(); };
  }, []);

  return {
    state, setState, setS, updateSettings, setScreen,
    toggleTheme, toggleSound,
    toast, toastMsg, showToast,
    showArrive, setShowArrive, showEliminated, setShowEliminated,
    showCountdown, setShowCountdown, countdownNum,
    showSpeedWarn, setShowSpeedWarn,
    showAbortSheet, setShowAbortSheet,
    showQRSheet, setShowQRSheet,
    createGame, findSmartTarget,
    lockStart, joinGame, goHome,
    sendPos, checkBlind,
    abortGame, dismissSpeed,
    showResults, toggleMyView, goHostView,
    specRequests, approveSpec, denySpec,
    mapOrientHost, mapOrientSpec, toggleMapOrient,
    checkRejoin, doRejoin, dismissRejoin,
    startGPS, stopGPS, startListeners, stopListeners,
    saveGameStats, loadStats,
  };
}
