import {Suspense, useEffect, useRef, useState} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import {Quaternion} from 'three';
import {Court} from './App';
import {Match,PlayerInput} from './engine';
import {PhonePose} from './usePhoneController';
type Row={t:number;q:[number,number,number,number];offset:[number,number,number];stage:string};
type Trial={source:string;hand:'left'|'right';basis:[number,number,number,number];duration:number;rows:Row[]};
function Driver({trial,pose,time,playing,onTime}:{trial:Trial;pose:React.MutableRefObject<PhonePose|null>;time:React.MutableRefObject<number>;playing:boolean;onTime:(t:number,stage:string)=>void}){
 const display=useRef(0);
 useFrame((_,delta)=>{
  if(playing)time.current=Math.min(trial.duration,time.current+Math.min(delta,.1));
  let low=0,high=trial.rows.length-1;
  while(low<high){const mid=Math.ceil((low+high)/2);if(trial.rows[mid].t<=time.current)low=mid;else high=mid-1;}
  const row=trial.rows[low],next=trial.rows[Math.min(low+1,trial.rows.length-1)];
  const alpha=next.t>row.t?Math.max(0,Math.min(1,(time.current-row.t)/(next.t-row.t))):0;
  const basis=new Quaternion().fromArray(trial.basis),q=new Quaternion().fromArray(row.q).slerp(new Quaternion().fromArray(next.q),alpha);
  q.premultiply(basis).multiply(basis.clone().invert());
  pose.current={x:0,y:0,yaw:0,pitch:0,roll:0,q:q.toArray() as Row['q'],swing:row.offset.map((v,i)=>v+(next.offset[i]-v)*alpha) as Row['offset'],received:performance.now()};
  display.current+=delta;if(display.current>.1){onTime(time.current,row.stage);display.current=0;}
 });return null;
}
export default function Replay(){
 const [trial,setTrial]=useState<Trial|null>(null),[error,setError]=useState(''),[playing,setPlaying]=useState(false),[timeLabel,setTimeLabel]=useState(0),[stage,setStage]=useState('still-before'),[lateral,setLateral]=useState(1.5),[download,setDownload]=useState(''),[snapshot,setSnapshot]=useState(''),[recordedGain,setRecordedGain]=useState(1.5),[snapshotGain,setSnapshotGain]=useState(1.5);
 const [match,setMatch]=useState(()=>new Match('left'));
 const time=useRef(0),pose=useRef<PhonePose|null>(null),input=useRef<PlayerInput>({x:0,y:0});
 const surface=useRef<HTMLElement>(null),recorder=useRef<MediaRecorder|null>(null),captureFrame=useRef(0),downloadRef=useRef(''),snapshotRef=useRef('');
 useEffect(()=>{fetch(`${import.meta.env.BASE_URL}replays/latest.json`).then(r=>{if(!r.ok)throw Error('No replay recording found');return r.json();}).then((data:Trial)=>{setTrial(data);const m=new Match(data.hand);m.start();setMatch(m);}).catch(e=>setError(String(e)));return()=>{if(recorder.current?.state==='recording')recorder.current.stop();cancelAnimationFrame(captureFrame.current);if(downloadRef.current)URL.revokeObjectURL(downloadRef.current);if(snapshotRef.current)URL.revokeObjectURL(snapshotRef.current);};},[]);
 const capture=()=>{
  setRecordedGain(lateral);
  const source=surface.current?.querySelector('canvas');if(!source||!trial)return;
  const output=document.createElement('canvas');output.width=1280;output.height=Math.round(1280*source.height/source.width);const ctx=output.getContext('2d');if(!ctx)return;
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime){setError('WebM recording unavailable');return;}
  const stream=output.captureStream(30),chunks:BlobPart[]=[];
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000});recorder.current=rec;
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onstop=()=>{cancelAnimationFrame(captureFrame.current);stream.getTracks().forEach(t=>t.stop());if(downloadRef.current)URL.revokeObjectURL(downloadRef.current);downloadRef.current=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));setDownload(downloadRef.current);};
  const draw=()=>{ctx.drawImage(source,0,0,output.width,output.height);ctx.fillStyle='#071a24dd';ctx.fillRect(0,0,1280,74);ctx.fillStyle='#eef4ea';ctx.font='22px sans-serif';ctx.fillText(`Recorded left-hand motion · ${time.current.toFixed(1)}s · lateral ${lateral}× · reach 2×`,24,30);ctx.font='16px sans-serif';ctx.fillText('Sensor replay, not webcam ground truth · same game paddle/collision pipeline',24,58);if(time.current>=trial.duration){rec.stop();setPlaying(false);}else captureFrame.current=requestAnimationFrame(draw);};
  time.current=0;setPlaying(true);setDownload('');rec.start();draw();
 };
 const captureFrameImage=()=>{
  setSnapshotGain(lateral);
  const source=surface.current?.querySelector('canvas');if(!source)return;
  const image=document.createElement('canvas');image.width=source.width;image.height=source.height;const ctx=image.getContext('2d');if(!ctx)return;
  ctx.drawImage(source,0,0);ctx.fillStyle='#071a24dd';ctx.fillRect(0,0,image.width,70);ctx.fillStyle='#eef4ea';ctx.font='20px sans-serif';ctx.fillText(`Sensor replay · ${time.current.toFixed(1)}s · lateral ${lateral}× · reach 2×`,20,28);ctx.font='15px sans-serif';ctx.fillText('Estimated movement; physical accuracy unverified',20,53);
  image.toBlob(blob=>{if(!blob)return;if(snapshotRef.current)URL.revokeObjectURL(snapshotRef.current);snapshotRef.current=URL.createObjectURL(blob);setSnapshot(snapshotRef.current);},'image/png');
 };
 return <main ref={surface}>
  {trial&&<Canvas gl={{preserveDrawingBuffer:true}}><color attach="background" args={['#102a34']}/><Suspense fallback={null}><Driver trial={trial} pose={pose} time={time} playing={playing} onTime={(t,s)=>{setTimeLabel(t);setStage(s);}}/><Court match={match} input={input} update={()=>{}} cameraStrength={.65} phoneActive phonePose={pose} phoneSensitivity={2} lateralFollow={lateral} impact={()=>{}}/></Suspense></Canvas>}
  <div className="replay-controls"><strong>Recorded motion · {trial?.hand} hand</strong><p>{error||`${timeLabel.toFixed(1)} / ${trial?.duration.toFixed(1)||'…'} s · ${stage}`}</p><button onClick={()=>setPlaying(p=>!p)}>{playing?'Pause replay':'Play replay'}</button><button onClick={()=>{time.current=0;setPlaying(true);}}>Restart</button><button disabled={!trial||recorder.current?.state==='recording'} onClick={capture}>Record replay</button><button onClick={captureFrameImage}>Capture frame</button><label>Lateral gain <select aria-label="Replay lateral gain" value={lateral} onChange={e=>setLateral(Number(e.target.value))}><option value="5">Original 5×</option><option value="1.5">Proposed 1.5×</option><option value="1">1×</option></select></label><input aria-label="Replay time" type="range" min="0" max={trial?.duration||31} step=".1" value={timeLabel} onChange={e=>{time.current=Number(e.target.value);setTimeLabel(time.current);}}/>{snapshot&&<a href={snapshot} download={`left-handed-frame-${snapshotGain}x.png`}>Download frame</a>}{download&&<a href={download} download={`left-handed-replay-${recordedGain}x.webm`}>Download replay capture</a>}<p>Recordings are replayed through the game’s paddle and camera. Estimated travel is not physical-position ground truth.</p></div>
 </main>;
}
