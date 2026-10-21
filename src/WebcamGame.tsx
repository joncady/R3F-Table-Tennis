import RecordingLibrary from "./RecordingLibrary";
import EquipmentPanel from "./EquipmentPanel";
import { useEquipment } from "./equipment";
import ReleaseBadge from "./ReleaseBadge";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Court } from "./App";
import { Match, PlayerInput } from "./engine";
import usePhoneController from "./usePhoneController";
import useWebcamBody from "./useWebcamBody";
import { PlayGate } from "./onboarding";
import "./webcamGame.css";
import { recordOrientationTrial } from "./orientationTrial";
import useSessionMarker from "./useSessionMarker";
import useDiagnostics from "./useDiagnostics";
import { startPlaytestRecording } from "./playtestRecording";
function newGame(hand: "left" | "right") {
  const match = new Match(hand);
  match.requireTrackedHand = true;
  return match;
}
export default function WebcamGame() {
  const webcam = useWebcamBody();
  const [equipment, setEquipment] = useEquipment(),
    [equipmentOpen, setEquipmentOpen] = useState(false);
  const [recording, setRecording] = useState(false),
    [recordBusy, setRecordBusy] = useState(false),
    [recordSeconds, setRecordSeconds] = useState(0),
    [recordStatus, setRecordStatus] = useState(""),
    [recordRevision, setRecordRevision] = useState(0);
  const recordStop = useRef<(() => void) | undefined>(),
    recordMounted = useRef(true);
  useEffect(() => {
    recordMounted.current = true;
    return () => {
      recordMounted.current = false;
      recordStop.current?.();
    };
  }, []);

  const [trialRunning, setTrialRunning] = useState(false),
    [trialStatus, setTrialStatus] = useState(""),
    trialCanvas = useRef<HTMLCanvasElement>(null),
    trialStop = useRef<(() => void) | undefined>();
  useEffect(() => () => trialStop.current?.(), []);
  const [match, setMatch] = useState(() => newGame("left")),
    [hand, setHand] = useState<"left" | "right">("left"),
    [paused, setPaused] = useState(true),
    [advanced, setAdvanced] = useState(false),
    [notice, setNotice] = useState(""),
    [startupMs, setStartupMs] = useState<number | null>(null);
  const input = useRef<PlayerInput>({ x: 0, y: 0, moveX: 0, moveZ: 0 }),
    [, render] = useState(0),
    gate = useRef(new PlayGate()),
    autoPending = useRef(false),
    enableAt = useRef(0),
    host = useRef<HTMLElement>(null);
  const [paddlePivot, setPaddlePivot] = useState(0.42);
  const [phoneSensitivity, setPhoneSensitivity] = useState(2),
    [lateralFollow, setLateralFollow] = useState(1.5),
    [cameraStrength, setCameraStrength] = useState(0.45);
  const update = () => render((n) => n + 1);
  const phone = usePhoneController(
    (command) => {
      if (command === "alignment-start") {
        setPaused(true);
        autoPending.current = true;
        gate.current.reset();
        return;
      }
      if (command === "stop-recording") {
        recordStop.current?.();
        return;
      }
      if (command === "start") {
        play();
        return;
      }
      if (command === "pause") {
        if (paused) play();
        else setPaused(true);
        return;
      }
      if (command === "toss") {
        if (!ready()) return;
        const held = webcam.control.current.hand;
        if (!held || performance.now() - held.at > 250) {
          setNotice("Show your throwing hand before tossing.");
          return;
        }
        match.heldHand = { x: held.x, y: held.y, z: 3.05 };
        if (paused) play();
        if (match.phase === "ready") match.start();
        match.serve();
        update();
        return;
      }
      if (command === "disconnected" || command === "suspend") {
        setPaused(true);
        return;
      }
      if (command === "recenter") {
        input.current.x = 0;
        input.current.y = 0;
        input.current.swingOffset = undefined;
      }
    },
    undefined,
    true,
  );
  webcam.handedness.current = hand;
  webcam.tossEnabled.current =
    phone.aligned && !paused && match.phase === "serve" && match.server === 0;
  function ready() {
    if (!phone.connected) {
      setNotice("Connect your phone first.");
      return false;
    }
    if (webcam.mode !== "camera") {
      setNotice("Enable your webcam to play.");
      return false;
    }
    if (!phone.aligned) {
      setNotice(
        "Show the phone’s session marker to the webcam to align before playing.",
      );
      return false;
    }
    if (!webcam.safe) {
      setNotice("Step into view so the camera can see your shoulders.");
      return false;
    }
    return true;
  }
  function play() {
    if (!ready()) return;
    autoPending.current = false;
    setEquipmentOpen(false);
    setAdvanced(false);
    setNotice("");
    if (match.phase === "over") {
      const next = newGame(hand);
      next.start();
      setMatch(next);
    } else if (match.phase === "ready") match.start();
    setPaused(false);
    update();
    if (enableAt.current && startupMs === null)
      setStartupMs(performance.now() - enableAt.current);
  }
  const startRef = useRef(play);
  startRef.current = play;
  const pairRef = useRef(phone.pair);
  pairRef.current = phone.pair;
  useEffect(() => {
    void pairRef.current();
  }, []);
  const enable = async () => {
    phone.showMarker();
    setPaused(true);
    setNotice("");
    enableAt.current = performance.now();
    setStartupMs(null);
    autoPending.current = true;
    gate.current.reset();
    await webcam.start();
    webcam.autoAlign();
  };
  useEffect(() => {
    if (!autoPending.current) return;
    const timer = setInterval(() => {
      if (!autoPending.current) return;
      if (
        gate.current.update(
          performance.now(),
          phone.connected && phone.aligned,
          webcam.mode === "camera",
          webcam.safe,
        )
      ) {
        clearInterval(timer);
        startRef.current();
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phone.connected, phone.aligned, webcam.mode, webcam.safe]);
  useEffect(() => {
    if (
      !phone.connected ||
      !phone.aligned ||
      webcam.mode !== "camera" ||
      !webcam.safe
    )
      setPaused(true);
  }, [phone.connected, phone.aligned, webcam.mode, webcam.safe]);

  const frameCount = useRef(0),
    lastRenderCount = useRef(0);
  useEffect(() => {
    lastRenderCount.current = frameCount.current;
  }, [advanced]);
  const markerStatus = useSessionMarker(
    webcam.video,
    phone.pairing?.marker,
    phone.connected &&
      webcam.mode === "camera" &&
      !phone.aligned &&
      !phone.syncing,
    phone.syncScreen,
  );
  const diagnostics = useDiagnostics(advanced, () => {
    const renderFps = frameCount.current - lastRenderCount.current;
    lastRenderCount.current = frameCount.current;
    return {
      renderFps,
      ...phone.diagnostics(),
      cameraLatencyMs: Math.round(webcam.latency),
      confidence: Math.round(webcam.confidence * 100),
      tracking: webcam.safe ? "ready" : "lost",
      alignment: phone.aligned
        ? "synced"
        : phone.syncing
          ? "syncing"
          : "required",
      backend: webcam.backend || "loading",
    };
  });
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        phone.connected &&
        phone.pose.current &&
        performance.now() - phone.pose.current.received > 1000
      )
        setPaused(true);
    }, 250);
    return () => clearInterval(timer);
  }, [phone.connected, phone.pose]);
  const fineTuneRef = useRef(phone.calibrateGrip);
  fineTuneRef.current = phone.calibrateGrip;
  useEffect(() => {
    if (webcam.calibrationCue && phone.connected) fineTuneRef.current();
  }, [webcam.calibrationCue, phone.connected]);
  const message = !phone.connected
    ? "Connect your phone to the game."
    : webcam.mode !== "camera"
      ? "Enable webcam on the computer."
      : !phone.aligned
        ? "Show your phone’s marker to the webcam to align."
        : !webcam.safe
          ? "Step into view — shoulders visible."
          : paused
            ? "Ready — tap Play / resume."
            : match.phase === "serve"
              ? match.server === 0
                ? "Your serve — lift your free hand or tap Toss."
                : "AI serving."
              : match.phase === "over"
                ? "Match finished — tap Play for another game."
                : "Playing — swing to return.";
  const reportRef = useRef(phone.reportStatus);
  reportRef.current = phone.reportStatus;
  useEffect(() => {
    reportRef.current(message);
  }, [message, phone.connected]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)
      )
        return;
      if (e.code === "Escape") setPaused(true);
      if (e.code === "KeyF" && !e.repeat) {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else
          void host.current
            ?.requestFullscreen()
            .catch(() =>
              setNotice("Fullscreen is unavailable in this browser."),
            );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const recordingSample = useRef(() => ({}));
  recordingSample.current = () => ({
    phone: phone.pose.current,
    body: webcam.control.current,
    input: input.current,
    hand,
    pivot: paddlePivot,
    score: [...match.score],
    phase: match.phase,
    paused,
    ball: { ...match.ball },
  });
  async function recordPlaytest() {
    if (recordBusy || trialRunning) return;
    if (recordStop.current) {
      recordStop.current();
      setRecordBusy(true);
      setRecordStatus("Saving playtest…");
      return;
    }
    setRecordBusy(true);
    setRecordStatus(
      "Choose the game tab or window in the screen-sharing prompt.",
    );
    try {
      recordStop.current = await startPlaytestRecording({
        sample: () => recordingSample.current(),
        tick: setRecordSeconds,
        error: setRecordStatus,
        finished: (saved) => {
          recordStop.current = undefined;
          if (!recordMounted.current) return;
          setRecordRevision((n) => n + 1);
          setRecording(false);
          setRecordBusy(false);
          setRecordStatus(
            saved.status === "complete"
              ? "Playtest saved locally. Open Developer tools → Saved recordings to export."
              : "Recording interrupted. Open Saved recordings to recover the captured portion.",
          );
        },
      });
      setRecording(true);
      setRecordSeconds(0);
      setRecordStatus(
        "Recording · stop here, on your phone, or with the browser’s Stop sharing button.",
      );
      setAdvanced(false);
    } catch (e) {
      setRecordStatus(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Screen recording cancelled."
          : String(e),
      );
    } finally {
      setRecordBusy(false);
    }
  }
  async function startRotationTrial() {
    const video = webcam.video.current,
      game = host.current?.querySelector("canvas"),
      preview = trialCanvas.current;
    if (!phone.connected || !video?.videoWidth || !game || !preview) {
      setTrialStatus("Connect your phone and enable webcam first.");
      return;
    }
    setTrialRunning(true);
    setAdvanced(false);
    try {
      trialStop.current = await recordOrientationTrial({
        video,
        game,
        preview,
        sample: () => ({
          phone: phone.pose.current,
          body: webcam.control.current,
          input: input.current,
          hand,
          pivot: paddlePivot,
        }),
        status: setTrialStatus,
        done: () => {
          setTrialRunning(false);
          trialStop.current = undefined;
        },
      });
    } catch (e) {
      setTrialRunning(false);
      setTrialStatus(String(e));
    }
  }
  const showSetup =
    !trialRunning &&
    (paused || match.phase === "ready" || match.phase === "over");
  return (
    <main ref={host} className="play-game">
      <header>
        <div className="brand">
          TABLE / TENNIS
          <ReleaseBadge />
          <small>Phone paddle · webcam movement</small>
        </div>
        <div className="score">
          <span>
            YOU <b>{match.score[0]}</b>
          </span>
          <i>:</i>
          <span>
            <b>{match.score[1]}</b> AI
          </span>
        </div>
        <div className="view-controls">
          <button
            onClick={() => {
              if (paused) play();
              else setPaused(true);
            }}
          >
            {paused ? "Play" : "Pause"}
          </button>
          <button
            onClick={() => {
              autoPending.current = false;
              setPaused(true);
              setEquipmentOpen(false);
              setAdvanced((v) => !v);
            }}
          >
            Developer tools
          </button>
          <button
            onClick={() => {
              autoPending.current = false;
              setPaused(true);
              setAdvanced(false);
              setEquipmentOpen((v) => !v);
            }}
          >
            Paddle setup
          </button>
          <button
            onClick={() => {
              location.href = import.meta.env.BASE_URL;
            }}
          >
            Modes
          </button>
        </div>
      </header>
      <Canvas
        gl={{ preserveDrawingBuffer: true }}
        frameloop={paused && !trialRunning ? "demand" : "always"}
      >
        <color attach="background" args={["#102a34"]} />
        <Suspense fallback={null}>
          <Court
            running={!paused || trialRunning}
            paddleEquipment={equipment}
            frameCount={frameCount}
            paddlePivot={paddlePivot}
            bodyControl={webcam.control}
            match={match}
            input={input}
            update={update}
            cameraStrength={cameraStrength}
            phoneActive={phone.connected}
            phonePose={phone.pose}
            samplePhonePose={phone.samplePose}
            phoneSensitivity={phoneSensitivity}
            lateralFollow={lateralFollow}
            impact={phone.impact}
          />
        </Suspense>
      </Canvas>
      <div
        className={`play-camera ${showSetup ? "setup-camera" : ""}`}
        style={{ visibility: webcam.mode === "camera" ? "visible" : "hidden" }}
        aria-hidden={webcam.mode !== "camera"}
      >
        <video ref={webcam.video} muted playsInline />
        <canvas ref={webcam.canvas} />
      </div>
      {showSetup && (
        <div className="play-onboarding">
          <article>
            <small>PLAY WITH YOUR PHONE + WEBCAM</small>
            <h1>
              {match.phase === "over"
                ? "Good game."
                : match.phase === "ready"
                  ? "Pick up your paddle."
                  : "Take a breath."}
            </h1>
            <p>{message}</p>
            <div className="setup-steps">
              <section className={phone.connected ? "complete" : ""}>
                <h2>1 · Connect phone {phone.connected && "✓"}</h2>
                <small>Session {phone.pairing?.sessionCode || "…"}</small>
                {!phone.connected && phone.pairing ? (
                  <>
                    <img
                      width="164"
                      height="164"
                      src={phone.pairing.qr}
                      alt="Connect your phone QR code"
                    />
                    <p>Scan, then tap Connect phone.</p>
                    <a
                      href={phone.pairing.phoneUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open controller link
                    </a>
                  </>
                ) : (
                  <p>
                    {phone.connected
                      ? "Phone connected. Hold it naturally like a paddle."
                      : phone.status}
                  </p>
                )}
                {!phone.pairing && !phone.connected && (
                  <button onClick={() => void phone.pair()}>
                    Retry pairing
                  </button>
                )}
              </section>
              <section>
                <h2>2 · Enable webcam {webcam.mode === "camera" && "✓"}</h2>
                <p>
                  Stand where your shoulders and hands are visible. Show your
                  shoulders and hands. Then hold your phone’s marker toward the
                  camera.
                </p>
                <button
                  disabled={!phone.connected || webcam.busy}
                  onClick={() => void enable()}
                >
                  {webcam.busy
                    ? "Starting camera…"
                    : webcam.mode === "camera"
                      ? "Recenter camera"
                      : "Enable webcam"}
                </button>
                <p>
                  {webcam.mode === "camera" && !webcam.safe
                    ? "Finding your position…"
                    : webcam.safe
                      ? "Camera tracking ready."
                      : "The game starts automatically when you’re in view."}
                </p>
              </section>
              <section className={phone.aligned ? "complete" : ""}>
                <h2>3 · Align paddle {phone.aligned && "✓"}</h2>
                <p>
                  {phone.aligned
                    ? "Phone and webcam synchronized. Hold your paddle naturally."
                    : phone.syncing
                      ? "Synchronizing phone…"
                      : markerStatus}
                </p>
                <button
                  disabled={!phone.connected}
                  onClick={() => {
                    setPaused(true);
                    autoPending.current = true;
                    phone.showMarker();
                  }}
                >
                  Show marker on phone
                </button>
                {phone.markerRequest !== "idle" && !phone.aligned && (
                  <p role="status">
                    {phone.markerRequest === "requesting"
                      ? "Opening the marker on your paired phone…"
                      : phone.markerRequest === "shown"
                        ? "Marker opened on your phone. Point that screen toward the webcam."
                        : "Your phone did not respond. Open its controller page, then retry. Refresh and scan a new pairing QR if needed."}
                  </p>
                )}
              </section>
            </div>
            <div className="simple-hand">
              <span>Playing hand</span>
              {(["left", "right"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={hand === value}
                  onClick={() => {
                    setHand(value);
                    match.setHand(value);
                    update();
                  }}
                >
                  {value === "left" ? "Left" : "Right"}
                </button>
              ))}
            </div>
            {phone.connected && phone.aligned && webcam.safe && (
              <button className="primary-play" onClick={play}>
                Play / resume
              </button>
            )}
            <p className="play-error" role="status">
              {webcam.error || notice}
            </p>
            <p className="play-help">
              Move sideways · swing your phone · lift your free hand to toss
              <br />
              Pause and resume on your phone · F fullscreen
            </p>
          </article>
        </div>
      )}
      {!showSetup && (
        <section className="status">
          <span>FIRST TO 11 · WIN BY TWO</span>
          <h2>{message}</h2>
          {notice && <p>{notice}</p>}
        </section>
      )}

      {advanced && recordStatus && (
        <aside className="playtest-recording" role="status">
          <span>{recordStatus}</span>
          {!recording && !recordBusy && (
            <button
              onClick={() => {
                setRecordStatus("");
              }}
            >
              Dismiss
            </button>
          )}
        </aside>
      )}
      <section
        className={`rotation-trial ${trialRunning ? "recording" : ""}`}
        style={{ display: trialRunning || trialStatus ? "block" : "none" }}
      >
        <p role="status">{trialStatus}</p>
        <canvas ref={trialCanvas} />
        {trialRunning && (
          <button onClick={() => trialStop.current?.()}>
            Stop trial early
          </button>
        )}
        {!trialRunning && (
          <button onClick={() => setTrialStatus("")}>Dismiss</button>
        )}
      </section>
      {equipmentOpen && (
        <EquipmentPanel
          equipment={equipment}
          change={setEquipment}
          restart={() => {
            autoPending.current = false;
            setMatch(newGame(hand));
            setPaused(true);
          }}
          close={() => setEquipmentOpen(false)}
          locked={match.phase !== "ready" && match.phase !== "over"}
        />
      )}
      {advanced && (
        <aside className="play-advanced">
          <button onClick={() => setAdvanced(false)}>
            Close developer tools
          </button>
          <h2>Developer tools</h2>
          <h3>Live diagnostics</h3>
          <dl className="diagnostics">
            {Object.entries(diagnostics).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <RecordingLibrary
            revision={recordRevision}
            active={recording || recordBusy}
          />
          <h3>Playtest recording</h3>
          <button
            disabled={recordBusy || trialRunning}
            onClick={() => void recordPlaytest()}
          >
            {recordBusy
              ? "Please wait…"
              : recording
                ? `Stop recording · ${Math.floor(recordSeconds / 60)}:${String(Math.floor(recordSeconds % 60)).padStart(2, "0")}`
                : "Record playtest"}
          </button>
          <h3>Tracking & tuning</h3>
          <button
            disabled={trialRunning || recording || recordBusy}
            onClick={() => void startRotationTrial()}
          >
            Record rotation trial · 35 seconds
          </button>
          <p>
            Records webcam + game and rotation data locally to Downloads. Spoken
            cues; no tossing required.
          </p>
          <p>{webcam.status}</p>
          <p>
            {phone.status} · camera {webcam.confidence.toFixed(2)} ·{" "}
            {webcam.latency.toFixed(0)} ms · {webcam.backend}
          </p>
          <p>{webcam.handStatus}</p>
          <p>
            {startupMs === null
              ? "Startup timer begins at Enable webcam."
              : `Camera click → playable: ${(startupMs / 1000).toFixed(2)} seconds`}
          </p>
          <button
            onClick={() => {
              setPaused(true);
              void phone.pair();
            }}
          >
            Change phone pairing
          </button>
          {phone.pairing?.certificateUrl && (
            <p>
              First local connection:{" "}
              <a href={phone.pairing.certificateUrl}>local CA certificate</a>.
              Trust the prototype certificate on your phone before connecting.
            </p>
          )}
          <button onClick={phone.align}>Recenter paddle now</button>
          <button onClick={phone.calibrateGrip}>Fine-tune phone grip</button>
          <button
            onClick={() => {
              setPaused(true);
              webcam.calibrate();
            }}
          >
            Full marker calibration
          </button>
          <button
            onClick={() => {
              setPaused(true);
              void webcam.checkModels();
            }}
          >
            Check tracking models
          </button>
          <button
            onClick={() => {
              setPaused(true);
              webcam.stop();
            }}
          >
            Stop webcam
          </button>
          <button
            onClick={() => {
              setPaused(true);
              const next = newGame(hand);
              setMatch(next);
            }}
          >
            New game
          </button>
          {[
            ["Grip → blade center", paddlePivot, setPaddlePivot, 0.15, 0.65],
            ["Phone reach", phoneSensitivity, setPhoneSensitivity, 0.5, 3],
            ["Lateral reach", lateralFollow, setLateralFollow, 1, 10],
            ["Camera follow", cameraStrength, setCameraStrength, 0, 1],
          ].map(([label, value, set, min, max]) => (
            <label key={String(label)}>
              {String(label)}
              <input
                aria-label={String(label)}
                type="range"
                min={Number(min)}
                max={Number(max)}
                step="0.05"
                value={Number(value)}
                onChange={(e) =>
                  (set as (n: number) => void)(Number(e.target.value))
                }
              />
            </label>
          ))}
          <a href="?pose">Measurement lab</a>
          <a href="?legacy">Mouse / keyboard prototype</a>
          <a href="?multiplayer">Multiplayer</a>
        </aside>
      )}
    </main>
  );
}
