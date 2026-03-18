# Luftlinie

**You know how far. You don't know where.**

Luftlinie (German: *as the crow flies*) is a real-world multiplayer navigation game. Players drive to a hidden target knowing only the straight-line distance to it — updated live via GPS. No map. No compass. No route. Just the number getting smaller.

→ **Play at [huarox.github.io/luftlinie](https://huarox.github.io/luftlinie/)**

---

## How it works

The **host** picks a secret target location and shares a game code. **Navigators** join on their phones and start driving. The only feedback is a single large number — the straight-line distance in kilometres or metres — which updates as their GPS position changes. The goal is to reach the target within the time limit.

**Spectators** can watch a live map of all players with colour-coded driving routes.

The core tension: you can only figure out which direction to go by moving and watching the number go up or down.

---

## Features

- 🎯 **Manual or Smart target placement** — tap the map yourself, or let the algorithm pick a real road at the right distance
- 🧭 **Live GPS distance** — straight-line, updated continuously, reliable on both iOS and Android
- 👁 **Spectator mode** — full live map with driving routes per player, colour-coded, updating as players move
- ⚡ **Elimination mode** — furthest player knocked out every 5 minutes
- 🙈 **Blind start** — distance stays hidden until you've moved 500m, forcing you to commit to a direction first
- 🔊 **Proximity sounds** — subtle tones as you close in, a chime on arrival — all toggleable
- ⏱ **Server-synced timer** — anchored to Firebase's server timestamp, no drift between devices
- 🔒 **Anti-cheat noise** — deterministic ±30m offset applied consistently across all players
- 🌙 **Dark mode** — automatic system dark mode support
- 📱 **Mobile-first** — designed for iPhone, works on any modern mobile browser
- 🔥 **Real-time** — Firebase Realtime Database, instant updates, no polling

---

## Gameplay

### Settings

| Setting | Options | Default |
|---|---|---|
| Target mode | Manual / Smart | Manual |
| Difficulty | ★ Easy → ★★★★★ Expert | ★★★ Medium |
| Ideal drive time | 10–90 min | 30 min |
| Arrival radius | 25 / 50 / 100 / 200 m | 50 m |
| Host role | Navigator / Spectator | Spectator |
| Elimination | On / Off | Off |
| Blind start | On / Off | Off |

**Time limit = ideal drive time × difficulty multiplier**

| Difficulty | Multiplier |
|---|---|
| Easy | 3× |
| Normal | 2.5× |
| Medium | 2× |
| Hard | 1.5× |
| Expert | 1.2× |

### Distance display

Always straight-line (Haversine). Never driving distance.

```
≥ 10 000 m  →  X.X KM
1 000–9 999 m  →  X.XX KM
< 1 000 m  →  XXX M
```

Colour shifts from neutral → orange (< 2 km) → green (< 500 m) as you close in.

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

## Smart target algorithm

When Smart mode is selected, the Overpass API is queried for publicly accessible roads near the ideal drive distance:

- **Road types:** residential, service, unclassified, living_street, tertiary
- **Excluded:** private/restricted access, motor_vehicle = no/private, any barrier tag
- **Acceptance band:** 82–112% of the ideal straight-line distance
- **Preference:** dead-ends and cul-de-sacs over through-roads
- **Attempts:** 5 random bearings before falling back to a geometric point
- **Fairness:** if the host chose Navigator + Smart, the map is never shown to them — target is found silently and the host goes straight to the lobby

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

Open `index.html` in any text editor. Find the `FIREBASE_CONFIG` block near the top of the script and replace the placeholder values with your real ones:

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

MIT — see [LICENSE](LICENSE)
