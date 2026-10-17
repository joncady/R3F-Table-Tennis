# React + TypeScript + Vite

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
