import {useEffect,useRef,useState} from 'react';
import {BodySample,Landmark,readBody} from './poseTracking';
import {cameraHand,CameraHand} from './paddleTracking';
import {readTossHand,TossGesture} from './freeHand';
import {calibrateLateral,estimateCalibration,stance,WebcamBodyMapper} from './webcamBody';
export interface BodyControl {active:boolean;safe:boolean;x:number;moveBody?:boolean;paddleHand?:CameraHand;hand?:{x:number;y:number;at:number};tossSequence?:number;tossVelocity?:number}
interface CalibrationRun {start:number;stage:number;samples:{at:number;body:BodySample}[];stances:number[]}
interface ReplayRow {t:number;stage:string;landmarks:Landmark[]}
interface Replay {rows:ReplayRow[];start:number;index:number}
const prompts=['Stand on CENTER. Hold still.','Step to your RIGHT marker. Hold still.','Step to your LEFT marker, left of center. Hold still.','Return to CENTER. Hold still.'];
export default function useWebcamBody(){
 const paddleHand=useRef<CameraHand>(),lastUi=useRef(0);
 const automatic=useRef(false);
 const [quickMode,setQuickMode]=useState(true);const quick=useRef(true);quick.current=quickMode;
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),mapper=useRef(new WebcamBodyMapper()),control=useRef<BodyControl>({active:false,safe:false,x:0});
 const [mode,setMode]=useState<'off'|'camera'|'replay'>('off'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('Camera off. Enable webcam to begin.'),[backend,setBackend]=useState(''),[stepCm,setStepCm]=useState(40),[calibrating,setCalibrating]=useState(false),[calibrated,setCalibrated]=useState(false),[safe,setSafe]=useState(false),[confidence,setConfidence]=useState(0),[x,setX]=useState(0),[latency,setLatency]=useState(0);
 const handEvidence=useRef<{hands:Landmark[][];world?:Landmark[][];at:number}>({hands:[],at:-Infinity});
 const handPoints=useRef<Landmark[]>([]),handPointsAt=useRef(0),gesture=useRef(new TossGesture()),handedness=useRef<'left'|'right'>('left'),tossEnabled=useRef(false),handSample=useRef<{x:number;y:number;at:number}>(),tossSequence=useRef(0);
 const [handStatus,setHandStatus]=useState('Hand detection starts with webcam'),[calibrationCue,setCalibrationCue]=useState(0);
 const gripUntil=useRef(0);
 const armed=useRef(false),visibleSince=useRef(0);
 const worker=useRef<Worker|null>(null),stream=useRef<MediaStream|null>(null),frame=useRef(0),pending=useRef(false),generation=useRef(0),sampleTime=useRef(-1),lastSend=useRef(0),run=useRef<CalibrationRun|null>(null),replay=useRef<Replay|null>(null),recent=useRef<{at:number;body:BodySample}[]>([]),modeRef=useRef(mode),cm=useRef(stepCm),onHands=useRef<(hands:Landmark[][],points:Landmark[],at:number,world?:Landmark[][])=>void>(()=>{}),onResult=useRef<(points:Landmark[],at:number,ms:number)=>void>(()=>{});
 cm.current=stepCm;
 const speak=(text:string)=>{if('speechSynthesis'in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(text));}};
 const stop=()=>{paddleHand.current=undefined;handEvidence.current={hands:[],at:-Infinity};gesture.current.reset();handSample.current=undefined;armed.current=false;gripUntil.current=0;visibleSince.current=0;if('speechSynthesis'in window)speechSynthesis.cancel();generation.current++;cancelAnimationFrame(frame.current);worker.current?.terminate();worker.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;pending.current=false;run.current=null;replay.current=null;modeRef.current='off';control.current={active:false,safe:false,x:mapper.current.x};setMode('off');setSafe(false);setBusy(false);setCalibrating(false);setStatus('Body tracking stopped. Enable the camera to continue.');};
 onHands.current=(hands,_points,at,world)=>{handEvidence.current={hands,world,at};};
 const updateToss=(points:Landmark[],at:number)=>{
  const evidence=handEvidence.current,hands=at-evidence.at<250?evidence.hands:[],world=at-evidence.at<250?evidence.world:undefined;
  const now=performance.now();if(now-at>250){gesture.current.reset();return;}const shoulders=points[11]&&points[12]&&(points[11].visibility??0)>.65&&(points[12].visibility??0)>.65;const span=shoulders?Math.abs(points[11].x-points[12].x):0;const body=readBody(points)||((quick.current||automatic.current)&&shoulders&&span>.035?{hipX:(points[11].x+points[12].x)/2,hipY:(points[11].y+points[12].y)/2+.18,shoulderWidth:span,lean:0,confidence:Math.min(points[11].visibility??0,points[12].visibility??0)}:null);
if(hands){const sample=readTossHand(hands,points,handedness.current,world);handPoints.current=sample?.points||[];handPointsAt.current=now;const aspect=video.current?.videoWidth?video.current.videoHeight/video.current.videoWidth:9/16;const free=cameraHand(points,handedness.current==='left'?'right':'left',now,aspect);if(free&&body)handSample.current={x:(quick.current?0:mapper.current.x)+free.x,y:free.y,at:now};else handSample.current=undefined;
   const released=gesture.current.update(sample,at,tossEnabled.current&&!run.current&&!armed.current&&(quick.current||mapper.current.safe(now)));if(released)tossSequence.current++;
   setHandStatus(released?'Toss released':!sample?'Show your free wrist and shoulders':sample.probablyOpen===false?'Relax your hand, then lift to toss':sample.source==='wrist'?'Wrist ready · lift to toss':'Hand ready · lift to toss');
  }
  control.current={...control.current,hand:handSample.current,tossSequence:tossSequence.current,tossVelocity:gesture.current.launchSpeed};
 };
 onResult.current=(points,at,ms)=>{
  const now=performance.now(),body=mapper.current.update(points,now,at,automatic.current);if(now-lastUi.current>=200){lastUi.current=now;setLatency(ms);setConfidence(body?.confidence||0);setX(mapper.current.x);}updateToss(points,at);paddleHand.current=cameraHand(points,handedness.current,now,video.current?.videoWidth?video.current.videoHeight/video.current.videoWidth:9/16);
  if(body){recent.current.push({at:now,body});recent.current=recent.current.filter(s=>now-s.at<1600);}else if(now-mapper.current.lastGood>500)recent.current=[];
  if(automatic.current&&!mapper.current.calibration&&recent.current.length>=8){
   mapper.current.calibration=estimateCalibration(recent.current.map(s=>s.body));mapper.current.x=0;setCalibrated(true);setStatus('Camera aligned. Ready to play.');
  }
  if(armed.current){
   if(body){if(!visibleSince.current)visibleSince.current=now;}else visibleSince.current=0;
   setStatus(gripUntil.current?`Stay at CENTER. Follow the phone grip cue: hold paddle still, move hand briefly RIGHT, stop. ${Math.max(0,Math.ceil((gripUntil.current-now)/1000))}s`:'Calibration queued. Step back until hips and shoulders are visible; hold center for 3 seconds.');
   if(!gripUntil.current&&visibleSince.current&&now-visibleSince.current>=3000){gripUntil.current=now+10000;setCalibrationCue(v=>v+1);speak('Stay at center. Calibrate your phone grip now. Hold still, then follow the phone cue.');}
   if(gripUntil.current&&now>=gripUntil.current&&visibleSince.current&&now-visibleSince.current>=3000){armed.current=false;run.current={start:now,stage:0,samples:[],stances:[]};setError('');speak(prompts[0]);}
  }
  const calibration=run.current;
  if(calibration){
   const index=Math.min(3,Math.floor((now-calibration.start)/5000));
   if(index!==calibration.stage){
    try{calibration.stances.push(stance(calibration.samples.filter(s=>now-s.at<1800).map(s=>s.body)));}catch(e){run.current=null;setCalibrating(false);setError((e as Error).message);return;}
    calibration.stage=index;calibration.samples=[];speak(prompts[index]);
   }
   if(body)calibration.samples.push({at:now,body});
   setStatus(`${prompts[index]} ${Math.max(0,Math.ceil((calibration.start+(index+1)*5000-now)/1000))}s`);
   if(now-calibration.start>=20000){
    try{const center=stance(calibration.samples.filter(s=>now-s.at<1600).map(s=>s.body));mapper.current.calibration=calibrateLateral(center,calibration.stances[1],calibration.stances[2],cm.current);mapper.current.x=0;setCalibrated(true);setError('');setStatus('Body calibrated. Stay at center, check phone grip status, then tap Start on your phone.');speak('Body calibration complete. Check your phone, then tap Start.');}catch(e){setError((e as Error).message);}
    run.current=null;setCalibrating(false);
   }
  }
  const usable=mapper.current.safe(now)&&!run.current&&!armed.current;control.current={active:modeRef.current!=='off',safe:usable,x:mapper.current.x,moveBody:!quick.current,paddleHand:paddleHand.current,hand:handSample.current,tossSequence:tossSequence.current,tossVelocity:gesture.current.launchSpeed};setSafe(usable);
  const context=canvas.current?.getContext('2d');if(context&&canvas.current){const w=canvas.current.width,h=canvas.current.height;context.clearRect(0,0,w,h);context.strokeStyle=body?'#d8f47c':'#ffb17b';context.lineWidth=3;for(const [a,b]of [[11,12],[11,23],[12,24],[23,24]]){const p=points[a],q=points[b];if(!p||!q)continue;context.beginPath();context.moveTo(p.x*w,p.y*h);context.lineTo(q.x*w,q.y*h);context.stroke();}if(now-handPointsAt.current<250){context.strokeStyle='#f6da72';for(const finger of [[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]]){context.beginPath();finger.forEach((i,n)=>{const p=handPoints.current[i];if(p){if(n)context.lineTo(p.x*w,p.y*h);else context.moveTo(p.x*w,p.y*h);}});context.stroke();}}}
 };
 const start=async()=>{
  stop();const attempt=++generation.current;setBusy(true);setError('');mapper.current=new WebcamBodyMapper();recent.current=[];setCalibrated(false);setStatus('Loading local pose model…');
  try{
   const w=new Worker(new URL('./pose.worker.ts',import.meta.url),{type:'module'});worker.current=w;
   const modelReady=new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Pose model timed out. Retry in Chrome.')),45000);w.onerror=e=>{clearTimeout(timeout);reject(Error(e.message||'Camera worker failed'));};w.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timeout);setBackend(data.delegate);setHandStatus(data.handAvailable?'Show free hand to camera':'Wrist tracking ready · finger model loading');resolve();}else if(data.type==='error'){clearTimeout(timeout);reject(Error(data.error));}};w.postMessage({type:'init',hands:true,delegate:'GPU',base:new URL(import.meta.env.BASE_URL+'pose-runtime/',location.origin).href});});
   const cameraPromise=navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:false}).then(camera=>{if(attempt!==generation.current){camera.getTracks().forEach(t=>t.stop());throw Error('Camera startup cancelled');}stream.current=camera;return camera;});
   const [,camera]=await Promise.all([modelReady,cameraPromise]);if(attempt!==generation.current){camera.getTracks().forEach(t=>t.stop());return;}

   stream.current=camera;video.current!.srcObject=camera;await video.current!.play();if(attempt!==generation.current)return;
   if(canvas.current){canvas.current.width=640;canvas.current.height=Math.round(640*video.current!.videoHeight/video.current!.videoWidth);}
   modeRef.current='camera';setMode('camera');control.current.active=true;setStatus(quick.current?'Camera ready. Show shoulders and free hand, then Start / reset toss test.':'Camera ready. Show hips and shoulders, then calibrate body.');
   w.onmessage=({data})=>{if(attempt!==generation.current)return;if(data.type==='result'){pending.current=false;onResult.current(data.landmarks,data.captureAt,performance.now()-data.captureAt);}else if(data.type==='hand-result')onHands.current(data.handLandmarks,data.landmarks,data.captureAt,data.worldHandLandmarks);else if(data.type==='hand-error')setHandStatus('Finger tracking stopped · phone Toss remains available');else if(data.type==='error'){stop();setError(data.error);}};
   w.onerror=e=>{if(attempt===generation.current){stop();setError(e.message||'Camera worker failed');}};
   const loop=async(now:number)=>{if(attempt!==generation.current)return;frame.current=requestAnimationFrame(loop);const source=video.current;if(!source||source.readyState<2||pending.current||now-lastSend.current<33||source.currentTime===sampleTime.current)return;pending.current=true;lastSend.current=now;sampleTime.current=source.currentTime;
    try{const bitmap=await createImageBitmap(source,{resizeWidth:960,resizeHeight:Math.round(960*source.videoHeight/source.videoWidth)});if(attempt!==generation.current){bitmap.close();return;}w.postMessage({type:'frame',playingHand:handedness.current,bitmap,captureAt:now,timestamp:now},[bitmap]);}catch(e){pending.current=false;stop();setError((e as Error).message);}
   };frame.current=requestAnimationFrame(loop);
  }catch(e){if(attempt===generation.current){stop();setError((e as Error).message);}}finally{if(attempt===generation.current)setBusy(false);}
 };
 const autoAlign=()=>{automatic.current=true;quick.current=false;setQuickMode(false);mapper.current.calibration=null;recent.current=[];setStatus('Finding your shoulders and centering the table…');};
 const calibrate=()=>{automatic.current=false;setQuickMode(false);quick.current=false;if(modeRef.current!=='camera')return;armed.current=true;gripUntil.current=0;visibleSince.current=0;run.current=null;control.current.safe=false;mapper.current.calibration=null;setCalibrated(false);setSafe(false);setCalibrating(true);setError('');setStatus('Calibration queued. Step back to center with hips and shoulders visible.');speak('Step back to your center marker. Calibration begins once you are visible and hold center for three seconds.');};
 const checkModels=async()=>{
  stop();const attempt=++generation.current;setBusy(true);setError('');setStatus('Checking body + hand models without camera…');
  const w=new Worker(new URL('./pose.worker.ts',import.meta.url),{type:'module'});worker.current=w;const checkStarted=performance.now();
  try{await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Model check timed out')),45000);let handAvailable=false,bodyChecked=false,handsChecked=false,checkMs=0;const finish=()=>{if(bodyChecked&&handsChecked){clearTimeout(timeout);setStatus(`Models ready in ${((performance.now()-checkStarted)/1000).toFixed(2)}s · blank-frame body processing ${checkMs.toFixed(0)} ms. Camera permissions and human tracking are separate.`);resolve();}};w.onerror=e=>{clearTimeout(timeout);reject(Error(e.message));};w.onmessage=async({data})=>{if(attempt!==generation.current){clearTimeout(timeout);resolve();return;}if(data.type==='error'){clearTimeout(timeout);reject(Error(data.error));}else if(data.type==='ready'){handAvailable=data.handAvailable;setBackend(data.delegate);setHandStatus(handAvailable?'Hand model ready':'Hand model failed: '+data.handError);const blank=document.createElement('canvas');blank.width=640;blank.height=480;const context=blank.getContext('2d')!;context.fillStyle='#102a34';context.fillRect(0,0,640,480);const bitmap=await createImageBitmap(blank),now=performance.now();w.postMessage({type:'frame',bitmap,timestamp:now,captureAt:now},[bitmap]);}else if(data.type==='result'){bodyChecked=true;checkMs=data.processingMs;if(!handAvailable){clearTimeout(timeout);reject(Error('Hand model unavailable'));return;}finish();}else if(data.type==='hand-result'){handsChecked=true;finish();}else if(data.type==='hand-error'){clearTimeout(timeout);reject(Error(data.error));}};w.postMessage({type:'init',hands:true,waitHands:true,delegate:'GPU',base:new URL(import.meta.env.BASE_URL+'pose-runtime/',location.origin).href});});}catch(e){if(attempt===generation.current)setError((e as Error).message);}finally{w.terminate();if(attempt===generation.current){worker.current=null;setBusy(false);}}
 };
 const loadReplay=async()=>{
  stop();const attempt=++generation.current;setBusy(true);setError('');
  try{const response=await fetch(`${import.meta.env.BASE_URL}__pose-trial/latest`);if(!response.ok)throw Error('No saved trial found. Enable the webcam instead.');const data=await response.json();if(attempt!==generation.current)return;
   const rows:ReplayRow[]=data.rows;if(!Array.isArray(rows)||!rows.length)throw Error('Saved trial has no frames');
   const position=(stage:string)=>{const samples=rows.filter(r=>r.stage===stage);const end=samples[samples.length-1]?.t||0;return stance(samples.filter(r=>r.t>end-1.5).map(r=>readBody(r.landmarks)).filter((b):b is BodySample=>!!b));};
   const m=new WebcamBodyMapper();m.calibration=calibrateLateral(position('neutral-end'),position('right'),position('left'),data.stepCm);mapper.current=m;setCalibrated(true);setBackend('Recorded landmarks');modeRef.current='replay';setMode('replay');control.current.active=true;setStatus('Replaying your saved trial. Recorded body landmarks; phone or mouse paddle stays live.');replay.current={rows,start:performance.now(),index:-1};
   const loop=(now:number)=>{if(attempt!==generation.current||!replay.current)return;const r=replay.current,elapsed=(now-r.start)/1000;while(r.index+1<rows.length&&rows[r.index+1].t<=elapsed)r.index++;if(r.index>=0&&r.index!==lastIndex){lastIndex=r.index;onResult.current(rows[r.index].landmarks,now,0);}if(elapsed>rows[rows.length-1].t+.5){stop();setStatus('Replay finished. Enable webcam for live play.');return;}frame.current=requestAnimationFrame(loop);};let lastIndex=-1;frame.current=requestAnimationFrame(loop);
  }catch(e){if(attempt===generation.current)setError((e as Error).message);}finally{if(attempt===generation.current)setBusy(false);}
 };
 useEffect(()=>{
  const refs={generation,worker,stream,frame};
  const timer=setInterval(()=>{const usable=modeRef.current!=='off'&&!run.current&&!armed.current&&mapper.current.safe(performance.now());control.current={active:modeRef.current!=='off',safe:usable,x:mapper.current.x,moveBody:!quick.current,paddleHand:paddleHand.current,hand:handSample.current,tossSequence:tossSequence.current,tossVelocity:gesture.current.launchSpeed};setSafe(usable);if(run.current&&performance.now()-mapper.current.lastResult>1500){run.current=null;setCalibrating(false);setError('Camera stopped delivering frames. Retry calibration.');}},100);
  const hidden=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hidden);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);refs.generation.current++;cancelAnimationFrame(refs.frame.current);refs.worker.current?.terminate();refs.stream.current?.getTracks().forEach(t=>t.stop());};
 // Own the latest device/worker resources without restarting capture on UI changes.
 },[]);
 return {autoAlign,quickMode,setQuickMode,checkModels,handedness,tossEnabled,handStatus,calibrationCue,video,canvas,control,mode,busy,error,status,backend,stepCm,setStepCm,calibrating,calibrated,safe,confidence,x,latency,start,stop,calibrate,loadReplay};
}
export type WebcamBodyController=ReturnType<typeof useWebcamBody>;
