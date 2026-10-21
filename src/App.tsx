import Ball from './Ball';
import FullscreenButton from './FullscreenButton';
import TouchControls from './TouchControls';
import { usesTouchControls } from './touchDevice';
import EquipmentPanel from './EquipmentPanel';
import {Equipment,PADDLE_COLORS,useEquipment} from './equipment';
import ReleaseBadge from './ReleaseBadge';
import {PaddleAnchor,bladeCenter} from './paddleTracking';
import {WebcamPanel} from './WebcamPanel';
import type {WebcamBodyController,BodyControl} from './useWebcamBody';
import usePhoneController, { PhonePose } from './usePhoneController';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, PerspectiveCamera } from '@react-three/drei';
import { Box3, Euler, Group, Mesh, Quaternion, Vector3, MeshStandardMaterial } from 'three';
import useDiagnostics from './useDiagnostics';
import { Match, PlayerInput, followSwing } from './engine';

function Model({ url, size, position,equipment }: { equipment?:Equipment; url: string; size: [number, number, number]; position: [number, number, number] }) {
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
 const paddleColor=equipment?.color;
 useEffect(()=>{
  if(!paddleColor)return;const materials:{mesh:Mesh;original:MeshStandardMaterial;copy:MeshStandardMaterial}[]=[];
  object.traverse(child=>{if(!(child instanceof Mesh))return;const original=child.material as MeshStandardMaterial;if(!['Goma_roja','Goma_negra'].includes(original.name))return;const material=original.clone();material.map=null;material.color.set(original.name==='Goma_negra'?'#16191b':PADDLE_COLORS[paddleColor]);material.roughness=1;material.metalness=0;material.needsUpdate=true;child.material=material;materials.push({mesh:child,original,copy:material});});
  return()=>{materials.forEach(({mesh,original,copy})=>{mesh.material=original;copy.dispose();});};
 },[object,paddleColor]);
 return <primitive object={object} position={position} />;
}

export function Court({ match, input, update, cameraStrength, phoneActive, phonePose, phoneSensitivity, lateralFollow, impact, samplePhonePose, beforeStep, timeScale=1, networkFrame, bodyControl,paddlePivot=0,frameCount,paddleEquipment, steadyInput=false }: { steadyInput?:boolean; paddleEquipment?:Equipment; frameCount?:React.MutableRefObject<number>; paddlePivot?:number;bodyControl?:React.MutableRefObject<BodyControl>; networkFrame?:()=>void; beforeStep?:(dt:number)=>void; timeScale?:number; samplePhonePose?: (now:number)=>PhonePose|null; lateralFollow: number; phoneSensitivity: number; phoneActive: boolean; phonePose: React.MutableRefObject<PhonePose | null>; impact: (strength: number,opponent?:boolean) => void; cameraStrength: number; match: Match; input: React.MutableRefObject<PlayerInput>; update: () => void }) {
 const ball = useRef<Mesh>(null);
 const human = useRef<Group>(null);
 const ai = useRef<Group>(null);
 const accumulator = useRef(0);
 const paddleAnchor=useRef(new PaddleAnchor()),lastPaddleGrip=useRef<BodyControl['paddleHand']>();
 const holdingHand=useRef(false),lastAIImpact=useRef({match,count:match.impacts[1]});
 const lastHandToss=useRef(0);
 const previous = useRef('');
 const lastImpact = useRef({match, sequence:match.impactSequence});
 const phoneRotation = useRef(new Quaternion()),targetPhoneRotation=useRef(new Quaternion()),lastFaceTime=useRef(-Infinity);
 const heldHandPosition=useRef({x:0,y:2,z:3.05});
 const sway = useRef({ yaw: 0, pitch: 0, x: 0, y: 0 });
 useFrame((state, delta) => {
  if(frameCount)frameCount.current++;
  if(paddleEquipment)match.sponges[0]=paddleEquipment.sponge;
  const pose = samplePhonePose ? samplePhonePose(performance.now()) : phonePose.current;
  if (phoneActive && pose && performance.now() - pose.received < 1000) {
   input.current.swingOffset = pose.swing ? pose.swing.map((value, axis) => value * phoneSensitivity * (axis === 0 ? lateralFollow : 1)) as [number,number,number] : undefined;
   // Position gain is independent of the 1:1 calibrated face orientation.
   input.current.x = Math.max(-1, Math.min(1, pose.x * phoneSensitivity));
   input.current.y = Math.max(-1, Math.min(1, pose.y * phoneSensitivity));
   if (pose.q) targetPhoneRotation.current.fromArray(pose.q).normalize();
   else targetPhoneRotation.current.setFromEuler(new Euler(pose.pitch, pose.yaw, pose.roll, 'YXZ'));
   if(performance.now()-lastFaceTime.current>1000)phoneRotation.current.copy(targetPhoneRotation.current);
   else{const angle=phoneRotation.current.angleTo(targetPhoneRotation.current);phoneRotation.current.slerp(targetPhoneRotation.current,1-Math.exp(-Math.min(120,24+angle*120)*Math.min(delta,.1)));}
   lastFaceTime.current=performance.now();
   input.current.orientation = phoneRotation.current.toArray() as [number,number,number,number];
  }
  input.current.phone = phoneActive;
  if (!phoneActive || !pose || performance.now() - pose.received >= 1000) input.current.swingOffset = undefined;

  if(bodyControl?.current.active){input.current.bodyX=bodyControl.current.moveBody===false?0:bodyControl.current.x;input.current.moveX=0;input.current.moveZ=0;}else input.current.bodyX=undefined;
  if(phoneActive&&bodyControl){if(bodyControl.current.paddleHand)lastPaddleGrip.current=bodyControl.current.paddleHand;const grip=lastPaddleGrip.current&&performance.now()-lastPaddleGrip.current.at<300?lastPaddleGrip.current:undefined,face=grip?bladeCenter(grip,phoneRotation.current.toArray() as [number,number,number,number],paddlePivot):undefined;input.current.swingOffset=paddleAnchor.current.update(face,input.current.swingOffset,match.handedness,performance.now(),delta);if(face&&input.current.swingOffset)input.current.swingOffset[2]+=face.z;}
  input.current.requireTrackedHand=!!bodyControl;
  const trackedHand=bodyControl?.current.hand;
  if(trackedHand&&performance.now()-trackedHand.at<250){if(!holdingHand.current){heldHandPosition.current.x=trackedHand.x;heldHandPosition.current.y=trackedHand.y;}holdingHand.current=true;const alpha=1-Math.exp(-22*Math.min(delta,.1));heldHandPosition.current.x+=(trackedHand.x-heldHandPosition.current.x)*alpha;heldHandPosition.current.y+=(trackedHand.y-heldHandPosition.current.y)*alpha;input.current.heldHand={...heldHandPosition.current};}else{holdingHand.current=false;input.current.heldHand=undefined;}
  const sequence=bodyControl?.current.tossSequence??0;
  if(sequence!==lastHandToss.current){lastHandToss.current=sequence;if(match.phase==='serve'&&match.server===0&&input.current.heldHand){match.heldHand=input.current.heldHand;match.serve(bodyControl?.current.tossVelocity);}}
  networkFrame?.();
  accumulator.current += Math.min(delta, .1) * timeScale;
  while (accumulator.current >= 1 / 120) {
   beforeStep?.(1 / 120);
   if(!networkFrame)match.step(1 / 120, input.current);
   if (!phoneActive && !steadyInput) { input.current.x *= Math.exp(-.8 / 120); input.current.y *= Math.exp(-2.4 / 120); }
   accumulator.current -= 1 / 120;
  }
  const moving = match.phase === 'serve' || match.phase === 'toss' || match.phase === 'rally';
  followSwing(sway.current, moving ? match.brush.x : 0, moving ? match.brush.y : 0, delta, cameraStrength);
  if (lastImpact.current.match !== match) lastImpact.current = {match,sequence:match.impactSequence};
  else if (lastImpact.current.sequence !== match.impactSequence) { lastImpact.current.sequence = match.impactSequence; impact(match.impactStrength); }
  if(lastAIImpact.current.match!==match)lastAIImpact.current={match,count:match.impacts[1]};else if(lastAIImpact.current.count!==match.impacts[1]){lastAIImpact.current.count=match.impacts[1];if(!networkFrame)impact(.35,true);}
  state.camera.position.set(match.body.x + sway.current.x, 2.75 + sway.current.y, match.body.z + .8);
  state.camera.rotation.set(-.30 + sway.current.pitch, sway.current.yaw, 0);
  if (ball.current) {
   ball.current.visible=match.ballVisible;
   ball.current.rotateX(match.ball.wx * delta);
   ball.current.rotateY(match.ball.wy * delta);
   ball.current.rotateZ(match.ball.wz * delta);
  }
  ball.current?.position.set(match.ball.x, match.ball.y, match.ball.z);
  human.current?.position.set(match.paddles[0].x, match.paddles[0].y, match.paddles[0].z);
  ai.current?.position.set(match.paddles[1].x, match.paddles[1].y, match.paddles[1].z);
  if(networkFrame){human.current?.quaternion.fromArray(match.paddleRotation);ai.current?.quaternion.fromArray(match.far.rotation);}
  if (!networkFrame && human.current && phoneActive) human.current.quaternion.copy(phoneRotation.current);
  else if (!networkFrame && human.current) {
   const desired = match.backhand ? Math.PI : 0;
   human.current.rotation.y = desired;
   human.current.rotation.z = (match.handedness === 'right' ? -.14 : .14) - input.current.x * .16;
  }
  const key = `${match.phase}:${match.score}:${match.message}:${match.backhand}`;
  if (key !== previous.current) { previous.current = key; update(); }
 });
 return <>
  <PerspectiveCamera makeDefault position={[0, 2.75, 4.85]} rotation={[-.30, 0, 0]} fov={70} />
  <ambientLight intensity={1.4} /><directionalLight position={[3, 8, 4]} intensity={2} />
  <Model url="./models/table_tennis_table.glb" size={[3.05, 1.85, 5.48]} position={[0, .855, 0]} />
  <Ball ref={ball} visible={!bodyControl}/>
  <group ref={human} name="player-paddle"><Model equipment={paddleEquipment} url="./models/ping_pong_paddle.glb" size={[.75, 1, .12]} position={[0, -.18, 0]} /></group>
  <group ref={ai} name="opponent-paddle"><Model url="./models/ping_pong_paddle.glb" size={[.75, 1, .12]} position={[0, -.18, 0]} /></group>
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.05, 0]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#102a34" /></mesh>
 </>;
}

export default function App({webcam,mouseOnly=false}:{webcam?:WebcamBodyController;mouseOnly?:boolean}={}) {
 const [touchMode] = useState(() => !webcam && usesTouchControls());
 const [dev,setDev]=useState(false),[equipmentOpen,setEquipmentOpen]=useState(false);
 const [equipment,setEquipment]=useEquipment();
 const frameCount=useRef(0),lastRenderCount=useRef(0);
 useEffect(()=>{lastRenderCount.current=frameCount.current;},[dev]);
 const diagnostics=useDiagnostics(dev,()=>{const renderFps=frameCount.current-lastRenderCount.current;lastRenderCount.current=frameCount.current;return {renderFps,mode:touchMode?'touch':'mouse + keyboard'};});
 const surface = useRef<HTMLElement>(null);
 const [lateralFollow, setLateralFollow] = useState(1.5);
 const [phoneSensitivity, setPhoneSensitivity] = useState(2);
 const [phoneActive, setPhoneActive] = useState(false);
 const [showPairing, setShowPairing] = useState(false);
 const [cameraStrength, setCameraStrength] = useState(.65);
 const webcamControl=webcam?.control, bodySafe=webcam?.safe??true;
 const quickTest=useRef(webcam?.quickMode??false);quickTest.current=webcam?.quickMode??false;
 const bodyRequired=useRef(true);
 const [useBody,setUseBody]=useState(true);
 const [freeMouse, setFreeMouse] = useState(false);
 const [mouseLocked, setMouseLocked] = useState(false);
 const [mouseError, setMouseError] = useState('');
 const [fullscreenError, setFullscreenError] = useState('');
 const [hand, setHand] = useState<'left' | 'right'>('left');
 const [match, setMatch] = useState(() => new Match('left'));
 const activeMatch = useRef(match);
 activeMatch.current = match;
 const [, render] = useState(0);
 const [paused, setPaused] = useState(!!webcam);
 const input = useRef<PlayerInput>({ x: 0, y: 0, moveX: 0, moveZ: 0 });
 const update = () => render(n => n + 1);
 const gripReady=useRef(true);
 const canPlay = () => {if(quickTest.current)return true;if(bodyRequired.current&&!gripReady.current){setMouseError('Finish the phone grip cue during guided calibration, then tap Start on your phone.');setPaused(true);return false;}if(!quickTest.current&&bodyRequired.current&&webcamControl&&!webcamControl.current.safe){setMouseError('Enable and calibrate body tracking, then stay in view before resuming.');setPaused(true);return false;}return true;};
 const resumePhone = () => {
  setPhoneActive(true); setShowPairing(false);
  if(!canPlay())return;
  setMouseError('');
  if (activeMatch.current.phase === 'over') { const next = new Match(hand); next.start(); activeMatch.current = next; setMatch(next); }
  else if (activeMatch.current.phase === 'ready') activeMatch.current.start();
  setPaused(false); update();
 };
 const phone = usePhoneController(command => {
  if(command==='grip-ready'){gripReady.current=true;setMouseError('');return;}
  if(command==='grip-failed'){gripReady.current=false;setMouseError('Phone grip calibration failed. Tap Calibrate natural grip on your phone and retry.');return;}
  if(command==='start'){if(quickTest.current)startTossTest();else resumePhone();return;}
  if (!phoneActive && !['pause', 'toss'].includes(command)) return;
  if (!phoneActive && ['pause', 'toss'].includes(command)) { resumePhone(); return; }
  if (command === 'toss') { if(!canPlay())return; if (activeMatch.current.phase === 'ready') { activeMatch.current.start(); setPaused(false); } else activeMatch.current.serve(); update(); }
  if (command === 'pause') { if (paused || showPairing || activeMatch.current.phase === 'ready') resumePhone(); else setPaused(true); }
  if (command === 'disconnected' || command === 'suspend') setPaused(true);
  if (command === 'recenter') { input.current.swingOffset = undefined; input.current.x = 0; input.current.y = 0; }
 });
 if(webcam){webcam.handedness.current=hand;webcam.tossEnabled.current=!paused&&(useBody||webcam.quickMode)&&match.phase==='serve'&&match.server===0;}
 const calibratePhone=useRef(phone.calibrateGrip);calibratePhone.current=phone.calibrateGrip;
 const setupCue=webcam?.calibrationCue??0;
 useEffect(()=>{if(setupCue&&phone.connected){gripReady.current=false;calibratePhone.current();}},[setupCue,phone.connected]);
 const phoneGameMessage=webcam?.quickMode?(paused||match.phase==='ready'?'Quick test — tap Start. No calibration needed.':'Quick test — lift your free hand to toss.'):useBody&&webcam&&!bodySafe ? webcam.calibrating?'Body calibration in progress. Stay on your markers.':'Body not ready. Stay in view and finish webcam calibration.' : paused||match.phase==='ready'?!gripReady.current?'Finish phone grip calibration before Start.':'Ready — tap Start / resume game.':match.phase==='serve'?match.server===0?'Your serve — tap Toss ball, then swing.':'AI serving.':match.phase==='over'?'Game over — tap Start / resume for a new game.':'Playing — swing to return.';
 const reportPhoneStatus=useRef(phone.reportStatus);reportPhoneStatus.current=phone.reportStatus;
 useEffect(()=>{reportPhoneStatus.current(phoneGameMessage);},[phoneGameMessage,phone.connected]);
 useEffect(() => {
  if (!phoneActive) return;
  const timer = window.setInterval(() => {
   if (!quickTest.current && phone.pose.current && performance.now() - phone.pose.current.received > 1000) setPaused(true);
  }, 250);
  return () => clearInterval(timer);
 }, [phoneActive, phone.pose]);
 const captureMouse = useCallback(() => {
  if(!quickTest.current&&bodyRequired.current&&webcamControl&&!webcamControl.current.safe){setMouseError('Calibrate body tracking and stay in view before resuming.');setPaused(true);return;}
  if (phoneActive || touchMode) { setPaused(false); return; }
  const element = surface.current;
  setMouseError(''); setFreeMouse(false);
  if (!element?.requestPointerLock) { setMouseError('Mouse capture is unavailable here. Open the game in Chrome for unrestricted mouse movement.'); setPaused(true); return; }
  try {
   const pending = element.requestPointerLock() as unknown as Promise<void> | undefined;
   if (pending) void pending.catch(() => { setMouseError('Mouse capture was blocked. Retry, or open this game in Chrome for unrestricted swings.'); setPaused(true); });
  } catch { setMouseError('Mouse capture was blocked. Retry, or open this game in Chrome for unrestricted swings.'); setPaused(true); }
 }, [phoneActive,webcamControl,touchMode]);
 const startTossTest=()=>{
  if(webcam){webcam.setQuickMode(true);quickTest.current=true;}
  gripReady.current=true;setMouseError('');setShowPairing(false);setFreeMouse(true);
  const next=new Match(hand);next.start();activeMatch.current=next;setMatch(next);setPhoneActive(phone.connected);setPaused(false);
 };
 useEffect(()=>{
  if(!webcam?.quickMode||match.phase!=='point')return;
  const timer=setTimeout(()=>{const next=new Match(hand);next.start();activeMatch.current=next;setMatch(next);},900);
  return()=>clearTimeout(timer);
 },[webcam?.quickMode,match.phase,hand]);
 const startGame = () => {
  setDev(false);setEquipmentOpen(false);
  if(quickTest.current){startTossTest();return;}
  if(!canPlay())return;
  if(phone.connected){resumePhone();return;}
  if(activeMatch.current.phase==='over'){const next=new Match(hand);next.start();activeMatch.current=next;setMatch(next);}
  else if(activeMatch.current.phase==='ready')activeMatch.current.start();
  update();captureMouse();
 };
 const pauseGame = () => { setPaused(true); if (document.pointerLockElement) document.exitPointerLock(); };
 useEffect(()=>{if(!quickTest.current&&useBody&&!bodySafe&&match.phase!=='ready'&&match.phase!=='over'){setPaused(true);if(document.pointerLockElement)document.exitPointerLock();}},[useBody,bodySafe,match.phase,webcam?.quickMode]);
 useEffect(() => {
  const change = () => {
   const locked = document.pointerLockElement === surface.current;
   setMouseLocked(locked);
   if (!phoneActive && !touchMode) setPaused(!!(bodyRequired.current&&webcamControl&&!webcamControl.current.safe) || !locked && activeMatch.current.phase !== 'over' && activeMatch.current.phase !== 'ready');
   input.current.moveX = 0; input.current.moveZ = 0;
  };
  const error = () => { setMouseError('Mouse capture was blocked. Retry, or open this game in Chrome for unrestricted swings.'); setPaused(true); };
  document.addEventListener('pointerlockchange', change);
  document.addEventListener('pointerlockerror', error);
  return () => { document.removeEventListener('pointerlockchange', change); document.removeEventListener('pointerlockerror', error); };
 }, [phoneActive,webcamControl,touchMode]);
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
   const typing=event.target instanceof HTMLElement&&['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName);
   if(!typing&&['Escape','KeyP'].includes(event.code)&&!event.repeat){setPaused(true);if(document.pointerLockElement)document.exitPointerLock();return;}
   if(event.target instanceof HTMLElement && ['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;
   if (['KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(event.code)) {
    event.preventDefault(); if (!paused) held.add(event.code); movement();
   }
   if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat && !paused) { if (match.phase === 'ready') { match.start(); setPaused(true); captureMouse(); } else match.serve(); update(); }
   }
  };
  const keyup = (event: KeyboardEvent) => { held.delete(event.code); movement(); };
  const blur = () => { held.clear(); movement(); setPaused(true); };
  const mouse = (event: MouseEvent) => {
   if (touchMode || phoneActive || (!freeMouse && document.pointerLockElement !== surface.current) || paused || match.phase === 'ready' || match.phase === 'over') return;
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
 }, [match, paused, freeMouse, phoneActive, captureMouse, touchMode]);
 return <main ref={surface} className={webcam?'webcam-game':touchMode?'touch-game':undefined}>
  {webcam&&<WebcamPanel webcam={webcam} pause={pauseGame} startTest={startTossTest}/>}
  {showPairing && <div className="overlay pairing"><article><small>PHONE CONTROLLER</small><h1>{phone.connected ? 'Your phone is connected.' : 'Pair your paddle.'}</h1><p>{phone.status}</p>{mouseError&&<p role="alert">{mouseError}</p>}<button onClick={phone.pair}>{phone.pairing ? 'Create new pairing' : 'Create pairing'}</button>{phone.pairing && <><img width="180" height="180" src={phone.pairing.qr} alt="Phone controller pairing QR code" />{phone.pairing.certificateUrl?<p>Local Wi-Fi pairing. Android users can install the local CA from <a href={phone.pairing.certificateUrl}>{phone.pairing.certificateUrl}</a> under Settings → Security → Install certificate → CA certificate. This trusts only this prototype’s locally generated CA; remove it when finished. For iPhone, use the public HTTPS game for the simplest setup; local certificates require installation and explicit full trust in iOS Settings.</p>:<p>Scan the QR on iPhone or Android, tap Connect, and calibrate. iPhone will ask for Motion & Orientation permission. No local certificate or shared Wi-Fi is needed. The phone shows round-trip latency through this game.</p>}<p>Then scan the QR or open <a href={phone.pairing.phoneUrl}>{phone.pairing.phoneUrl}</a>, tap Connect, and calibrate.</p></>}<button disabled={!phone.connected} onClick={() => { input.current.x=0; input.current.y=0; resumePhone(); }}>{match.phase === 'ready' ? 'Start with phone' : 'Continue with phone'}</button><button onClick={() => { setPhoneActive(false); setShowPairing(false); }}>Use mouse</button></article></div>}

  <header className="game-navigation"><div className="brand">TABLE / TENNIS<ReleaseBadge/><small>{webcam?'Webcam body · local singles':'First-person singles'}</small></div><div className="score"><span className={match.server === 0 ? 'server' : ''}>YOU <b>{match.score[0]}</b></span><i>:</i><span className={match.server === 1 ? 'server' : ''}><b>{match.score[1]}</b> AI</span></div><div className="view-controls"><FullscreenButton target={surface}/><button onClick={()=>{location.href=import.meta.env.BASE_URL;}}>Modes</button><button onClick={()=>{pauseGame();setEquipmentOpen(v=>!v);setDev(false);}}>Paddle setup</button><button onClick={()=>{pauseGame();setDev(v=>!v);setEquipmentOpen(false);}}>Developer tools</button>{!mouseOnly&&<button onClick={() => { pauseGame(); setShowPairing(true); }}>{phone.connected ? 'Edit phone pairing' : phone.pairing ? 'Reconnect phone' : 'Pair phone'}</button>}<button onClick={() => { if (paused || match.phase==='ready') startGame(); else pauseGame(); }}>{match.phase==='ready'?'Start game':paused ? 'Resume' : 'Pause'}</button></div></header>
  {equipmentOpen&&<EquipmentPanel equipment={equipment} change={setEquipment} restart={()=>{const next=new Match(hand);activeMatch.current=next;setMatch(next);setPaused(true);}} close={()=>setEquipmentOpen(false)} locked={match.phase!=='ready'&&match.phase!=='over'}/>}
  {dev&&<aside className="mouse-dev"><h2>Developer tools</h2>{Object.entries(diagnostics).map(([key,value])=><p key={key}>{key}: {value}</p>)}<a href="?multiplayer">Multiplayer prototype</a></aside>}
  <Canvas frameloop={paused ? 'never' : 'always'}><color attach="background" args={['#102a34']} /><Suspense fallback={null}><Court steadyInput={touchMode} paddleEquipment={equipment} frameCount={frameCount} bodyControl={useBody||webcam?.quickMode?webcam?.control:undefined} match={match} input={input} update={update} cameraStrength={cameraStrength} phoneActive={phoneActive} phonePose={phone.pose} samplePhonePose={phone.samplePose} phoneSensitivity={phoneSensitivity} lateralFollow={lateralFollow} impact={phone.impact} /></Suspense></Canvas>
  {touchMode && !paused && !showPairing && match.phase!=='ready' && match.phase!=='over' && <TouchControls input={input} hand={hand} serve={()=>{match.serve();update();}}/>}
  <section className="status"><span>{webcam?.quickMode?'TOSS PRACTICE · RESETS AUTOMATICALLY':match.score[0] >= 10 && match.score[1] >= 10 ? 'DEUCE · WIN BY TWO' : 'FIRST TO 11 · WIN BY TWO'}</span><h2>{webcam?.quickMode&&match.phase==='ready'?'Ready to test hand release':phoneActive ? match.message.replace('Space to toss', 'Tap Toss on your phone') : touchMode ? match.message.replace('Space to toss', 'Tap to toss') : match.message}</h2>{fullscreenError && <p role="status">{fullscreenError}</p>}{mouseError && <p role="status">{mouseError}</p>}<p>{webcam ? `Webcam body · ${webcam.quickMode?'Quick toss test · no calibration':!useBody?'Movement disabled':webcam.safe?'Tracking':'Paused / needs calibration'} · ${phoneActive?'Phone paddle':'Mouse paddle'} · Space / phone Toss` : phoneActive ? `Phone paddle · ${phone.connected ? 'Connected' : 'Disconnected'} · Swing your phone · Toss and pause on your phone` : touchMode ? 'Movement wheel to move · Drag to swing · Tap to toss' : `A/D to move · W/S to step · Move mouse to swing · Space to toss · ${mouseLocked ? 'Mouse captured' : 'Mouse free'}`} · {touchMode?'Pause with the menu':'F fullscreen · Esc / P to pause'} · {match.backhand ? 'Backhand' : 'Forehand'}</p></section>
  {!showPairing && (match.phase === 'ready' || match.phase === 'over' || paused) && <div className="overlay"><article><small>TABLE / TENNIS</small><h1>{match.phase==='ready' ? 'Ready to play.' : match.phase === 'over' ? match.winner === 0 ? 'You win!' : 'AI wins.' : paused ? 'Game paused.' : 'Find your rhythm.'}</h1><p>{match.phase === 'over' ? `${match.score[0]} – ${match.score[1]}` : webcam?.quickMode ? 'Quick toss test: enable webcam, then start. No side steps, phone calibration, or phone pairing required. Show your shoulders and free hand, lift your free hand naturally to toss. No precise palm pose or waiting required.' : webcam ? 'Calibrate the camera using the floor markers. Step left or right to move your body. Use your phone or mouse to swing the paddle; toss to serve. Resume after calibration.' : phoneActive ? 'Swing your phone to move the paddle. Use Toss / start on your phone to serve, and Pause / resume to take a break or return to play. Keep the controller open on your phone.' : touchMode ? 'Use the movement wheel to step left, right, forward and back. Drag anywhere else to swing your paddle. Tap to toss the ball, then drag to hit it. The wheel sits opposite your playing hand. Contact returns automatically.' : 'Move your body with A/D and take short steps with W/S. Sweep the mouse to swing your paddle. Space tosses the ball; swing as it drops to serve. Cross your body for a backhand. Brush up for topspin, down for backspin, or sideways for sidespin. Contact returns automatically. Starting captures and hides the mouse; Escape releases it.'}</p>{mouseError && <><p role="status">{mouseError}</p>{mouseError.startsWith('Mouse capture')&&<button onClick={() => { if(canPlay()){setMouseError('');setFreeMouse(true); setPaused(false);} }}>Continue with limited mouse</button>}</>}{!mouseOnly&&<><button onClick={() => { location.href='?multiplayer'; }}>Play multiplayer</button><button onClick={() => { pauseGame(); setShowPairing(true); }}>{phone.connected ? 'Edit phone pairing' : phone.pairing ? 'Reconnect phone' : 'Pair iPhone / Android'}</button></>}{dev&&!webcam?.quickMode&&<><label className="camera-setting">Lateral follow <input aria-label="Lateral follow" type="range" min="1" max="10" step="0.5" value={lateralFollow} onChange={event => setLateralFollow(Number(event.target.value))} />{lateralFollow.toFixed(1)}×</label><label className="camera-setting">Phone reach <input aria-label="Phone reach sensitivity" type="range" min="0.5" max="3" step="0.1" value={phoneSensitivity} onChange={event => setPhoneSensitivity(Number(event.target.value))} />{phoneSensitivity.toFixed(1)}×</label><label className="camera-setting">Camera follow <input aria-label="Camera follow" type="range" min="0" max="1" step="0.05" value={cameraStrength} onChange={event => setCameraStrength(Number(event.target.value))} />{cameraStrength === 0 ? 'Off' : 'Subtle'}</label>{webcam&&<div><p role="status">{useBody ? webcam.safe?'Body tracking ready.':'Webcam movement requires calibration and visible hips/shoulders.' : 'Webcam movement off. Paddle controls remain available.'}</p><button onClick={()=>{bodyRequired.current=!useBody;setUseBody(!useBody);if(useBody)startGame();else pauseGame();}}>{useBody?'Play without webcam movement':'Enable webcam movement'}</button></div>}</>}<div className="hand-choice" role="group" aria-label="Playing hand">{(['left', 'right'] as const).map(choice => <button key={choice} aria-pressed={hand === choice} disabled={match.phase === 'toss' || match.phase === 'rally'} onClick={() => { setHand(choice); match.setHand(choice); input.current.x = 0; input.current.y = 0; update(); }}>{choice === 'left' ? 'Left handed' : 'Right handed'}</button>)}</div><button onClick={startGame}>{webcam?.quickMode?'Start toss test':match.phase === 'over' ? 'Play again' : match.phase==='ready' ? 'Start game' : paused ? 'Resume game' : 'Start game'}</button></article></div>}
 </main>;
}
