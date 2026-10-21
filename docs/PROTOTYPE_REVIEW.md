# Prototype review — 2026-10-20

## Corrections in this pass

- Replaced the phone alignment timer with a local QR scan, expected room/nonce comparison, facing-camera/top-up geometry checks, 500 ms steady detection and a phone acknowledgement. Play, auto-start and free-hand tossing require alignment. Reconnects and re-enabling the webcam invalidate alignment. A different session cannot satisfy the scan.
- Ordinary recenter preserves face heading. Grip tuning no longer overwrites screen-face orientation. A failed sync times out and resumes scanning instead of leaving setup stuck.
- Added an explicit mouse/keyboard vs phone/webcam launcher, available both locally and on Pages. The former localhost-only webcam entry would otherwise have deployed the old UI.
- Hid playtest and rotation recording in developer menus on both screens. Added browser cadence, render count, slow frames, camera latency/confidence/backend, stale phone age/buffer delay, and phone sensor/network diagnostics.
- Throttled camera-driven UI metrics to 5 Hz rather than rendering the game UI at inference cadence. The QR worker only runs during setup. Diagnostics only sample while the dev view is open. Kept the existing pose/hand worker separation, bounded interpolation and fixed-step physics.
- Split the entry and game routes into lazy chunks. The launcher entry is roughly 146 kB before gzip, versus the previous combined ~1.2 MB entry. Graphics still require the larger shared Three/R3F chunk when a game opens.
- Removed synthetic benchmarks from normal dev/build startup. Production builds prepare checksum-verified camera models and WASM; previously these were only guaranteed by a local preparation command.
- Fixed phone asset bundling for filesystem paths containing spaces. Generated assets and recordings remain ignored. Archived obsolete README instructions and removed the Vite template boilerplate from the active README.
- Applied compatible dependency updates. `npm audit --omit=dev` reports zero advisories after this pass. Development tooling still has advisories that require major Vite/esbuild and TypeScript-ESLint upgrades; these were not forced during gameplay changes.

## Validation

- Game/rules, spin, motion, full simulated AI match and real WebSocket mixed-input multiplayer tests.
- Webcam mapping, wrist/finger toss, camera paddle anchor, rotation/pivot and ball visibility tests.
- Actual QR encoding and decoding, wrong-session rejection, stable/top-up/front-facing checks and loss reset.
- Recording lifecycle and browser-native MediaRecorder encoding/video decode.
- Browser integration with synthetic body/camera/sensor inputs: required alignment blocks Play, wrong marker remains blocked, real QR worker and real relay/phone acknowledgement unlock play, re-alignment pauses, developer-only recording, mouse start/toss/movement/pause.
- Deployed AWS relay: pairing, trusted WSS, four alignment messages with nonce, motion, feedback, pause, toss, probes and origin rejection. A measured 30-packet test delivered all packets; the sample round-trip range was 114–236 ms, median 130 ms. This is a test sample, not a network latency guarantee.
- Production build and lint; CI additionally runs all webcam/marker/recording unit tests.

## Remaining limits

The marker validates identity and a roughly front-facing, upright screen; it does not solve calibrated 6DoF phone pose. Camera lens calibration, phone grip geometry and real device/network feel still need playtests. Wrist-based position and toss are approximate. Fast strokes can exhibit smoothing lag. Update for #9: full playtests stream chunks and telemetry to local IndexedDB, with interrupted-capture recovery and disk streaming exports where supported. Other browsers assemble the export at download time. Recording video is the chosen screen/window/tab, so it includes only what the browser allows, with no phone speaker audio. The development rotation recorder retains a WebGL drawing buffer; normal gameplay inference remains the primary performance cost. Update for #9: the unreferenced Rapier experiment and unused direct dependencies were removed; the original source remains in Git history. Multiplayer remains a developer prototype and is not one of the two primary modes.
