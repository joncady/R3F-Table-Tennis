import {Suspense, useEffect, useRef, useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {Court} from './App';
import {PracticePlayer,practiceMatch} from './practicePlayer';
import {PlayerInput} from './engine';
import {PhonePose} from './phoneMotion';
export default function Demo(){
 const [match,setMatch]=useState(practiceMatch),[running,setRunning]=useState(false),[download,setDownload]=useState(''),[error,setError]=useState('');
 const [,refresh]=useState(0);
 const surface=useRef<HTMLElement>(null),player=useRef(new PracticePlayer()),input=useRef<PlayerInput>({x:0,y:0});
 const pose=useRef<PhonePose|null>({x:0,y:0,yaw:0,pitch:0,roll:0,q:[0,0,0,1],received:Infinity});
 const recorder=useRef<MediaRecorder|null>(null),frame=useRef(0),elapsed=useRef(0),done=useRef(0),url=useRef('');
 useEffect(()=>()=>{cancelAnimationFrame(frame.current);if(recorder.current?.state==='recording')recorder.current.stop();if(url.current)URL.revokeObjectURL(url.current);},[]);
 const start=()=>{
  const source=surface.current?.querySelector('canvas');if(!source)return;
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime){setError('This browser cannot record WebM');return;}
  const next=practiceMatch();setMatch(next);player.current=new PracticePlayer();elapsed.current=0;done.current=0;
  const output=document.createElement('canvas');output.width=1280;output.height=720;
  const ctx=output.getContext('2d');if(!ctx)return;
  const stream=output.captureStream(30),chunks:BlobPart[]=[];
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3500000});recorder.current=rec;
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onstop=()=>{cancelAnimationFrame(frame.current);stream.getTracks().forEach(t=>t.stop());if(url.current)URL.revokeObjectURL(url.current);url.current=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));setDownload(url.current);setRunning(false);refresh(n=>n+1);};
  rec.onerror=()=>{setError('Recording failed');rec.stop();};
  const draw=()=>{
   ctx.drawImage(source,0,0,1280,720);
   ctx.fillStyle='#071a24ed';ctx.fillRect(0,0,1280,96);ctx.fillRect(0,658,1280,62);
   ctx.fillStyle='#d8f47c';ctx.font='bold 28px system-ui';ctx.fillText(`AGENT  ${next.score[0]}  :  ${next.score[1]}  CPU`,28,38);
   ctx.font='17px system-ui';ctx.fillStyle='#eef4ea';ctx.fillText(`First to 11 · win by two · full match at 4× · game time ${elapsed.current.toFixed(0)}s`,28,70);
   ctx.font='16px system-ui';ctx.fillText('Automated paddle input · same physics, collision and scoring · NOT a real phone/network trial',28,685);
   ctx.fillText(next.phase==='over'?`${next.winner===0?'Agent wins':'CPU wins'} ${next.score.join('–')}`:next.message,28,709);
   if(next.phase==='over'){if(!done.current)done.current=performance.now();if(performance.now()-done.current>2500){rec.stop();return;}}
   frame.current=requestAnimationFrame(draw);
  };
  setDownload('');setError('');setRunning(true);rec.start(1000);draw();
 };
 return <main ref={surface}>
  <Canvas frameloop={running?'always':'never'} gl={{preserveDrawingBuffer:true}}><color attach="background" args={['#102a34']}/><Suspense fallback={null}><Court match={match} input={input} update={()=>refresh(n=>n+1)} cameraStrength={.65} phoneActive phonePose={pose} phoneSensitivity={1} lateralFollow={1} impact={()=>{}} timeScale={4} beforeStep={dt=>{input.current=player.current.input(match,dt);if(match.phase!=='over')elapsed.current+=dt;}}/></Suspense></Canvas>
  <div className="replay-controls"><strong>Agent match · {match.score.join(' : ')} · {match.phase==='over'?(match.winner===0?'Agent wins':'CPU wins'):'First to 11'}</strong><p>Automated paddle input, not a real phone trial. Full match recorded at 4×. The CPU has normal per-shot placement error; no points or ball state are scripted.</p><button disabled={running} onClick={start}>{running?'Recording full match…':'Record agent match'}</button>{download&&<a href={download} download="agent-vs-cpu-full-match-4x.webm">Download full match video</a>}{error&&<p role="alert">{error}</p>}<p><a href={import.meta.env.BASE_URL}>Back to game</a></p></div>
 </main>;
}
