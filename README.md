# Table Tennis

[Play the prototype](https://joncady.github.io/R3F-Table-Tennis/) — first-person table tennis against a simple AI, first to 11 and win by two.

## Choose a mode

**Mouse + keyboard**: Start captures the pointer. Move your body with A/D and take short steps with W/S. Move the mouse to swing, Space to toss, F for fullscreen, Escape to pause/release the mouse. Paddle contact returns the ball without clicking. Cross your body for a backhand. Choose left/right handed before playing.

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

Desktop Developer tools also contains full playtest recording, the short orientation trial, grip/reach/camera tuning, tracking-model checks and links to measurement labs/multiplayer. Full recording starts from a desktop click and uses the browser’s screen chooser. Stop on the desktop, in the phone developer menu, or with Stop sharing. A video downloads automatically; optional synchronized 10 Hz motion/game data is a separate download. Browser-shared audio is included when available; phone speaker sound is not. No microphone is requested. Keep the page open until saving finishes. Recordings stay local.

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

## Implementation and deployment

- `GameEntry.tsx`: two-mode launcher, lazy-loaded games and dev routes.
- `App.tsx` / `engine.ts`: shared court rendering; fixed 120 Hz game simulation, to-11 rules, assisted AI and arcade spin. Earlier Rapier components are reference code, not the active game.
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
