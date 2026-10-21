# Table Tennis

[Play the prototype](https://joncady.github.io/R3F-Table-Tennis/) — first-person table tennis against a simple AI, first to 11 and win by two.

## Choose a mode

**Mouse + keyboard**: Start captures the pointer. Move your body with A/D and take short steps with W/S. Move the mouse to swing, Space to toss, F for fullscreen, Escape to pause/release the mouse. Paddle contact returns the ball without clicking. Cross your body for a backhand. Choose left/right handed before playing.

**Touch controls (mobile)**: On phones and tablets with a primary touch pointer, the mouse/keyboard option becomes Touch controls. Choose left or right handed before starting. The movement wheel sits opposite your paddle hand: drag it to step sideways or forward/back. Drag elsewhere to swing the paddle; a quick tap tosses the ball to serve. Both thumbs work together. Use the top-bar Pause button to take a break, then Resume game. Tap Fullscreen in the top bar to expand the game; Exit fullscreen returns to the browser. If the browser does not support fullscreen, the game displays a fallback message. Portrait and landscape are supported; landscape gives a wider view. Private multiplayer uses the same controls when Touch controls is selected.

**Phone + webcam**: Scan the pairing QR on Android Chrome or iPhone Safari and tap Connect phone (allow motion access on iPhone). Click Enable webcam on the computer. Show the phone’s large session marker to the webcam, facing it straight toward the lens with the top edge up. Move the phone closer if the code is too small. The camera must read the matching session marker steadily and receive a phone acknowledgement before Play is enabled. Then step back so your shoulders/hands are visible; the game starts automatically. Move sideways, swing the phone, and lift your free hand to toss, or use Toss on the phone.

The screen plane represents the paddle rubber. Heading is established at marker sync; ordinary position recentering preserves it. The blade center follows an estimated wrist/grip lever arm. Phone orientation stays 1:1, with bounded acceleration movement layered onto camera wrist tracking. Accelerometer integration is not room-scale position tracking. The webcam supplies translation and throwing-hand position. No closed-fist ceremony, side-step calibration or finger detection is required to start.

Alignment is specific to the random pairing room and marker nonce. Other sessions cannot satisfy the camera check. Re-pairing, reconnecting or re-enabling the webcam requires alignment again. Re-aligning pauses gameplay. Camera/tracking loss, stale phone samples and suspension pause play; resume from the phone after returning to view. The held ball stays hidden until the throwing hand is seen. Your contacts send sound/haptics to the phone; AI contacts send a softer sound without vibration.

Webcam frames and marker decoding stay in the browser. AWS relays phone data; it does not receive camera images. The target remains a quick setup, with eight shoulder samples and an 800 ms readiness window after required alignment. Real-world startup time depends on permissions, model loading and marker visibility.

## Run locally

```sh
npm ci
npm run controller
# In another terminal:
npm run pose:dev
```

Open http://127.0.0.1:5174/R3F-Table-Tennis/ (or the Vite URL printed if that port is busy). `pose:dev` prepares checksum-verified pose/hand models and the local WASM runtime. `npm run build` also prepares these assets for production. Normal startup no longer runs the synthetic swing benchmark.

Local phone pairing needs the same Wi-Fi and trusted HTTPS: the relay provides a CA certificate link in Developer tools and serves the controller on port 8788. Install/trust this prototype CA on the phone, then scan a fresh pairing QR. Private keys remain in ignored `controller/.certs/`. Remove prototype trust when finished. The public HTTPS version needs no custom CA or shared Wi-Fi.

## Developer tools

Both screens keep recording and detailed telemetry behind **Developer tools**. Desktop diagnostics show render FPS, browser frame cadence/slow frames, camera latency/confidence/backend, phone sample age, interpolation delay and alignment state. Phone diagnostics show orientation/acceleration rate, outgoing queue size, round-trip time, orientation and impact count. These are runtime indicators, not physical tracking accuracy measurements.

Desktop Developer tools contains full playtest recording, Saved recordings, the short orientation trial, grip/reach/camera tuning, tracking-model checks and links to measurement labs/multiplayer. Full recording starts from a desktop click and uses the browser’s screen chooser. Stop on the desktop, in the phone developer menu, or with Stop sharing. Video chunks are persisted locally about once per second, and synchronized 10 Hz motion/game data is flushed in batches of up to 100 samples. Capture holds at most 16 MiB of pending chunks; slow/full storage stops capture with a recovery message. Saved recordings survives reloads and offers video/data export and explicit deletion. Partial captures retain previously committed chunks; their final frames or telemetry batch may be missing after a crash. Storage is browser-local and can be cleared or evicted, so export important captures. Supported save pickers stream exports to disk one chunk at a time; other browsers assemble a Blob only during export. Browser-shared audio is included when available; phone speaker sound is not. No microphone is requested.

## Validate

```sh
npm test
npm run test:webcam
npm run lint
npm run build
# With local relay running:
npm run test:controller
# With the deployed relay:
RELAY_HTTP=https://4jcmv1vcki.execute-api.us-west-2.amazonaws.com npm run test:cloud
```

The tests cover scoring/deuce/service, passive and rotated paddle contacts, spin, synthetic motion, simulated complete AI/multiplayer matches, phone API doubles, marker encode/decode, session rejection, recording lifecycle and relay messages. Browser integration tests additionally exercise the real QR worker and WebSocket relay with synthetic camera/body/sensor inputs. These checks do not certify real device feel, optical accuracy, haptic hardware or adverse network conditions.

## Net contacts and lets

A service net touch is replayed only after an otherwise legal service reaches the receiver’s court (or the receiver obstructs it). A net hit that falls back or lands out loses the point; rally net cords remain playable. The same server retries a let without changing the score. See [Laws 2026–27, 2.9.1.1](https://www.tabletennisengland.co.uk/content/uploads/2026/07/Laws-of-Table-Tennis-2026-27.pdf) and the [PingSkills video at 2:09](https://www.youtube.com/watch?v=9ZoEMXyP9Lc&t=129s).

The game distinguishes a round top cord from the mesh: glancing cord contacts can slow, deflect and carry over; low mesh contacts lose momentum and fall back. Contact drives a brief local net ripple, fixed at the posts. This is a bounded gameplay approximation; damping and restitution are tuning values, not measurements extracted from the reference video. Net contact events are replicated to multiplayer displays. Run `npm run test:net` for both-server let/fault and high-speed contact trials.

## Implementation and deployment

Use Node.js 22.13 or newer (`nvm use` selects Node 22). The development toolchain uses Vite 8 / React plugin 6, ESLint 10 with flat configuration, TypeScript-ESLint 8, and TypeScript 5.9. Worker dependencies are prebundled to avoid a first-use development reload.


- `GameEntry.tsx`: two-mode launcher, lazy-loaded games and dev routes.
- `App.tsx` / `engine.ts`: shared court rendering; fixed 120 Hz game simulation, to-11 rules, assisted AI and arcade spin. The unused Rapier experiment and its stale TODOs/dependencies have been removed; Git history retains the original work.
- `WebcamGame.tsx`, `useWebcamBody.ts`, pose/hand workers: phone/webcam orchestration, local camera inference and free-hand toss.
- `sessionMarker.ts`, `useSessionMarker.ts`, `marker.worker.ts`: session match, face/top-up geometry checks and stable optical verification. Scanning stops once synchronized.
- `usePhoneController.ts`, `phoneMotion.ts`, `controller/phone.html`: phone protocol, buffered motion and adaptive phone UI.
- [AWS relay](cloud/README.md): existing on-demand API Gateway/Lambda/DynamoDB setup.
- [On-demand multiplayer](multiplayer/README.md): private-room prototype, available under developer tools, separate from the two AI modes.

GitHub Pages builds main via `.github/workflows/deploy.yml`; it validates game/webcam tests and lint, prepares models and phone assets, and builds with repository variables `PING_PONG_RELAY_HTTP` and `PING_PONG_MATCH_HTTP`. Update the relay before publishing a frontend that requires new protocol messages:

```sh
npm run cloud:template
aws cloudformation deploy --template-file cloud/template.generated.json --stack-name PingPongRelayPrototype --region us-west-2 --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset
```

See [prototype review](docs/PROTOTYPE_REVIEW.md) for this pass and remaining limits. Earlier experimental instructions are archived in [historical notes](docs/HISTORICAL_PROTOTYPE_NOTES.md).

## v0.2.0 equipment and release identification

Open **Paddle setup** from either mode before starting. Choose a red, blue, green, pink or violet face opposite matte black, and 1.7 / 1.9 / 2.1 mm sponge. Settings persist across modes. The default 1.9 mm preserves the original physics; other presets add modest brush-dependent differences in spin and pace. Equipment is fixed during a match; use **New match to change equipment** if needed. See [equipment research and model limits](docs/EQUIPMENT_NOTES.md).

**Escape or P** pauses mouse play and releases pointer lock. Navigation floats above the pause overlay, and opening setup/developer menus pauses play. Release version and build revision appear on the launcher and game headers, with a link to release notes.

The remaining work is tracked in the [Table Tennis Prototype project](https://github.com/users/joncady/projects/3): physical motion/optical alignment/toss tuning, real Android/iPhone network and feedback trials, sponge/physics validation, multiplayer hardening. Tooling and durable recording/legacy cleanup were completed in #8 and #9.

## Original 3D assets and credits

The original model links, authors and license identifiers are preserved in each GLB’s embedded `asset.extras` metadata.

| Asset used in this game | Original model | Creator | License |
| --- | --- | --- | --- |
| `public/models/ping_pong_paddle.glb` | [Raqueta de ping pong](https://sketchfab.com/3d-models/raqueta-de-ping-pong-2531d5a1d03f46e0a0dbc5d9fd1e416f) | [GIYWBY](https://sketchfab.com/GIYWBY) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `public/models/table_tennis_table.glb` | [Table Tennis Table](https://sketchfab.com/3d-models/table-tennis-table-457c34c9297d44a1a5d4e5d093c6a712) | [Diccbudd](https://sketchfab.com/Diccbudd) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Game adaptations: models are centered, scaled and positioned at runtime; the paddle filename was renamed, and the player’s rubber materials can be recolored with matte presets. Credit for the original models belongs to the creators listed above.

Found a bug? [Open a repository issue](https://github.com/joncady/R3F-Table-Tennis/issues/new), including the displayed version/build, browser/device and steps to reproduce.

## Virtual test lab

Use Node 24 (`nvm use`; Node 22.13+ is supported). The lab runs locally, uses no AWS resources, and does not include personal camera recordings.

```sh
npm ci
npx playwright install chromium ffmpeg
npm run lab:runner
# Open http://127.0.0.1:5191
```

The runner offers smoke, vision, phone, webcam, mouse and complete-match trials. It starts isolated Vite/relay servers on ports 5190/8789/8790 as needed, shows live logs, and links to the latest report with playable browser videos, measurements and failure traces. Only one run can run at once (GUI and CLI share an atomic run lock). Stop cancels it. After a forced process crash, a stale `.lab-run.lock` may need removing once you confirm no lab process is running. The service binds to loopback and requires its own page's origin/token for mutations. Do not run two CLI suites simultaneously: they share the latest report directory.

```sh
npm run test:lab                 # browser reliability gate
LAB_EXTENDED=1 npm run test:lab   # full real-time AI matches too
npm run lab:report               # open recorded results
npm run lab                     # interactive real-model camera console on :5190
```

| Trial | Real application path | Simulated input |
| --- | --- | --- |
| Vision | Actual pose WASM and nested hand worker; translation, occlusion, reacquisition | Fictional generated camera image, translated/covered pixels |
| Phone + webcam | Actual camera/hand/QR workers, session-bound alignment, auto setup, body movement, Toss and remote pause/resume | Canvas camera stream, phone orientation/motion events; permission consent supplied by harness |
| Phone network | Shipped controller page + actual relay, commands, quaternion/acceleration samples, audio/vibration API calls, reconnect | Seeded ordered WebSocket latency/jitter/stall/disconnect; DevTools HTTP throttling/offline |
| Mouse game | Real renderer, physics, AI, serve/scoring and pause/resume | Bounded relative mouse events and Space; supported limited-mouse fallback if headless Chrome denies capture |
| Animated phone game | Actual visual paddle tracking and phone/relay path | Pixel-space arm deformation plus emulated phone sensors and normal Toss button |

The virtual players read copied game observations to aim (an **oracle observer**, not screenshot-only perception). They cannot access live Match/input references or change ball, points, AI difficulty, or simulation speed. `?virtual-player` observations and `?vision-cpu` backend selection are available only in localhost development builds. CI selects the actual CPU vision delegate for consistent hardware availability. The generated arm animation is a synthetic visual stress fixture, not a biomechanically accurate human recording. Complete matches run at ordinary game speed; either side may win, but the score must obey first-to-11/win-by-two rules.

The network proxy preserves WebSocket text frames and ordering, caps pending messages, and records measured command-to-feedback latency. Its stalls model application transport delays; they are not TCP packet-loss simulation. Browser [DevTools network emulation](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions) additionally tests HTTP loading/offline behavior. Do not assume HTTP throttling alone delays an already-open WebSocket. Audio/vibration assertions prove the API calls happened; a real phone is still needed to assess audible/tactile quality.

Pages deployment now requires the browser smoke suite. Pull requests run the same suite; scheduled/manual extended runs record full matches. GitHub Actions retains reports, videos and failure traces for 14 days. Timing measurements are diagnostics rather than universal hardware/network performance guarantees. These trials supplement physical playtests and do not by themselves close motion-accuracy, grip, toss, or real-device issues.

Fixture provenance: `lab/fixtures/player.png` and its serving-pose edit `lab/fixtures/serve.png` were generated for this repository using the image-generation tool on 2026-10-21. They depict a fictional adult left-handed player in a plain room, phone in the paddle hand and open opposite palm. No user photos or recordings are used. Model downloads remain checksummed by `controller/prepare-pose.mjs`.

First measured local baseline (2026-10-21): both full real-time browser matches completed legally at 1–11. The mouse player made 42 contacts (AI 46); the generated-webcam/phone player made 9 (AI 14). Webcam/phone startup took 4.25 seconds in the smoke trial. Command-to-feedback round trips were 35 ms on the unimpeded proxy and 403 ms with the congested profile. A 1.8-second transport stall paused the actual game; reconnect required alignment again. See `lab/baseline.json` for provenance. These are observed examples, not thresholds tuned to make tests pass or claims about physical phone accuracy.

The lab uncovered a webcam startup stall: the scene first rendered after Play, interrupting tracking during shader/model warm-up. v0.2.8 renders setup frames on demand while keeping physics frozen and waits for body/hand model initialization before enabling tracking. The virtual camera uses a 640×426, 15 fps stream and a natural serving pose. Match drivers now report live scores/contacts and fail promptly on stalled rendering or an unplayable tracked-hand serve.

The virtual phone uses an elapsed-time serving stroke planned from measured shoulder/wrist positions; synthetic accelerometer samples come from that same hand trajectory (assuming a 40 cm shoulder span). Native worker messages provide frame-age, inference-time and wrist-visibility diagnostics, retained even on failed matches. The desktop CI viewport is 960×600 to limit software-GPU overhead; the model still processes the actual 640×426 camera stream. Graphics performance on physical devices remains a separate measurement.
