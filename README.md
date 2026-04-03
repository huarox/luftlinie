<p align="center">
  <img src="logo.svg" alt="Luftlinie" width="120" height="120" style="border-radius: 22px;">
</p>

<h1 align="center">Luftlinie</h1>

<p align="center"><strong>You know how far. You don't know where.</strong></p>

<p align="center">
  Luftlinie is a real-world multiplayer navigation game. Players race to find a secret target using only distance feedback — no map, no compass, just the number getting smaller.
</p>

<p align="center">
  <a href="https://huarox.github.io/luftlinie/">Play Now</a> •
  <a href="#features">Features</a> •
  <a href="#game-modes">Game Modes</a> •
  <a href="#technical">Technical</a>
</p>

---

Luftlinie (German: *as the crow flies*) is a real-world multiplayer navigation game. Players drive to a hidden target knowing only the straight-line distance to it — updated live via GPS. No map. No compass. No route. Just the number getting smaller.

→ **Play at [huarox.github.io/luftlinie](https://huarox.github.io/luftlinie/)**

---

## How It Works

The **host** picks a secret target location and shares a 6-character game code. **Navigators** join on their phones and start driving. The only feedback is a single large number — the straight-line distance — which updates in real-time via GPS.

**Spectators** watch a live map with colour-coded routes for each player.

> The core tension: you can only figure out which direction to go by moving and watching the number change.

---

## Features

- 🎯 **Manual or Smart target placement** — tap the map yourself, or let the algorithm pick a real road at the right distance
- 🧭 **Live GPS distance** — straight-line, updated continuously, reliable on both iOS and Android
- 👁 **Spectator mode** — full live map with driving routes per player, colour-coded, updating as players move
- ⚡ **Elimination mode** — furthest player knocked out every 5 minutes
- 🎯 **Multi-Target mode** — 3 hidden targets at increasing distances; find them all to win
- 🔄 **Dynamic Target mode** — target moves every 3 minutes; you must keep adjusting
- 👂 **Whisper mode** — distance hidden most of the time, revealed for 8 seconds once per minute
- 🌡️ **Hot & Cold mode** — no distance shown; velocity-based pulse feedback tells you if you're getting warmer
- 🧭 **Sailor mode** — compass needle always points toward the target; pure directional navigation
- 🙈 **Blind start** — distance stays hidden until you've moved 300m straight-line from your start
- 🏁 **Blind finish** — game continues after first arrival so everyone can finish
- 👻 **Exclude host** — hide the host from the results leaderboard
- 🔴🔵 **Teams mode** — Red vs Blue, first team with a member at the target wins
- 🔊 **Proximity sounds** — subtle tones as you close in, a chime on arrival — all toggleable
- ⏱ **Server-synced timer** — anchored to Firebase's server timestamp, no drift between devices
- 🔒 **Anti-cheat noise** — deterministic ±30m offset applied consistently across all players
- 🌙 **Dark mode** — automatic system dark mode support
- 📱 **Mobile-first** — designed for iPhone, works on any modern mobile browser
- 🔥 **Real-time** — Firebase Realtime Database, instant updates, no polling
- 📲 **PWA** — installable to home screen for best experience
- 🔄 **Rejoin** — reconnect to an active game after a page reload (4-hour window)
- 📤 **Share result card** — generate a vertical shareable image of the final leaderboard
- ▶ **Route replay** — watch all player trails animate on the results map
- 📊 **Persistent stats** — tracks your games, wins, best time, and average efficiency across sessions
- 🔋 **Battery & offline detection** — warnings for low battery and connection loss

---

## Gameplay

### Settings

| Setting | Options | Default |
|---|---|---|
| Target mode | Manual / Smart | Manual |
| Difficulty | ★ Easy → ★★★★★ Expert | ★★★ Medium |
| Ideal drive time | 10–90 min | 30 min |
| Arrival radius | 25 / 50 / 100 / 200 m | 50 m |
| Blind start | On / Off | Off |
| Blind finish | On / Off | On |
| Exclude host | On / Off | On |
| Teams | On / Off | Off |

**Time limit = ideal drive time × difficulty multiplier**

| Difficulty | Multiplier |
|---|---|
| Easy | 3× |
| Normal | 2.5× |
| Medium | 2× |
| Hard | 1.5× |
| Expert | 1.2× |

### Game modes

| Mode | Description |
|---|---|
| 🎯 **Standard** | Race to the target. First to arrive wins. |
| ⚡ **Elimination** | Every 5 minutes the player furthest from the target is eliminated. Last one standing wins. |
| 👂 **Whisper** | Distance is hidden most of the time and revealed dramatically for 8 seconds once per minute. |
| 🌡️ **Hot & Cold** | No distance shown at all. A pulsing ring gives velocity-based feedback: **HOT** when closing fast, **COLD** when moving away, **Same** when stationary. Navigate by feel. |
| 🧭 **Sailor** | A compass needle always points toward the target. No distance, no proximity info — pure directional navigation. Hold the phone flat and follow the red tip. |
| 🎯 **Multi-Target** | 3 hidden targets at increasing distances. Find the first, get a new distance to the second, and so on. First to complete all 3 wins. |
| 🔄 **Dynamic** | The target moves 50–100m in a random direction every 3 minutes. You must keep adjusting — never fully lock on. |

### Distance display

Always straight-line (Haversine). Never driving distance.

```
≥ 10 000 m  →  X.X KM
1 000–9 999 m  →  X.XX KM
< 1 000 m  →  XXX M
```

In Standard mode, colour shifts from neutral → orange (< 1 km) → green (< 200 m) as you close in.

In Whisper mode the distance is hidden except during timed reveals. In Hot & Cold, Sailor, and Dynamic modes, no distance is shown at all. In Multi-Target mode, the eyebrow shows which target you're on ("Target 1/3").

### GPS indicator

| State | Colour | Meaning |
|---|---|---|
| Live | Green | Accuracy ≤ 50 m |
| ~Xm | Orange | Accuracy > 50 m |
| Blocked | Red | Denied or lost |

### Ripple animation

Behind the distance number, rings pulse outward on every GPS event:

| Event | Colour |
|---|---|
| Auto GPS update, good accuracy | Blue |
| Auto GPS update, poor accuracy | Yellow |
| GPS error | Red |
| Manual refresh — success | Green |
| Manual refresh — failed | Red |

---

## Game Modes In Detail

### Multi-Target

Three hidden targets are placed at increasing distances from your start point (approximately 60%, 100%, and 140% of the ideal drive time distance). In Smart mode, the algorithm generates all 3 targets automatically. In Manual mode, you place the first target and the other 2 are generated at different bearings.

When you arrive at a target, a toast announces "Target 1/3 found! Next target set" and a new distance appears. The first player to find all 3 targets wins. The eyebrow on the navigator screen shows which target you're currently pursuing.

### Dynamic

The target position moves 50–100m in a random direction every 3 minutes. Both the host and players receive the updated position via Firebase. A toast and sound effect notify all players when the target moves.

This mode is impossible to "lock onto" — you must continuously drive toward where the target *was* and adjust as it shifts.

### Hot & Cold

The feedback is based on your **rate of distance change** over the last ~8 seconds — not your absolute position. This means:

- **Standing still** → neutral pulse regardless of where you are
- **Walking toward the target** → pulse speeds up and turns red (HOT)
- **Walking away** → pulse slows down and turns blue (COLD)
- **Turning around** → instant feedback switch

| Label | Meaning |
|---|---|
| **HOT** | Closing fast (> 1.5 m/s) |
| **Warmer** | Closing moderately (0.5–1.5 m/s) |
| **Same** | Stationary or drifting (< 0.5 m/s) |
| **Cooler** | Moving away slowly (0.5–1.5 m/s) |
| **COLD** | Moving away fast (> 1.5 m/s) |

### Sailor

A frosted-glass compass face with a single needle. The red tip always points toward the hidden target, regardless of which way you're holding the phone. Works like a normal compass, except "north" has been replaced by the target.

**How it works:**
1. The app computes the absolute bearing from your position to the target
2. Your device's compass heading is read from the hardware sensor
3. The needle angle = target bearing − device heading
4. The needle rotates via CSS to always point at the target

No distance is shown. No proximity feedback. Pure directional navigation.

### Whisper

The distance number stays hidden as dashes. Once per minute it dramatically reveals for 8 seconds, then vanishes again. A countdown in the game bar shows when the next reveal will happen.

---

## Results and sharing

After the game ends, a results screen shows:

- **Winner** — with a mode-appropriate subtitle
- **Stats grid** — distance, best time, player count
- **Leaderboard** — all players sorted by arrival time, with colour-coded dots and team tags in teams mode
- **Route stats** — your walked distance, efficiency (%), and rank
- **Share card** — a vertical (600×800) image with map snapshot, game mode badge, stats, and leaderboard, ready to share on social media
- **Route replay** — animated replay of all player trails on the map

**Persistent stats** are tracked in localStorage across sessions: games played, wins, best time, average efficiency, and total distance walked. Access them from the landing page.

---

## Smart target algorithm

When Smart mode is selected, the Overpass API is queried for publicly accessible roads near the ideal drive distance:

- **Road types:** residential, service, unclassified, living_street, tertiary
- **Excluded:** private/restricted access, motor_vehicle = no/private, any barrier tag
- **Acceptance band:** 82–112% of the ideal straight-line distance
- **Preference:** dead-ends and cul-de-sacs over through-roads
- **Attempts:** 5 random bearings before falling back to a geometric point

---

## Technical stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, single HTML file |
| Database | Firebase Realtime Database |
| Hosting | GitHub Pages |
| Maps | Leaflet 1.9.4 + CartoDB tiles |
| Routing | OSRM public API |
| Road data | OpenStreetMap via Overpass API |

No build step. No framework. No server to maintain.

---

## Running your own instance

The entire game is one HTML file. To host your own copy:

**1. Create a Firebase Realtime Database**

Go to [console.firebase.google.com](https://console.firebase.google.com), create a project, enable Realtime Database in test mode, and copy your web app config.

**2. Edit the file**

Open `index.html` in any text editor. Find the `FIREBASE_CONFIG` block near the top of the script and replace the values with your real ones:

```js
const FIREBASE_CONFIG = {
  apiKey:            "your-api-key",
  authDomain:        "your-project.firebaseapp.com",
  databaseURL:       "https://your-project-default-rtdb.region.firebasedatabase.app",
  projectId:         "your-project",
  storageBucket:     "your-project.firebasestorage.app",
  messagingSenderId: "your-sender-id",
  appId:             "your-app-id"
};
```

**3. Host the file**

Upload `index.html` to any static host that serves HTTPS — GitHub Pages, Netlify, or Vercel all work. GPS requires HTTPS and will not work on plain HTTP.

For GitHub Pages: create a public repository, upload the file, go to Settings → Pages, set the source to the main branch root, and save. Your URL will be `https://yourusername.github.io/yourrepo/`.

---

## Playing over a hotspot

Works without any special setup. Enable your phone's hotspot — players connect to it. All traffic (Firebase sync, map tiles, routing) goes over your cellular connection as normal internet traffic.

---

## Firebase security rules

The default test mode rules expire after 30 days and leave the database fully open. Replace them with these in the Firebase console under **Realtime Database → Rules**:

```json
{
  "rules": {
    "games": {
      "$gameId": {
        ".read": true,
        ".write": true,
        "players": {
          "$playerId": {
            ".validate": "newData.hasChildren(['name','role'])",
            "name":      { ".validate": "newData.isString() && newData.val().length <= 32" },
            "role":      { ".validate": "newData.val() === 'navigator' || newData.val() === 'spectator'" },
            "lat":       { ".validate": "newData.val() === null || (newData.isNumber() && newData.val() >= -90 && newData.val() <= 90)" },
            "lon":       { ".validate": "newData.val() === null || (newData.isNumber() && newData.val() >= -180 && newData.val() <= 180)" },
            "arrived":   { ".validate": "newData.isBoolean()" },
            "eliminated":{ ".validate": "newData.isBoolean()" },
            "speedKmh":  { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 300" }
          }
        }
      }
    }
  }
}
```

These rules validate all data written to the database — rejecting impossible GPS coordinates, names that are too long, invalid roles, and non-boolean flags. Normal game use always passes. They don't restrict who can write (that would require authentication), but they prevent malformed or malicious data from being stored.

---

## License

GPL v3 — see [LICENSE](LICENSE)
