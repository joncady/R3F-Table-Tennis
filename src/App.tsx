import usePhoneController, { PhonePose } from './usePhoneController';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, PerspectiveCamera } from '@react-three/drei';
import { Box3, Euler, Group, Mesh, Quaternion, Vector3 } from 'three';
import { Match, PlayerInput, followSwing } from './engine';

function Model({ url, size, position }: { url: string; size: [number, number, number]; position: [number, number, number] }) {
 const { scene } = useGLTF(url);
 const [object] = useState(() => {
  const copy = scene.clone(true);
  const box = new Box3().setFromObject(copy);
  const dimensions = box.getSize(new Vector3());
  copy.position.sub(box.getCenter(new Vector3()));
  const group = new Group();
  group.add(copy);
  group.scale.set(size[0] / dimensions.x, size[1] / dimensions.y, size[2] / dimensions.z);
  return group;
 });
 return <primitive object={object} position={position} />;
}

export function Court({ match, input, update, cameraStrength, phoneActive, phonePose, phoneSensitivity, lateralFollow, impact }: { lateralFollow: number; phoneSensitivity: number; phoneActive: boolean; phonePose: React.MutableRefObject<PhonePose | null>; impact: (strength: number) => void; cameraStrength: number; match: Match; input: React.MutableRefObject<PlayerInput>; update: () => void }) {
 const ball = useRef<Mesh>(null);
 const human = useRef<Group>(null);
 const ai = useRef<Group>(null);
 const accumulator = useRef(0);
 const previous = useRef('');
 const lastImpact = useRef({match, sequence:match.impactSequence});
 const phoneRotation = useRef(new Quaternion());
 const sway = useRef({ yaw: 0, pitch: 0, x: 0, y: 0 });
 useFrame((state, delta) => {
  const pose = phonePose.current;
  if (phoneActive && pose && performance.now() - pose.received < 500) {
   input.current.swingOffset = pose.swing ? pose.swing.map((value, axis) => value * phoneSensitivity * (axis === 0 ? lateralFollow : 1)) as [number,number,number] : undefined;
   // Position gain is independent of the 1:1 calibrated face orientation.
   input.current.x = Math.max(-1, Math.min(1, pose.x * phoneSensitivity));
   input.current.y = Math.max(-1, Math.min(1, pose.y * phoneSensitivity));
   if (pose.q) phoneRotation.current.fromArray(pose.q).normalize();
   else phoneRotation.current.setFromEuler(new Euler(pose.pitch, pose.yaw, pose.roll, 'YXZ'));
   input.current.orientation = phoneRotation.current.toArray() as [number,number,number,number];
  }
  input.current.phone = phoneActive;
  if (!phoneActive || !pose || performance.now() - pose.received >= 500) input.current.swingOffset = undefined;

  accumulator.current += Math.min(delta, .1);
  while (accumulator.current >= 1 / 120) {
   match.step(1 / 120, input.current);
   if (!phoneActive) { input.current.x *= Math.exp(-.8 / 120); input.current.y *= Math.exp(-2.4 / 120); }
   accumulator.current -= 1 / 120;
  }
  const moving = match.phase === 'serve' || match.phase === 'toss' || match.phase === 'rally';
  followSwing(sway.current, moving ? match.brush.x : 0, moving ? match.brush.y : 0, delta, cameraStrength);
  if (lastImpact.current.match !== match) lastImpact.current = {match,sequence:match.impactSequence};
  else if (lastImpact.current.sequence !== match.impactSequence) { lastImpact.current.sequence = match.impactSequence; impact(match.impactStrength); }
  state.camera.position.set(match.body.x + sway.current.x, 2.75 + sway.current.y, match.body.z + .8);
  state.camera.rotation.set(-.30 + sway.current.pitch, sway.current.yaw, 0);
  if (ball.current) {
   ball.current.rotateX(match.ball.wx * delta);
   ball.current.rotateY(match.ball.wy * delta);
   ball.current.rotateZ(match.ball.wz * delta);
  }
  ball.current?.position.set(match.ball.x, match.ball.y, match.ball.z);
  human.current?.position.set(match.paddles[0].x, match.paddles[0].y, match.paddles[0].z);
  ai.current?.position.set(match.paddles[1].x, match.paddles[1].y, match.paddles[1].z);
  if (human.current && phoneActive) human.current.quaternion.copy(phoneRotation.current);
  else if (human.current) {
   const desired = match.backhand ? Math.PI : 0;
   human.current.rotation.y += (desired - human.current.rotation.y) * (1 - Math.exp(-delta * 16));
   human.current.rotation.z = (match.handedness === 'right' ? -.14 : .14) - input.current.x * .16;
  }
  const key = `${match.phase}:${match.score}:${match.message}:${match.backhand}`;
  if (key !== previous.current) { previous.current = key; update(); }
 });
 return <>
  <PerspectiveCamera makeDefault position={[0, 2.75, 4.85]} rotation={[-.30, 0, 0]} fov={70} />
  <ambientLight intensity={1.4} /><directionalLight position={[3, 8, 4]} intensity={2} />
  <Model url="./models/table_tennis_table.glb" size={[3.05, 1.85, 5.48]} position={[0, .855, 0]} />
  <mesh position={[0, 1.73, 0]}><boxGeometry args={[3.35, .3, .035]} /><meshStandardMaterial color="#c2d9dc" wireframe /></mesh>
  <mesh ref={ball}><sphereGeometry args={[.08, 20, 20]} /><meshStandardMaterial color="#fff6d5" emissive="#8b6928" emissiveIntensity={.25} /><mesh><sphereGeometry args={[.081, 16, 8, 0, .18]} /><meshBasicMaterial color="#dc6b36" side={2} /></mesh></mesh>
  <group ref={human}><Model url="./models/ping_pong_paddle.glb" size={[.75, 1, .12]} position={[0, -.18, 0]} /></group>
  <group ref={ai}><Model url="./models/ping_pong_paddle.glb" size={[.75, 1, .12]} position={[0, -.18, 0]} /></group>
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.05, 0]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#102a34" /></mesh>
 </>;
}

export default function App() {
 const surface = useRef<HTMLElement>(null);
 const [lateralFollow, setLateralFollow] = useState(1.5);
 const [phoneSensitivity, setPhoneSensitivity] = useState(2);
 const [phoneActive, setPhoneActive] = useState(false);
 const [showPairing, setShowPairing] = useState(false);
 const [cameraStrength, setCameraStrength] = useState(.65);
 const [freeMouse, setFreeMouse] = useState(false);
 const [mouseLocked, setMouseLocked] = useState(false);
 const [mouseError, setMouseError] = useState('');
 const [fullscreenError, setFullscreenError] = useState('');
 const [hand, setHand] = useState<'left' | 'right'>('left');
 const [match, setMatch] = useState(() => new Match('left'));
 const activeMatch = useRef(match);
 activeMatch.current = match;
 const [, render] = useState(0);
 const [paused, setPaused] = useState(false);
 const input = useRef<PlayerInput>({ x: 0, y: 0, moveX: 0, moveZ: 0 });
 const update = () => render(n => n + 1);
 const phone = usePhoneController(command => {
  if (!phoneActive) return;
  if (command === 'toss') { if (activeMatch.current.phase === 'ready') { activeMatch.current.start(); setPaused(false); } else activeMatch.current.serve(); update(); }
  if (command === 'pause') setPaused(value => !value);
  if (command === 'disconnected' || command === 'suspend') setPaused(true);
  if (command === 'recenter') { input.current.swingOffset = undefined; input.current.x = 0; input.current.y = 0; }
 });
 useEffect(() => {
  if (!phoneActive) return;
  const timer = window.setInterval(() => {
   if (phone.pose.current && performance.now() - phone.pose.current.received > 1000) setPaused(true);
  }, 250);
  return () => clearInterval(timer);
 }, [phoneActive, phone.pose]);
 const captureMouse = useCallback(() => {
  if (phoneActive) { setPaused(false); return; }
  const element = surface.current;
  setMouseError(''); setFreeMouse(false);
  if (!element?.requestPointerLock) { setMouseError('Mouse capture is unavailable here. Open the game in Chrome for unrestricted mouse movement.'); setPaused(true); return; }
  try {
   const pending = element.requestPointerLock() as unknown as Promise<void> | undefined;
   if (pending) void pending.catch(() => { setMouseError('Mouse capture was blocked. Retry, or open this game in Chrome for unrestricted swings.'); setPaused(true); });
  } catch { setMouseError('Mouse capture was blocked. Retry, or open this game in Chrome for unrestricted swings.'); setPaused(true); }
 }, [phoneActive]);
 const pauseGame = () => { setPaused(true); if (document.pointerLockElement) document.exitPointerLock(); };
 useEffect(() => {
  const change = () => {
   const locked = document.pointerLockElement === surface.current;
   setMouseLocked(locked);
   setPaused(!locked && activeMatch.current.phase !== 'over' && activeMatch.current.phase !== 'ready');
   input.current.moveX = 0; input.current.moveZ = 0;
  };
  const error = () => { setMouseError('Mouse capture was blocked. Retry, or open this game in Chrome for unrestricted swings.'); setPaused(true); };
  document.addEventListener('pointerlockchange', change);
  document.addEventListener('pointerlockerror', error);
  return () => { document.removeEventListener('pointerlockchange', change); document.removeEventListener('pointerlockerror', error); };
 }, []);
 useEffect(() => { if (match.phase === 'over' && document.pointerLockElement) document.exitPointerLock(); }, [match.phase]);
 useEffect(() => {
  const fullscreenKey = async (event: KeyboardEvent) => {
   if (event.code !== 'KeyF' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
   if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return;
   event.preventDefault();
   try {
    setFullscreenError('');
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (surface.current?.requestFullscreen) await surface.current.requestFullscreen();
    else setFullscreenError('Fullscreen is unavailable in this browser.');
   } catch { setFullscreenError('Fullscreen was unavailable. Try opening the game in your browser.'); }
  };
  window.addEventListener('keydown', fullscreenKey);
  return () => window.removeEventListener('keydown', fullscreenKey);
 }, []);
 useEffect(() => {
  const controls = input.current;
  const held = new Set<string>();
  const movement = () => {
   controls.moveX = Number(held.has('KeyD')) - Number(held.has('KeyA'));
   controls.moveZ = Number(held.has('KeyS')) - Number(held.has('KeyW'));
  };
  const key = (event: KeyboardEvent) => {
   if (['KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(event.code)) {
    event.preventDefault(); if (!paused) held.add(event.code); movement();
   }
   if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat && !paused) { if (match.phase === 'ready') { match.start(); setPaused(true); captureMouse(); } else match.serve(); update(); }
   }
   if (event.code === 'Escape' && !event.repeat) { setPaused(true); if (document.pointerLockElement) document.exitPointerLock(); }
  };
  const keyup = (event: KeyboardEvent) => { held.delete(event.code); movement(); };
  const blur = () => { held.clear(); movement(); setPaused(true); };
  const mouse = (event: MouseEvent) => {
   if (phoneActive || (!freeMouse && document.pointerLockElement !== surface.current) || paused || match.phase === 'ready' || match.phase === 'over') return;
   controls.x = Math.max(-1, Math.min(1, controls.x + event.movementX * .009));
   controls.y = Math.max(-1, Math.min(1, controls.y - event.movementY * .009));
  };
  window.addEventListener('keydown', key); window.addEventListener('keyup', keyup);
  window.addEventListener('mousemove', mouse); window.addEventListener('blur', blur);
  return () => {
   controls.moveX = 0; controls.moveZ = 0;
   window.removeEventListener('keydown', key); window.removeEventListener('keyup', keyup);
   window.removeEventListener('mousemove', mouse); window.removeEventListener('blur', blur);
  };
 }, [match, paused, freeMouse, phoneActive, captureMouse]);
 return <main ref={surface}>
  {showPairing && <div className="overlay pairing"><article><small>ANDROID CONTROLLER</small><h1>Pair your paddle.</h1><p>{phone.status}</p><button onClick={phone.pair}>Create pairing / retry</button>{phone.pairing && <><img width="180" height="180" src={phone.pairing.qr} alt="Android controller pairing QR code" />{phone.pairing.certificateUrl?<p>Same Wi-Fi. First install the local CA on Android from <a href={phone.pairing.certificateUrl}>{phone.pairing.certificateUrl}</a> under Settings → Security → Install certificate → CA certificate. This trusts only this prototype’s locally generated CA; remove it when finished.</p>:<p>Public HTTPS controller: scan the QR on Android, tap Connect, and calibrate. No local certificate or shared Wi-Fi is needed. The phone shows round-trip latency through this game.</p>}<p>Then scan the QR or open <a href={phone.pairing.phoneUrl}>{phone.pairing.phoneUrl}</a>, tap Connect, and calibrate.</p></>}<button disabled={!phone.connected} onClick={() => { setPhoneActive(true); setShowPairing(false); input.current.x=0; input.current.y=0; }}>Use phone · resume from game</button><button onClick={() => { setPhoneActive(false); setShowPairing(false); }}>Use mouse</button></article></div>}

  <header><div className="brand">TABLE / TENNIS<small>First-person singles</small></div><div className="score"><span className={match.server === 0 ? 'server' : ''}>YOU <b>{match.score[0]}</b></span><i>:</i><span className={match.server === 1 ? 'server' : ''}><b>{match.score[1]}</b> AI</span></div><div className="view-controls"><button onClick={() => { pauseGame(); setShowPairing(true); }}>Phone</button><button onClick={() => { if (paused) { if (match.phase === 'ready') { match.start(); update(); } captureMouse(); } else pauseGame(); }}>{paused ? 'Resume' : 'Pause'}</button></div></header>
  <Canvas frameloop={paused ? 'never' : 'always'}><color attach="background" args={['#102a34']} /><Suspense fallback={null}><Court match={match} input={input} update={update} cameraStrength={cameraStrength} phoneActive={phoneActive} phonePose={phone.pose} phoneSensitivity={phoneSensitivity} lateralFollow={lateralFollow} impact={phone.impact} /></Suspense></Canvas>
  <section className="status"><span>{match.score[0] >= 10 && match.score[1] >= 10 ? 'DEUCE · WIN BY TWO' : 'FIRST TO 11 · WIN BY TWO'}</span><h2>{match.message}</h2>{fullscreenError && <p role="status">{fullscreenError}</p>}{mouseError && <p role="status">{mouseError}</p>}<p>A/D to move · W/S to step · Move mouse to swing · Space to toss · F fullscreen · Esc to pause · {phoneActive ? 'Android paddle' : 'Mouse paddle'} · {mouseLocked ? 'Mouse captured' : 'Mouse free'} · {match.backhand ? 'Backhand' : 'Forehand'}</p></section>
  {(match.phase === 'ready' || match.phase === 'over' || paused) && <div className="overlay"><article><small>TABLE / TENNIS</small><h1>{paused ? 'Take a breather.' : match.phase === 'over' ? match.winner === 0 ? 'You win!' : 'AI wins.' : 'Find your rhythm.'}</h1><p>{match.phase === 'over' ? `${match.score[0]} – ${match.score[1]}` : 'Move your body with A/D and take short steps with W/S. Sweep the mouse to swing your paddle. Space tosses the ball; swing as it drops to serve. Cross your body for a backhand. Brush up for topspin, down for backspin, or sideways for sidespin. Contact returns automatically. Starting captures and hides the mouse; Escape releases it.'}</p>{mouseError && <><p role="status">{mouseError}</p><button onClick={() => { setFreeMouse(true); setPaused(false); }}>Continue with limited mouse</button></>}<button onClick={() => { pauseGame(); setShowPairing(true); }}>Pair Android phone</button><label className="camera-setting">Lateral follow <input aria-label="Lateral follow" type="range" min="1" max="10" step="0.5" value={lateralFollow} onChange={event => setLateralFollow(Number(event.target.value))} />{lateralFollow.toFixed(1)}×</label><label className="camera-setting">Phone reach <input aria-label="Phone reach sensitivity" type="range" min="0.5" max="3" step="0.1" value={phoneSensitivity} onChange={event => setPhoneSensitivity(Number(event.target.value))} />{phoneSensitivity.toFixed(1)}×</label><label className="camera-setting">Camera follow <input aria-label="Camera follow" type="range" min="0" max="1" step="0.05" value={cameraStrength} onChange={event => setCameraStrength(Number(event.target.value))} />{cameraStrength === 0 ? 'Off' : 'Subtle'}</label><div className="hand-choice" role="group" aria-label="Playing hand">{(['left', 'right'] as const).map(choice => <button key={choice} aria-pressed={hand === choice} disabled={match.phase === 'toss' || match.phase === 'rally'} onClick={() => { setHand(choice); match.setHand(choice); input.current.x = 0; input.current.y = 0; update(); }}>{choice === 'left' ? 'Left handed' : 'Right handed'}</button>)}</div><button onClick={() => { if (paused) { if (match.phase === 'ready') { match.start(); update(); } captureMouse(); } else if (match.phase === 'over') { const next = new Match(hand); next.start(); setMatch(next); setPaused(true); captureMouse(); } else { match.start(); setPaused(true); captureMouse(); update(); } }}>{paused ? 'Back to the table' : match.phase === 'over' ? 'Play again' : 'Start game'}</button></article></div>}
 </main>;
}
