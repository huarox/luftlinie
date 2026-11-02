# Luftlinie

**You know how far. You don’t know where.**

A real-world multiplayer navigation game. Host a hidden destination, share a six-character code, and let friends find it using a live signal on their phones.

**[Play Luftlinie](https://luftlinie.huarox.com)**

## Play

1. Host a game. Choose walking or driving, travel time, and a signal.
2. Place the first target on the map, or ask Smart to find a public route. Review the location before confirming it.
3. Share the link, code, or QR code. At least one navigator must join before you start.
4. Navigators follow their signal. The host and approved spectators can watch the map.

In a car, the passenger operates the app. The host should check that the destination is publicly accessible and suitable for the group. Map data is a suggestion, not a guarantee of access.

## Signals and rules

| Signal | How it works |
| --- | --- |
| Standard | Live straight-line distance, with a small shared distance offset. |
| Elimination | Every five minutes, the furthest navigator is eliminated. Requires two navigators. The final survivor wins. |
| Whisper | An eight-second distance window every minute, synchronized to the game clock. |
| Hot & Cold | Movement toward or away from the target changes the pulse. No distance readout. |
| Sailor | A compass points toward the target. No distance readout. iOS users enable the compass with a button. |
| Multi-Target | Three checkpoints, completed independently by each navigator. Additional checkpoints are selected on public routes. |
| Dynamic | Every three minutes, the host attempts a shift to a nearby public route. If none can be found, the target stays in place. |

Fine-tune the arrival radius, difficulty, teams, blind start, and whether everyone gets to finish. Teams require a navigator on both sides. The first finishing team wins. An inaccurate GPS fix cannot count as an arrival.

Internet access is required to host, join, synchronize, and confirm arrival. During a connection loss, an already loaded navigator can still read their locally computed distance. Keep the page open: mobile browsers may suspend GPS and timers in the background. Dynamic target movement and elimination require the host to remain connected with the app open.

## Version 2 improvements

- Responsive field-instrument design, light/dark themes, consistent icons, keyboard access, screen-reader labels, and reduced-motion support.
- Separate HTML, CSS, application code, and deterministic rules instead of one large HTML file.
- Per-player checkpoint progress; one player no longer moves everyone’s target.
- Host identity, checkpoint progress, elimination, arrival, teams, and recorded trails restored on rejoin.
- Server-offset clock, shared Whisper windows, corrected finish rules, and reliable elimination rounds.
- One GPS watch, bounded trails, throttled synchronization, and accuracy-gated arrivals.
- No unverified geometric fallback when Smart cannot find a suitable public route.
- Idempotent statistics, correct zero-distance units, circular compass smoothing, and proper listener cleanup.
- Manifest, app-shell service worker, Cloudflare response headers, a reproducible build, and regression tests.

## Develop

Requires Node.js 20 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
```

Development server: `http://127.0.0.1:4173`. Build output: `dist/`.

There is no frontend framework or runtime build requirement. The build copies an explicit allowlist of public files, keeping tests, dependencies, and repository metadata out of the deployment.

| File | Purpose |
| --- | --- |
| `index.html` | Screens and accessible controls |
| `styles.css` | Visual system, responsive layout, motion |
| `app.js` | Firebase sessions, maps, GPS, UI, and lifecycle |
| `core.js` | Pure geography and game rules shared with tests |
| `tests/` | Rules and application integration tests with an isolated in-memory database |
| `scripts/` | Local server and deployment packaging |
| `manifest.webmanifest`, `sw.js` | Install metadata and app-shell caching |

Maps use Leaflet and OpenStreetMap. Public-route selection uses Overpass. Driving route previews use OSRM; walking mode does not mislabel driving routes as walking routes. The current Firebase web configuration is in `app.js`.

## Deploy to the existing Cloudflare project

The production Pages project is **huarox-luftlinie** in account `3fdb9b061b78043cc19799d2294740c8`, on branch `main`, with custom domain **luftlinie.huarox.com**.

With an authenticated Wrangler session:

```sh
npm run deploy
```

For dashboard uploads, build first, then upload the contents of `dist/` (or a ZIP whose root contains `index.html`) to the **existing** project. Choose Production. Do not create a new project or change the custom domain. An earlier deployment remains available in Cloudflare for rollback.

The GitHub repository and Cloudflare project are not automatically connected. Pushing source does not update the custom domain; the Pages upload is a separate step.

## Validation and remaining limits

`npm test` checks distance edge cases, metre/km consistency, independent checkpoints, GPS accuracy, simultaneous updates, offline behavior, finish rules, team selection, session restoration, statistics, Smart failure handling, and listener cleanup.

### Detailed review — 2 November 2026

The earlier 23 passing tests did not exercise delayed callbacks, browser frame timing, or cancellation. The expanded suite has 46 tests, including a controllable clock and delayed database reads. The following defects were reproduced and corrected:

| Area | Failure | Correction |
| --- | --- | --- |
| Untrusted room data | Spectator payloads could replace validated tokens; checkpoint strings could inject HTML. | Database keys determine identity; checkpoint values are constrained to numeric indexes. |
| Countdown and navigation | Leaving or ending during countdown could reopen the old game. Late joiners got an unnecessary countdown. | Cancellable callbacks scoped to the room and shared start time; stale animation frames cannot reactivate old screens. |
| Arrival and game end | Stale GPS fixes could record arrival; delayed writes could alter an ended game. | Freshness checks and transactional arrival/finish transitions against the current room. |
| Elimination | A lone remaining navigator could never win after the other player left. | The surviving navigator wins; rounds are committed atomically. |
| Session recovery | Invite-link refresh bypassed rejoin, host settings reverted, and tabs could overwrite each other's saved identity. | Invite-aware rejoin, restored setup settings, and per-tab session storage with a persistent fallback. |
| Lobby and presence | A cancelled join could continue; new participants lacked disconnect handlers; rejected spectators could be recreated as partial records. | Cancellation guards, registered presence, and conditional cleanup. |
| Shared settings | Waiting players retained an old time limit or travel mode after host edits. | Apply the current settings snapshot when the game starts. |
| Host overview | The roster stayed at zero until a player sent a GPS update. | Render cached players immediately when entering the overview. |
| Results and maps | Arrival overlays covered results; DNF players received medals; maps invented a fallback start point. | Clear terminal overlays, award medals only to finishers, and draw only known positions. |
| Accessibility | Dialogs allowed keyboard interaction with the underlying game. | Inert background, contained focus, and Escape for dismissible dialogs. |

Browser checks exercised real Firebase host/join/start/end flows with disposable test participants, unavailable-location messaging, OpenStreetMap tiles, and mobile/desktop layouts. No real location was supplied. These checks are separate from the isolated tests and are not a load test or a complete seven-mode outdoor test.

The automated tests use simulated coordinates and an isolated database. They do not substitute for outdoor iOS/Android GPS and compass testing. Public map, routing, and database services can be unavailable or rate-limited.

This release retains the existing Firebase room architecture. Room codes and spectator approval are game-flow controls, **not a server-enforced security boundary**. Clients receive room data, including the target. The small distance offset is a game mechanic, not anti-cheat protection. Do not treat rooms as private storage. A stronger privacy/competitive model requires Firebase authentication and server-enforced rules or a separate authoritative backend; enabling that would also require a coordinated backend migration.

During the review, unauthenticated REST reads and deletes succeeded on the two disposable audit rooms. This confirms that those rooms had no authenticated ownership boundary. No other rooms were enumerated or inspected. Before treating this as a private-location product, add authenticated membership and host permissions, restrict player writes to their own records, separate secret target data from participant-readable data, and move authoritative win/arrival decisions to a trusted backend.

The service worker caches only same-origin app assets. External SDKs, maps, and realtime synchronization still require the network, especially on a cold start.

## License

GPL-3.0 — see [LICENSE](LICENSE).
