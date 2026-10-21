# Historical prototype notes

These notes describe earlier test flows. Use the root README for the current prototype.

# React + TypeScript + Vite

## Current local play draft: phone + webcam

Start `npm run controller` and `npm run pose:dev`, then open
[the local game](http://127.0.0.1:5174/R3F-Table-Tennis/).

1. Scan the automatically generated QR on your phone and tap **Connect phone**.
2. On the computer, click **Enable webcam**, allow camera access, and stand with
   shoulders/hands visible. The game centers itself and starts automatically.
3. Move sideways, swing the phone, and lift the free hand to toss. Phone Toss is
   available too. Play is a normal first-to-11 match, not the old toss practice.

Both phone and webcam are required for this draft. No side markers or grip ritual
is required. The phone is automatically recentered at initial start; **Recenter
paddle** is available on the phone. Camera center is estimated from eight valid
shoulder samples; reach adapts as camera distance changes. This is an approximate
alignment, with fine tuning under **Advanced** on either screen. The previous
measurement labs and legacy mouse mode remain Advanced links. Older prototype
instructions below are historical and may describe superseded default flows.

The target is playable within 15 seconds after **Enable webcam**, with the phone
already connected. Camera permission and body model loading run concurrently;
finger tracking initializes in the background and is not a start gate. An 800 ms
stable-readiness window then starts play once. **Advanced** reports the actual
camera-click-to-play time. Synthetic timing tests cover startup delays within the
budget, but do not certify physical camera timing, user permission delays, first
certificate trust, or slow hardware. A blank-frame model diagnostic separately
measures model startup. First local phone use still needs the prototype CA trust;
that prerequisite is not a recurring calibration step. All changes remain local.

Pause/resume and toss are on the phone. Disconnects, phone suspension and lost
camera tracking pause play. A quiet phone sensor alone does not block startup.
Debug telemetry, recordings, marker calibration and grip tuning are in Advanced.


Public prototype: https://joncady.github.io/R3F-Table-Tennis/

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list

## Playable singles game

Run `npm install` and `npm run dev`, then open the URL Vite prints.
A/D moves your body and the first-person camera left/right. W/S takes short
steps toward/away from the table. Mouse movement drives a short paddle stroke
relative to your body; it settles back to a neutral position after the stroke.
Contact always returns the ball, even with a stationary paddle. Faster strokes
add pace and lateral direction. No mouse clicks are used for shots.
Choose Left handed or Right handed before starting (or between points while paused).
The paddle rests on that side. Crossing your body selects backhand automatically,
with a small transition zone around the center to prevent flicker.
Before serving, the ball follows the paddle with clearance. Space tosses it upward;
move the mouse to strike it as it drops. Missing the toss loses the point.
F toggles fullscreen view, including while the mouse is captured. Escape pauses, and losing focus also pauses. The AI serves
automatically. Use Play again after a finished game.

Games are first to 11, win by two, with service changing every two points and
every point after 10–10. The human serves first. Net serves that land legally
are replayed. Illegal volleys, wrong-side bounces, double bounces, and missed
returns end the point. A point is awarded only once.

The active implementation is `src/App.tsx` (scene, models, controls, HUD) and
`src/engine.ts` (fixed 120 Hz simulation, rules, bounded AI). The earlier Rapier
components remain as reference but are no longer mounted. The ball uses swept
surface crossings and assisted shot arcs rather than mesh-generated physics.
AI has a 140 ms reaction interval, bounded movement speed, and aiming error.
This is a desktop mouse game with assisted shot arcs and an arcade spin model.
Tournament service toss enforcement and mobile touch controls are outside this version.

Validation: `npm test`, `npm run lint`, and `npm run build`.

Paddle velocity is tracked separately from body position, and swept contact
uses the moving paddle plane. Brush velocity excludes keyboard body movement.
At contact, upward brushing adds topspin, downward brushing adds backspin,
and sideways brushing adds sidespin; faster brushes generate stronger spin.
Spin affects flight through a capped Magnus force, decays in air, and changes
table rebound speed/height. Diagonal strokes combine spin axes. Passive blocks
retain a quarter of incoming spin. The AI predicts with the same spin model.
An orange stripe makes ball rotation visible.

Camera follow uses smoothed brush velocity with no roll, maximum default yaw
of about one degree, and position offsets below 3 cm. Adjust Camera follow
in the start/pause screen, including Off. Physics tuning constants are in
`SPIN` in `src/engine.ts`; camera limits are in `followSwing`.

Starting/resuming captures the mouse with Pointer Lock: the cursor is hidden and
relative movement continues at screen edges. Escape releases capture and pauses.
Horizontal paddle travel spans four world units, with a slower return to neutral
so cross-body backhands are easier. If an embedded browser blocks Pointer Lock,
open the same local URL in Chrome; the limited-mouse fallback still has screen edges.

## iPhone / Android motion-controller prototype

Run `npm run controller` in a second terminal alongside `npm run dev`.
The relay serves HTTP on 8787 and HTTPS/WSS on 8788 on your local network.
In the game, choose **Pair iPhone / Android → Create pairing**. The generated QR
contains a private room link; keep desktop and phone on the same Wi-Fi.

Android Chrome requires a trusted secure page for motion sensors. Download the
local CA certificate using the link in the pairing panel, then install it via
Android Settings → Security → Encryption & credentials → Install certificate →
CA certificate (labels vary by Android version). This is a manually trusted,
prototype-only CA; remove it from Android's user credentials when finished.
Do not disable Chrome's secure-context checks. The relay generates its own
30-day CA/server certificates in ignored `controller/.certs/`; private keys stay
on the computer. You do not need to trust this CA on the desktop for the normal
localhost game. The server certificate includes the computer's current LAN IPs.
Restart the relay and create a fresh QR if the network address changes.

On Android: scan the QR, tap **Connect & enable motion**, hold the phone in your natural paddle grip, and **Calibrate natural grip**.
Hold still for the first prompt, then make a short movement toward YOUR RIGHT
when asked. Gravity defines up; this explicit gesture defines sideways. Allow
motion sensors if prompted. Test impact sound/vibration using the phone button.
On desktop choose **Start with phone** or **Continue with phone** to enter play directly. A connected controller is shown as **Edit phone pairing**. Phone Pause/resume can also enter or resume the game without a desktop click. Phone Toss starts
or tosses, and Pause toggles pause. Keyboard A/D and W/S still move your body.
Sound is synthesized on the phone; vibration is capability-detected and may
also depend on Android/Chrome settings. Keep the controller page visible.

The phone now estimates short-window hand displacement from acceleration,
independently of the calibrated 1:1 face orientation. It still does not provide
absolute 6-DoF tracking or an anatomically rigged wrist/backhand.
Motion is transmitted at up to ~60 Hz. Calibrated quaternions drive the face
orientation with 1:1 angular gain, without the mouse backhand flip. Network interpolation adds a small temporal delay while preserving the calibrated rotation endpoints.
Phone-mode collision uses that same rotated face, including held-ball clearance.
Reach uses 2× sensitivity by default (adjust Phone reach in the pause menu),
with a faster arm movement limit. See network interpolation below.
If the phone does not expose acceleration, tilt-based reach remains a fallback.
The existing paddle velocity/spin model remains active. Valid player paddle contacts send one feedback event
with bounded strength. Disconnects, stale samples, and a hidden phone page pause
the game. Mouse control remains available through **Use mouse**.

The relay uses separate random room/host tokens, restricts origins to local
addresses, validates and rate-limits motion packets, bounds payloads/queues,
and expires sessions. It is a LAN prototype, not a public hosting service.
To select a LAN address explicitly, set `CONTROLLER_IP` before starting it.

With the relay running, `npm run test:controller` checks HTTP pairing, a real
CA-verified WSS phone connection, motion/command delivery, impact feedback,
malformed packet rejection, disconnect status, and origin restrictions.
Real sensor orientation, perceived latency, speaker audio, and haptics require
an actual Android device; desktop tests cannot verify those hardware behaviors.

### Accelerometer swings

After updating, create a fresh pairing and reload the phone page. Connect and
calibrate in your neutral pose, then hold still for about half a second until
**Acceleration swing active** appears. Hand translation now moves the paddle
on all three axes; orientation continues to come directly from the calibrated
quaternion. Phone reach scales displacement without amplifying rotation.
Forward stroke velocity contributes to serve contact, pace, and impact feedback;
sideways/upward brushing still drives spin. Keyboard/body movement is unchanged.

The phone prefers gravity-free `devicemotion.acceleration`; if unavailable, it
rotates gravity-inclusive readings into the neutral frame and subtracts gravity.
A quiet calibration estimates bias. Short-window integration uses filtering,
a deadband, bounded speed/reach, damping, and zero velocity after rest. The hand
settles toward neutral between strokes instead of accumulating room-scale drift.
Sensor gaps clear displacement; recalibration resets it. Pure rotation continues
to rotate the face but does not intentionally translate the hand. As with any
inertial-only estimate, gravity errors and rotational acceleration can still
create some unwanted displacement; the first device playtest should tune gain
and thresholds. Webcam/body movement and toss gesture detection are deferred.

Lateral follow now defaults to an additional 1.5× gain on sideways accelerometer
displacement, independently adjustable from 1–10× in the pause screen. Phone
reach still scales all axes. Velocity damping is lighter during short strokes,
and displacement is held through 600 ms of rest before settling. The phone
displays its unamplified hand-offset estimate in centimeters to distinguish
sensor response from game gain. Reload the phone page to load tracker changes;
no relay restart or new pairing is necessary for this tuning update.

### Left-handed movement trial

Reload the phone page and connect, then tap **Start left-handed movement trial**.
The guided 31-second sequence is: 5 seconds still, 10 seconds left/right with
the phone face held steady, 10 seconds natural left-handed swings, 6 seconds still.
Spoken cues announce each phase. The phone attempts portrait orientation lock
in fullscreen; when unavailable, disable Android auto-rotate for the trial.
Screen orientation is logged so later analysis can identify display rotation.
The phone records raw linear/gravity sensor values, calibrated-frame acceleration,
orientation, sample intervals, calibration/bias, filtered acceleration, estimated
velocity/displacement, and phase labels. No haptics are generated by trial cues.
Recordings save only to ignored `controller/.trials/` on this computer. If upload
fails, Download last trial preserves the data on the phone. Hiding the page saves
a partial recording. Nothing records until the trial button is pressed.
Run `npm run trial:analyze` to inspect the latest real recording. Synthetic relay
tests are excluded. Provide approximate physical sweep distance when interpreting
the estimated hand travel; sensor output is not a positional ground truth.

The first recorded left-handed trial revealed that the bias estimator combined
noncontiguous quiet samples. Calibration now requires 400 ms of continuous
stillness and restarts when interrupted. Replaying the recorded quiet window
at 4–6 seconds reduced offset variation from [1.52, 0.58, 0.98] cm to zero
under this estimator. This validates removal of that recorded bias effect,
not real-world positional accuracy or final lateral gain.

Natural-grip calibration supersedes the original upright-phone assumption.
The second left-handed trial measured gravity about 55 degrees away from
assumed phone-up, despite screen orientation remaining portrait throughout.
Calibration now builds an orthonormal movement frame from measured gravity
and the initial rightward acceleration impulse. Both acceleration and relative
orientation are expressed in that frame; quaternion conjugation preserves
rotation angle 1:1. Gain is unchanged. A clean post-calibration trial is needed
before inferring a new gain or physical travel scale from these recordings.

## Recorded motion replay and capture

Run `npm run replay:prepare`, then open the game with `?replay=latest`.
The replay uses the latest complete real trial, timestamps, quaternion samples,
recorded displacement, and grip basis. It drives the same Court/Match paddle
and camera pipeline in serve/practice state, without live phone commands or
simulated match outcomes. The timeline can be scrubbed. Gain selection compares
original 5× lateral gain with proposed 1.5× at the same 2× overall reach.
Record replay captures the actual rendered WebGL canvas to downloadable WebM,
with a timestamp/gain caption; Capture frame exports a PNG. Capture mode keeps
WebGL pixels available and preserves the browser canvas aspect ratio.
The generated local replay JSON is ignored by Git, as are raw sensor trials.

The third complete left-hand trial (2026-10-15T07-36-22-489Z-90c28a)
contained 1,860 samples at ~60 Hz. Its lateral phase had an estimated X span
of 47.66 cm. At 2× reach and 5× lateral gain, 39.7% of lateral-phase samples
and 60.8% of natural-swing samples exceed the +/-2-unit hand-offset limit.
At 1.5× lateral gain neither phase clips; lateral phase span becomes 1.43
world units. This is an output-range comparison, not validated physical scale.
That trial saved an identity grip basis, so it does not establish that the new
natural-grip wizard was completed; subsequent validation should record it.

For a later webcam validation: record the real hand and on-screen replay
simultaneously, establish a visible length reference and playing stance, and
use a shared visible/audio cue to align timestamps. Compare direction, phase
lag, travel, endpoints, and return-to-rest before changing gain or drift rules.
No webcam recording or scheduled task is enabled by this plan.

The live lateral default was reduced to 1.5× after this replay comparison;
overall reach remains 2× and quaternion rotation remains 1:1. Verified WebM
captures and PNG comparison frames are saved in ignored `.replay-captures/`.
A full browser reload is needed after changing WebGL preserveDrawingBuffer
during development; a hot refresh does not recreate an existing GL context.

## Public GitHub Pages + AWS prototype

The Pages deployment builds with repository variable `PING_PONG_RELAY_HTTP`.
Game and phone controller are hosted on GitHub Pages; pairing and motion use
trusted AWS HTTPS/WSS endpoints. See [cloud/README.md](cloud/README.md).
Public pairing needs no local certificate or shared Wi-Fi. The phone displays
round-trip time through the actual game client. Trial uploads stay local-only.
Initial synthetic cloud validation after increasing relay headroom received
30/30 packets sent at ~60 Hz. Ten echo round trips measured 117–182 ms, median
153 ms, from this computer; these are not Android latency measurements.
Packets arrived out of order in the burst, so sequence rejection is enabled.

### Network interpolation and motion limits

Phone samples carry a monotonic source timestamp. Both relays preserve it; the
host rejects old sequence numbers and interpolates using sample time instead
of packet arrival time. A 28–80 ms adaptive buffer absorbs packet bunching.
Shortest-arc normalized quaternion interpolation retains 1:1 angular endpoints.
A small frame-time-independent correction filter softens recovery after gaps.
Only translation can predict ahead: at most 25 ms and 3 cm per sensor axis
before reach gain. Orientation is never extrapolated. Gaps hold the last pose
rather than snapping the paddle to neutral; the existing one-second stale-data
pause still applies. Phone-side queued motion is dropped before it builds a
backlog. Reload the phone and desktop after deploying; older controllers still
work using arrival timestamps.

`tests/phone-motion.test.mjs` compares a synthetic sinusoidal stroke under
packet bunching: discrete acceleration spikes fell 95%, with maximum unscaled
trajectory error 7.2 cm. This is a synthetic smoothness/lag test, not measured
Android tracking accuracy. The added buffer trades some responsiveness for
continuity and cannot fix sustained network latency or inertial drift.

Coaching references reviewed for form:
[Table Tennis England: forehand/backhand flick](https://newsarchive.tabletennisengland.co.uk/news/archived/coaching-forehand-backhand-flick/)
and [PingSkills: advanced backhand topspin](https://www.youtube.com/watch?v=TDtxRDnGpPM).
Their emphasis on forearm/wrist action and upward brushing supports keeping
face rotation separate from hand translation. We preserve the measured grip
instead of imposing an automatic backhand flip on phone players. Anatomical
elbow pivots, body rotation and absolute hand position still need camera or
other positional references; acceleration alone does not establish them.

### Automated match recording

Open `?demo=agent` and choose **Record agent match**. This records the rendered
WebGL game at 4× speed to a downloadable 1280×720 WebM, including score and
explicit automation labels. It is a paddle-input test player, not recorded
human phone input or an end-to-end network validation. Its deterministic seed
produces an 11–0 match with 284 player contacts over 666.8 simulation seconds.
There are no ball or score overrides. `npm test` runs the same full-match test.
The CPU retains its reaction interval and speed bounds, with a persistent
placement error per incoming shot instead of continuously perfect tracking.
Live rallies no longer award arbitrary points after 20 seconds.

### Virtual-phone tracking lab

Open `?lab=phone` to compare a known 3D phone path (white), the previous
tracker (orange), and the tuned tracker (lime). Play, pause, scrub and orbit
the scene. `npm run trial:simulate` regenerates the synthetic report; dev and
build generate it automatically. Only synthetic data is included publicly.

The virtual device follows analytically differentiated minimum-jerk straight
and curved paths. Its orientation changes independently. Acceleration is
expressed in device-local axes, with configurable bias, noise, gravity fallback,
small gravity-error perturbations and irregular sample intervals. The same
`accelerationInNeutral` conversion used by Android reconstructs these samples
before the production tracker processes them. Calibrated axes and orientation
are assumed; this is a physical sensor simulation, not an Android OS emulator.
Network interpolation remains covered by the separate jitter-buffer tests.

The tuned tracker preserves sample intervals up to the existing gap threshold,
uses trapezoidal acceleration/velocity integration and a faster acceleration
filter, and detects linear rest independently of wrist rotation. Marginal noise
decays the rest timer rather than repeatedly clearing it; clear motion resets it
immediately. Calibration, bounded speed/reach, 1:1 orientation and the sustained
integration drift guard remain. An aggressively loosened version improved ideal
trials but saturated on real recorded input, so it was rejected.

Before game gain, representative synthetic results:

| Trial | Previous | Tuned |
| --- | ---: | ---: |
| Known 50 cm lateral span: estimated span | 40.4 cm | 49.8 cm |
| Slow sweep: position RMS error | 23.84 cm | 8.54 cm |
| Irregular 30 Hz: position RMS error | 19.38 cm | 6.04 cm |
| 20 fresh mixed cases: mean position RMS error | 16.02 cm | 7.43 cm |

`npm test` covers 14 named virtual cases and 20 fresh mixed variants, plus the
previous game/sensor/network tests. Sixteen additional development variants
are summarized in the generated report. These are synthetic errors, not real
Android accuracy claims. Constant-velocity travel, unknown initial velocity,
orientation/gravity errors and absolute position remain ambiguous from an IMU
alone. Long continuous motion still trades tracking fidelity for drift control.

`npm run trial:compare` reprocesses the newest complete real trial locally,
showing span and game-range clipping for both trackers. The saved real trial
used during this tuning had zero natural-swing samples beyond the default
game range in both conservative versions; this checks saturation, not physical
accuracy. Reload both devices and recalibrate after updating.

### iPhone support and device detection

The controller detects iPhone, iPad (including desktop-style iPad user agents),
Android, or a generic phone browser. Labels and permission guidance follow that
detection; capabilities determine behavior. Both device types use the same
existing motion, calibration, 1:1 orientation and tracking constants.

Use the public HTTPS game, create a pairing, scan its QR with iPhone and open
the controller directly in Safari. Tap **Connect & enable motion**, allow
Motion & Orientation, then calibrate. Both sensor permission requests start
synchronously inside the tap handler, before awaiting audio or network work.
Audio unlocking is attempted in that gesture too, with webkitAudioContext
fallback, and cannot block sensor pairing. Denial leaves Connect available for
retry. Device detection is automatic; browser permission still requires a tap.

Feedback is capability-based: supported browsers can vibrate; otherwise the
vibration checkbox is disabled and impact sound plus a brief border flash
remain available. This avoids promising browser haptics on iPhone. Wake lock
is optional and reacquired when returning to the controller. Hiding the phone
page still pauses play. Reconnecting ignores stale socket callbacks.

`tests/phone-platform.test.mjs` executes the controller script with iOS and
Android API doubles, including permission activation, denial, audio startup,
commands, feedback, reconnect and suspension. This confirms the browser flow,
not physical iPhone sensor accuracy or speaker/haptic behavior. A real iPhone
playtest remains required. Public pairing avoids local certificate installation.

References: [Device Orientation and Motion specification](https://w3c.github.io/deviceorientation/),
[Apple DeviceMotionEvent](https://developer.apple.com/documentation/webkitjs/devicemotionevent),
and [WebKit vibration API request](https://bugs.webkit.org/show_bug.cgi?id=288846).

## On-demand private multiplayer

[Open multiplayer](https://joncady.github.io/R3F-Table-Tennis/?multiplayer), or choose
**Play multiplayer** from the game menu. Create a match using the private launch
key, share its invite, then have both players choose **Ready / resume**. Each
player needs a game display and independently chooses mouse/keyboard or a paired
iPhone/Android paddle. Scan the QR belonging to your own seat. Both displays must
be ready; on a paired phone **Pause / ready** also readies that seat. Space or
phone **Toss ball** tosses for the serving player. The match is first to 11,
win by two, with alternating service and a New game option afterward.

The launch key is in the ignored local file `multiplayer/launch-key.local`; it is
not embedded in the public frontend or README. Only room creation needs it;
invited opponents use their private invite. Keep your player URL to reconnect.
A claimed invite cannot claim another seat. Treat player and phone links as
passwords. This prototype deliberately permits **one running match server**.

### What wakes up, and what shuts down

GitHub Pages serves the game and phone pages. An HTTP API + Lambda + on-demand
DynamoDB table create and track rooms. Creating a room launches a single ECS
Fargate task: 0.5 vCPU / 1 GB RAM in Oregon (`us-west-2`). There is no ECS service,
always-on game instance, load balancer, or NAT gateway. Private scoped tokens
identify two displays and two optional phone controllers. Gameplay goes directly
over WSS to the Node server, not through API Gateway/Lambda per frame.

The server runs the shared simulation at 120 Hz, accepts inputs up to about
60 Hz, and publishes ordered snapshots at 30 Hz. It owns serving, contacts,
spin, scoring and both players' movement. The far seat uses a proper 180-degree
court rotation, preserving handedness, quaternion orientation and spin. The CPU
is disabled for multiplayer; solo play and its existing phone relay remain.
The browser interpolates ball/paddle positions; local prediction and lag
compensation are future work.

`match.pingpong.kureo.dev` belongs to an isolated delegated DNS zone. Each task
gets a temporary public IP and serves trusted HTTPS/WSS through Caddy. TLS state
is encrypted in a private S3 cache for reuse/renewal. Readiness waits for Route 53
propagation and checks the current task IP with hostname/SNI certificate
validation. The idle DNS record points to reserved TEST-NET space, avoiding
negative caching or a dangling record to a reassigned AWS IP. The main
`kureo.dev` project and its DNS records are unchanged.

Shutdown rules:

- Both displays gone: 90-second reconnect grace, then exit.
- Waiting for players or paused: five-minute timeout.
- Finished game: two minutes to start a rematch.
- Every task: two-hour lifetime cap.
- Independent one-minute watchdog: stop stale-heartbeat/orphan tasks and release
  the active-room lock. The lock is released only after ECS confirms shutdown.

### Verified results — October 17, 2026

A fresh live AWS task connected over public trusted WSS in **51.9 seconds**
with its certificate already cached. It accepted synthetic sensor events through
the actual iPhone and Android controller-page code. A mouse player served legally,
the phone paddle returned the ball, and its controller received authoritative
impact feedback. Phone pause/resume, disconnect pause, switching to mouse, ordered
snapshots, invalid launch-key rejection and the one-server cap passed. After both
clients closed, ECS reported **STOPPED in 115.8 seconds**, exit code 0, and
**zero running tasks**, without a manual stop. Startup/shutdown times vary.

`npm test` additionally covers a full two-human simulation to 11, both serve
ends with mouse/phone, mouse/mouse and phone/phone sockets, seat isolation,
handedness, spin/scoring regressions and local automatic shutdown. These are
synthetic clients and sensor/API doubles: physical iPhone/Android motion feel,
real speaker/vibration behavior, cross-network latency and two-person play still
need hands-on validation. iPhone browser vibration remains unavailable where the
API is unsupported; sound and visual impact feedback are the fallback.

### Cost and development

Game compute is zero when no task is running. Oregon compute plus one public
IPv4 address is approximately **$0.03 per server-hour**, including startup and
grace periods, before bandwidth, logs, API/DynamoDB requests and storage. The DNS
zone has a **$0.50/month** charge; image/certificate storage and the scheduled
serverless watchdog add small idle costs. This is scale-to-zero game compute,
not a promise of an entirely zero idle AWS bill. See
[AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/),
[IPv4 pricing](https://aws.amazon.com/vpc/pricing/), and
[DNS pricing](https://aws.amazon.com/route53/pricing/).

Run `npm run multiplayer` alongside `npm run dev` for local matching at port 8790
and WSS-equivalent local sockets at 8791; use launch key `local-development`.
Run `npm run test:multiplayer` for local coverage and
`npm run test:multiplayer:cloud` for a billable live startup/game/shutdown trial.
Deployment, DNS setup, private files and operational details are in
[multiplayer/README.md](multiplayer/README.md). Public matchmaking, accounts,
rankings, spectators, cross-region placement and migration of active matches
remain out of scope.

## Local webcam translation POC

This experiment is local only and separate from gameplay/phone networking.
Start with `npm run pose:dev`, then open
`http://127.0.0.1:5174/R3F-Table-Tennis/?pose` in Chrome. The preparation command
copies the installed MediaPipe WASM runtime and downloads a checksum-pinned
Google Pose Landmarker Lite model into ignored `public/pose-runtime/` assets.
Inference and webcam frames stay on this computer; no AWS match starts.

A module worker runs single-person pose inference, with GPU processing and CPU
fallback (or an explicit CPU comparison). The browser sends at most one 640px
frame at a time and skips busy frames, keeping inference off the UI thread.
A mirrored video/skeleton preview shows hips and shoulders, confidence, raw and
filtered lateral motion, separate torso lean, and a bounded virtual body marker.
The horizontal image-space hip midpoint is normalized to the neutral shoulder
width; root-relative 3D hip coordinates are not used as room position. Forward/
back movement is fixed. Low-confidence tracking holds position briefly and then
shows LOST; it does not pretend that a missing person moved to center.

### Provide input data

1. Position a fixed webcam 1.5–2.5 m away, with both hips and shoulders visible.
   Use even front lighting; keep the browser foreground and camera stationary.
2. Place center/left/right floor markers, initially 40 cm either side of center.
   Enter the actual marker distance. These are comparison references, not an
   automatic camera-to-meters calibration.
3. Choose **Enable webcam** and allow camera access. First inference can take
   several seconds for compilation; wait for steady results. Use **Set neutral
   stance** to explore movement, or go straight to the guided trial.
4. Optionally select **Also save local webcam video** for visual comparison.
   This records video only, with no microphone. It remains on the local computer.
5. Click **Start guided trial** and follow the 44-second spoken/on-screen cues:
   center still → right marker → center → left marker → center → arm-only swings
   with stationary hips → natural side steps → center still. Initial neutral
   calibration is automatic. Keep this tab visible throughout the trial.
6. Run once without a phone, then repeat holding the phone in your normal
   left-handed paddle grip. No phone connection is needed for this body-only POC.
   Tell Codex when complete, whether left/right felt correct, and whether the
   marker visibly lagged, jittered or moved during arm-only swings.

JSON files save automatically to ignored `controller/.trials/pose/`, with matching
optional `.webm`/`.mp4` video files. They contain landmarks/confidence, neutral
calibration, phase labels, raw/smoothed position, processor choice, marker distance,
and inference/submission-to-result timing. Browser download is a fallback if
local saving fails. Stop camera / hiding the tab ends a trial early and marks it
partial. Finish before closing the page. The development upload endpoint accepts
only same-origin loopback POSTs, bounds sizes, validates filenames and writes
private files; it is not a cloud upload endpoint.

`npm run pose:analyze` summarizes the latest trial's confidence, timing and
per-stage last-two-second lateral mean/variation. Phase labels describe requested
actions, not ground truth: video or observed marker compliance is needed for
accuracy and physical-latency judgments. Timing on screen measures inference and
frame submission-to-result receipt, excluding exposure/camera-driver/display
latency. A blank-frame **Pipeline check** validates loading/worker execution;
it cannot establish human-tracking FPS. Initial targets to evaluate are 20–30
pose updates/sec, p95 submission-to-result below 80 ms, stable marker holds and
little arm-only false body motion. They are goals, not measured guarantees.

`npm run test:pose` checks calibration/sign, hip-vs-arm separation, lean, confidence,
loss/recovery, stage timing and local save safeguards with synthetic data. This
is not a claim of real webcam tracking accuracy. The model/runtime API follows
[Google's browser pose guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
and [official worker example](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/pose-landmarker.worker.ts).

### Local webcam body + phone paddle game

Run `npm run controller` in one terminal and `npm run pose:dev` in another, then open
[the local webcam game](http://127.0.0.1:5174/R3F-Table-Tennis/?webcam)
on this computer, preferably in Chrome. This prototype is available only on
localhost. It has not been published.

1. Place the camera facing you with hips and shoulders visible. Put floor markers
   at center and 40 cm to either side (adjust the distance field if needed).
2. Click **Enable webcam**, allow camera access, then **Calibrate body + paddle**. Pair the phone first. Once you have
   stood visibly at center for three seconds, a ten-second phone-grip stage starts:
   hold the phone in your natural paddle pose, keep still, then follow its short
   rightward hand movement cue. Your body stays at center. Next follow the body
   cues: center, your right, your left, center; hold each for five seconds. These are your physical left/right, facing camera.
3. Pair the phone through **Pair phone** and the QR code. Keep the phone controller
   open, calibrate its paddle as usual, and start/resume with the phone. You can
   instead resume with a mouse; Chrome supports unrestricted pointer capture.
4. Stay on your center marker after calibration. On the phone, tap
   **Start / resume game**, then **Toss ball** when the phone says it is your serve.
   Start/resume is explicit and safe to tap again; **Pause / resume** still toggles
   pause. The phone shows body calibration readiness and match status. There is no
   need to return to the computer to start; webcam and phone grip calibration are
   preserved when starting/resuming. Refresh the local phone controller page to
   load these controls after updating the prototype.
5. Step side to side to move your body and viewpoint. Swing the phone to move and
   rotate the paddle. Toss and pause remain on the phone. Depth stays fixed;
   A/D and W/S are ignored while body tracking is active.

Tracking loss of roughly half a second pauses the game. Return into view and
explicitly resume. Hiding the desktop tab stops the camera; enable/calibrate
again. Recalibrate after moving the camera or changing your playing distance.
The mapping uses median hip positions at both side markers, a small center dead
zone, bounded smoothing and bounded body speed. Torso lean and paddle rotation
are not used to infer body translation. This is calibrated image-space lateral
tracking, not full 3D position measurement.

**Replay last trial** feeds locally saved landmarks through the same mapping
without opening the camera; resume to see the viewpoint move. The paddle remains
live, so this does not replay the phone swing or constitute a complete match.
Replay ends after the saved recording and pauses play. Replay JSON is served only
by the loopback development server with same-origin checks; video is not served.
Webcam frames/landmarks stay on this computer. Phone input uses the local relay on ports 8787/8788. Keep both devices on the
same Wi-Fi; the phone uses the existing local HTTPS certificate setup. This mode
does not launch an AWS multiplayer server.

Validation: `npm run test:webcam`, `npm run test:pose`, `npm test`,
`npm run build`, and `npm run lint`. Automated tests cover mapping, asymmetric
calibration, stale/lost tracking, fixed depth, phone quaternion preservation,
existing game rules, and mouse/phone multiplayer regressions. Physical combined
camera-and-phone play still needs a human trial.

### Free-hand ball and finger-release toss (local prototype)

On your serve, the ball follows the hand opposite the selected playing hand
(right hand for a left-handed player). Webcam pose wrists associate the hand even
when your arms cross; this does not rely on image left/right or a mirrored-hand
label. When finger detail is unavailable, the visible wrist still positions the
ball. Depth remains fixed near the serving position; this is not reconstructed
3D hand position. Lost tracking eventually returns to the paddle-based fallback.

Hold your free palm open and roughly level for about 200 ms, then lift it in a
small upward toss. The gesture estimates shoulder-relative upward speed and
acceleration from a filtered 200 ms history; a lift of about 0.08 shoulder widths
plus an upward speed burst releases the ball once. No closed-hand step is used.
Stationary open hands, tremor, sideways waving and slow lifting do not toss.
Tracking loss disarms release. Gestures are ignored while
paused/calibrating, during rallies, and on AI service. The existing phone Toss
button remains available. The mini camera overlay draws the detected free-hand
fingers in yellow and reports wrist-only/held/released state. Physical distance,
lighting and palm angle affect finger recognition: if it only sees the wrist,
show your fingers clearly toward the camera or use the phone button.

The official Hand Landmarker model is downloaded and checksum-verified by
`npm run pose:prepare`. Body and hand models run in separate local workers because
the installed WASM runtime cannot initialize both tasks in one worker. The hand
model runs asynchronously on a crop around the free wrist at up to 15 Hz,
so finger inference does not hold up body updates; input frames are up to
960 px wide, with a higher-resolution camera requested. Model failure preserves
body tracking and the phone Toss fallback. **Check body + hand models** runs a
camera-free blank-frame diagnostic; its cold-start time is not live human
tracking latency or an accuracy result.

Paddle face smoothing uses shortest-arc quaternion interpolation, with quicker
response for larger turns and gentler filtering near rest; its settled orientation
retains the calibrated 1:1 mapping. The ball's held-hand position is smoothed too.
The guided phone-grip stage reuses the existing gravity/rightward-axis calibration
and reports success to the desktop before starting with webcam movement enabled.
Refresh desktop and phone after updating; restarting the local relay requires
re-pairing. These protocol changes are local/source only, not deployed to AWS.

`npm run test:webcam` includes free-hand association, finger geometry, intentional
release/debounce, lost-tracking disarm and held-ball/toss physics tests.
`npm run test:controller` checks the real WebSocket grip command/acknowledgment;
phone-page tests check remote calibration invocation. Full human finger recognition
and feel still require a live trial. Runtime API follows the
[official Hand Landmarker browser guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

### Fastest release test (default webcam mode)

Open `?webcam`, click **Enable webcam**, then **Start / reset toss test** (or
Start on a paired phone). No side markers, grip calibration, phone pairing,
mouse capture, or completed body calibration is required. Show your shoulders
and free hand; hips are optional in this mode. Player position is held at center,
and hand position is estimated relative to your shoulders when hips are absent.
Hold your open palm level until **PALM READY**, then lift it in a small toss. Missed tosses reset
to your serve automatically so you can repeat. Phone Start also resets the test.

The phone retains its automatic initial neutral orientation; deliberate natural
grip axis calibration is optional under the full-game settings. Full body
movement calibration and model diagnostics are collapsed under **Optional
full-game calibration & diagnostics**. Loss of body tracking does not block or
pause this quick mode, but lost hand tracking still disarms the toss gesture.

The natural toss now uses MediaPipe's hand-local world landmarks to estimate a
roughly horizontal palm plane and visible extended fingers, then measures motion
relative to the shoulders (not raw camera pixels) to reduce body-motion triggers.
Palm-plane sign is deliberately not enforced: this prototype does not reliably
certify palm-versus-back facing, exact horizontal alignment, or legal service
height. Show the palm upward naturally; it is a forgiving gesture, not umpiring.
Frame timestamps, not packet arrival intervals, drive the motion estimate. A
bounded upward ball speed is inferred from the lift; phone/keyboard tosses retain
their existing default speed. Flat-palm ready state and motion speed appear in the
mini camera status. Rule inspiration:
[ITTF 2026, service 2.6](https://documents.ittf.sport/sites/default/files/public/2026-02/2026_Statutes_v1_consolidated_clean.pdf).

### Forgiving wrist toss (current default)

For early testing, simply relax the free hand and lift it to toss. No flat-palm
angle, finger count, stationary hold, acceleration threshold, or extra calibration
is required. A clear fist, when recognized, suppresses release; otherwise missing
finger detail is treated as probably open. Motion always uses the pose wrist
relative to shoulders, so switching between wrist-only and detailed hand tracking
cannot manufacture a toss. Body frames drive this path even when the finger model
is slow or unavailable. Several coherent upward samples, a small rise, and a
1.2-second cooldown reject jitter and duplicate releases. No scoring or service
rules are being enforced by this gesture classifier. Previous strict palm-ready
instructions above describe the superseded prototype.

### Paddle reach and impact feedback

In phone + webcam play, the playing wrist anchors paddle position using the same
shoulder-relative coordinate mapping as the free-hand ball. This keeps lateral
reach and serve height consistent and does not rely on accelerometer integration
for sustained position. Phone orientation continues to set the face; fast,
bounded inertial residuals bridge camera updates, including fore/aft reach.
Brief camera loss falls back to the phone tracker. The camera frame's aspect ratio
is included in vertical mapping. The resting hand is no longer pulled back toward
the handedness offset as the phone's integrated displacement decays.

Real player paddle contacts emit an impact packet through the relay. The phone
plays a short synthesized ping and requests a 14–36 ms vibration pulse when
supported and enabled. **Test sound & vibration** is on the main phone screen;
Advanced includes sound/haptic toggles and **Paddle hits received**. The counter
counts network impacts, not manual feedback tests. Connect/Play/Toss gestures
resume audio to handle browser autoplay restrictions; unavailable or blocked
vibration is reported on the phone. Browser/OS sound settings and hardware output
cannot be verified from the desktop. No relay restart is needed for this update;
refresh desktop and phone once to load it.

`npm run test:webcam` covers both-handed reach beneath the free-hand toss and
resting drift isolation. `npm run test:controller` includes a simulated paddle
collision through the real WebSocket relay into the shipped controller page,
asserting audio oscillator and vibration API calls using device doubles. This
verifies software routing, not physical sound/haptics or live tracking feel.

### Screen face, grip pivot, ball visibility and AI sound

The current webcam pairing link carries `face=screen`. In this mode the physical
screen plane represents the paddle rubber. Device orientation is converted from
the browser's screen coordinate frame to game coordinates; initial alignment and
Recenter choose heading toward the table while preserving gravity-relative pitch
and roll. The old prototype flattened the initial grip into an upright paddle.
Position fallback uses relative motion, so an upright screen's heading does not
push the paddle sideways. Legacy/multiplayer links retain their existing mapping.
Refresh desktop and scan its new QR to opt into the updated face mapping.

The camera tracks the playing wrist as the grip anchor. The blade/collider center
is displaced along the rotated handle-to-blade vector; rotating the phone moves
the blade center around that anchor. **Advanced → Grip → blade center** adjusts
the estimated lever arm (default 0.42 game units). This is a hand/grip estimate,
not a guessed gyroscope chip location. Browser motion APIs expose device-frame
orientation, not sensor mounting coordinates. Rendered face and collision face
share the same orientation/position. Reference:
[W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/).

For webcam play the ball is hidden until a fresh throwing-hand wrist is detected;
phone Toss does nothing without that hand. Hand loss before release hides it;
reacquisition places it directly on the tracked hand without sliding from an old
paddle fallback. A released ball remains visible independently of hand tracking.
AI service is unaffected. Point/game-over balls are hidden too.

AI paddle hits and serves send a softer **sound-only** event to the phone. Player
contacts retain sound + vibration. No AI hit vibrates the player's phone.
`npm run test:webcam` covers screen tilt, grip arcs and tracked-ball visibility;
`npm run test:controller` checks real relay audio and vibration routing, including
AI sound without vibration. The local relay must be restarted for this protocol
addition; the source changes are not deployed to AWS.

### Heading correction from the recorded rotation trial

The 35-second trial showed a physical edge-on phone while the virtual paddle was broadside. The median received-to-displayed quaternion difference was 1.9–5.3° across the six stages; this is a pipeline difference, not a physical accuracy measurement. The primary alignment issue was treating an arbitrary natural grip as a screen-facing-table heading whenever recenter ran.

In webcam screen-face mode, refresh the phone controller and tap **Align screen with webcam · 4 seconds**. Face the screen toward the webcam with its top edge up until the spoken confirmation, then return to your grip. This supplies a known table heading; the webcam is not yet detecting the phone plane automatically. Subsequent position/automatic recentering preserves the established face heading and physical tilt. Legacy controller mapping is unchanged. Physical retesting is still required.

### Full playtest recording (local webcam game)

Click **Record playtest** in the desktop header, then select the game tab or window in the browser capture chooser. Recording continues until you click Stop recording, tap **Stop playtest recording** on the paired phone, or use the browser Stop sharing control. It includes the selected screen (HUD, webcam preview and menus included) and any audio the browser shares. Phone speaker audio is not included. No microphone is requested.

Stopping automatically downloads `ping-pong-playtest-*.webm` (or MP4 when supported). The desktop also keeps **Download video** and **Download motion data** links for that recording. The JSON contains synchronized phone/camera/input, ball, score, phase and pause samples at 10 Hz. Keep the game page open until saving finishes. The recording stays local; no fixed trial duration or spoken movement prompts. Native screen capture requires starting from a desktop click; the phone can stop an already-running recording.
