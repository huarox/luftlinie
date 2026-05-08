// ─── Game Types ───
// Luftlinie - Apple Acquisition Edition
// All game modes, roles, and state definitions

export type GameMode =
  | 'standard'    // Race to target, distance always visible
  | 'elimination' // Furthest player eliminated every 5 min
  | 'whisper'     // Distance revealed only once per minute
  | 'hotcold'     // No distance - hot/warm/cold indicator only
  | 'sailor'      // Compass points to target, no distance
  | 'multi'       // 3 targets in sequence
  | 'dynamic';    // Target moves every 3 minutes

export type TargetMode = 'manual' | 'smart';
export type Role = 'navigator' | 'spectator';
export type Team = 'red' | 'blue' | null;
export type GameStatus = 'idle' | 'lobby' | 'active' | 'finished' | 'aborted';
export type Screen =
  | 'land'       // Welcome / Home
  | 'setup'      // Game configuration wizard
  | 'hostrole'   // Host chooses their role
  | 'map'        // Target placement
  | 'hlobby'     // Host lobby
  | 'hactive'    // Host spectator view
  | 'spectator'  // Player spectator view
  | 'join'       // Join game
  | 'nwait'      // Navigator waiting
  | 'nactive'    // Navigator playing
  | 'results';   // Game results

// ─── Settings ───
export interface GameSettings {
  idealMin: number;      // Ideal drive time in minutes (10-90)
  diff: number;          // Difficulty 1-5 (affects time limit multiplier)
  arrRadius: number;     // Arrival radius in meters (25, 50, 100, 200)
  mode: TargetMode;      // 'manual' or 'smart' target placement
  gameMode: GameMode;    // One of 7 game modes
  blindStart: boolean;   // Hide distance until 300m from start moved
  blindFinish: boolean;  // Don't end game on first arrival
  excludeHost: boolean;  // Hide host from results
  teamsMode: boolean;    // Enable red vs blue teams
  elimMode: boolean;     // Enable elimination (auto-true for elimination mode)
  whisperMode: boolean;  // Reveal distance once/minute (auto-true for whisper mode)
}

// ─── Player ───
export interface Player {
  id: string;
  name: string;
  role: Role;
  team?: Team;
  lat?: number;
  lon?: number;
  speedKmh?: number;
  arrived?: boolean;
  eliminated?: boolean;
  eliminatedAt?: number;   // Timestamp when eliminated (for elimination mode)
  elimRound?: number;      // Which elimination round (1, 2, 3...)
  arrSec?: number;         // Seconds from start to arrival
  startDist?: number;      // Initial distance to target
  specApproved?: boolean;  // For spectator join requests
  lastSeen?: number;       // Last position update timestamp
}

// ─── Game State ───
export interface GameState {
  // ── Identity ──
  settings: GameSettings;
  gameCode: string | null;
  isHost: boolean;
  myToken: string | null;
  myName: string;
  myTeam: Team;
  role: Role;
  hostPlayerToken: string | null;
  hostViewActive: boolean;

  // ── Rejoin ──
  rejoinCode: string | null;
  rejoinToken: string | null;
  rejoinName: string | null;
  rejoinRole: Role | null;

  // ── Target ──
  targetLat: number | null;
  targetLon: number | null;
  noiseSeed: number;
  timeLimitSec: number;
  startedAt: number | null;
  status: GameStatus;

  // ── Multi-target ──
  multiTargets: Array<{ lat: number; lon: number }>;
  multiCurrent: number;
  multiArrived: number;

  // ── Navigation state ──
  startDist: number | null;
  lastDist: number | null;
  arrived: boolean;
  arrivalElapsed: number | null;
  eliminated: boolean;

  // ── Blind start ──
  blindStartDist: number;
  blindUnlocked: boolean;
  blindStartLat: number | null;
  blindStartLon: number | null;

  // ── GPS ──
  myLat: number | null;
  myLon: number | null;
  lastAccuracy: number | null;
  prevLat: number | null;
  prevLon: number | null;
  prevGPSTime: number | null;
  speedKmh: number;
  speedWarnShown: boolean;

  // ── Trails ──
  myTrail: Array<[number, number]>;
  playerTrails: Record<string, Array<[number, number]>>;

  // ── Timers ──
  timerIv: ReturnType<typeof setInterval> | null;
  whisperIv: ReturnType<typeof setInterval> | null;
  whisperNext: number;
  elimIv: ReturnType<typeof setInterval> | null;
  nextElimTime: number;
  elimRound: number;
  dynamicMoveIv: ReturnType<typeof setInterval> | null;
  dynamicMoveCount: number;

  // ── Hot/Cold ──
  hcHistory: Array<{ dist: number; ts: number }>;

  // ── Players ──
  latestPlayers: Record<string, Player>;

  // ── Preferences ──
  soundEnabled: boolean;

  // ── Navigation ──
  screen: Screen;

  // ── Theme ──
  theme: 'light' | 'dark';
}

// ─── Constants ───

export const DIFFICULTY = {
  labels: ['', 'Easy', 'Normal', 'Medium', 'Hard', 'Expert'],
  mult: [0, 3, 2.5, 2, 1.5, 1.2],
  descs: [
    '',
    '3\u00d7 the ideal drive time',
    '2.5\u00d7 the ideal drive time',
    '2\u00d7 the ideal drive time',
    '1.5\u00d7 the ideal drive time',
    '1.2\u00d7 the ideal drive time',
  ],
};

export const MODE_INFO: Record<GameMode, {
  icon: string;
  name: string;
  desc: string;
  short: string;
  color: string;
  detail: string;
}> = {
  standard: {
    icon: '\u26f3',
    name: 'Standard',
    desc: 'Race to the target',
    short: 'First to arrive wins',
    color: '#007AFF',
    detail: 'Distance to target is always visible. First player to reach the arrival radius wins.',
  },
  elimination: {
    icon: '\u26a1',
    name: 'Elimination',
    desc: 'Survive the cull',
    short: 'Furthest player eliminated every 5 min',
    color: '#FF9500',
    detail: 'Every 5 minutes, the player furthest from the target is eliminated. Last navigator standing wins.',
  },
  whisper: {
    icon: '\ud83e\udd10',
    name: 'Whisper',
    desc: 'Hear the distance once per minute',
    short: 'Distance revealed once per minute',
    color: '#AF52DE',
    detail: 'Your distance to target is hidden most of the time. Every 60 seconds, it is revealed for 3 seconds.',
  },
  hotcold: {
    icon: '\ud83c\udf21\ufe0f',
    name: 'Hot & Cold',
    desc: 'Feel your way there',
    short: 'No distance - just hot or cold',
    color: '#FF3B30',
    detail: 'No distance is shown. Move around and watch the indicator \u2014 fire means getting closer, ice means moving away.',
  },
  sailor: {
    icon: '\u2638',
    name: 'Sailor',
    desc: 'Follow the compass',
    short: 'Compass needle points to target',
    color: '#5AC8FA',
    detail: 'A compass needle always points toward the target. No distance shown \u2014 navigate by direction alone.',
  },
  multi: {
    icon: '\ud83c\udfaf',
    name: 'Multi-Target',
    desc: 'Find 3 targets to win',
    short: '3 sequential targets',
    color: '#5856D6',
    detail: 'Three hidden targets at increasing distances. Reach all three to win. Use Smart mode for auto-placement.',
  },
  dynamic: {
    icon: '\ud83d\udd04',
    name: 'Dynamic',
    desc: 'The target moves',
    short: 'Target shifts every 3 minutes',
    color: '#FFCC00',
    detail: 'The target moves to a new nearby location every 3 minutes. You must keep adapting \u2014 never fully settle.',
  },
};

export const PCOLS = [
  '#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE',
  '#5AC8FA', '#FFCC00', '#5856D6', '#FF6482', '#01C7BE',
];

export const HOME = { lat: 48.210, lon: 16.363 };

// ─── Math Utilities ───

export function hav(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371000;
  const dL = (la2 - la1) * Math.PI / 180;
  const dO = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dO / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.max(0, a)));
}

export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function fmtDist(m: number | null): string {
  if (m == null || isNaN(m)) return '\u2014';
  if (m >= 10000) return (m / 1000).toFixed(1);
  if (m >= 1000) return (m / 1000).toFixed(2);
  return Math.round(m).toString();
}

export function distUnit(m: number | null): string {
  return !m || m >= 1000 ? 'km' : 'm';
}

export function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function noiseDist(dist: number, seed: number): number {
  return Math.max(0, dist + (seed - 0.5) * 60);
}

export function randCode(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

export function randToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!window.navigator?.vibrate) return;
  const p = { light: 10, medium: 20, heavy: [30, 10, 30] as number[] };
  navigator.vibrate(p[style] || 10);
}

// Proximity bands for sound feedback
export const PROX_BANDS = [
  { max: 2000, min: 1000, freq: 400, vol: 0.07, cd: 8000 },
  { max: 1000, min: 500, freq: 520, vol: 0.09, cd: 6000 },
  { max: 500, min: 250, freq: 660, vol: 0.11, cd: 4000 },
  { max: 250, min: 100, freq: 784, vol: 0.13, cd: 2500 },
  { max: 100, min: 0, freq: 988, vol: 0.15, cd: 1500 },
];
