# Luftlinie

**A GPS navigation game.** Find your way to a hidden target without turn-by-turn directions. Distance is your only guide.

Play it live: [https://fq5e2fnh37m6u.kimi.page](https://fq5e2fnh37m6u.kimi.page)

---

## How to Play

1. **Host a Game** — Set your preferred distance, game mode, and target placement method (manual or smart). Share the 6-letter code with friends.
2. **Join a Game** — Enter the code and your name to join as a navigator (or spectator).
3. **Find the Target** — Use the distance readout to guide yourself toward the hidden location. No maps, no arrows, just your instincts.
4. **Win** — First to reach the arrival radius wins (or survive elimination, or find all 3 targets... depending on the mode).

---

## Game Modes

| Mode | Description |
|------|-------------|
| **Standard** | Distance always visible. Race to the target. |
| **Elimination** | Furthest player eliminated every 5 minutes. |
| **Whisper** | Distance revealed once per minute for 3 seconds. |
| **Hot & Cold** | No distance — fire/ice tells you if you're getting closer. |
| **Sailor** | Compass needle points to target. No distance shown. |
| **Multi-Target** | Find 3 sequential targets to win. |
| **Dynamic** | Target moves to a new location every 3 minutes. |

---

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Leaflet (maps)
- Firebase Realtime Database (multiplayer sync)
- QRCode.js (game sharing)

---

## Deploy to GitHub Pages

```bash
# Install dependencies
npm install

# Build
npm run build

# The dist/ folder is ready for GitHub Pages
# Uses HashRouter for client-side routing compatibility
```

---

## Development

```bash
npm install
npm run dev
```

---

## Firebase Setup

The app uses Firebase Realtime Database for live multiplayer state synchronization. The database URL is configured in `src/hooks/useGameState.ts`.

---

## License

MIT
