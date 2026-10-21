import TouchControls from './TouchControls';
import {usesTouchControls} from './touchDevice';
import {Suspense,useEffect,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import QRCode from 'qrcode';
import {Court} from './App';
import {Match,PlayerInput,Rotation} from './engine';

type Snapshot={sequence:number;paused:boolean;started:boolean;phase:Match['phase'];score:number[];server:0|1;winner:0|1|null;ball:Match['ball'];paddles:Match['paddles'];players:{body:Match['body'];brush:Match['brush'];rotation:Rotation;handedness:'left'|'right';backhand:boolean}[];seats:{connected:boolean;phone:boolean;mode:string;ready:boolean}[]};
const base=()=>`${location.origin}${location.pathname}`;
const initial=new URLSearchParams(location.hash.slice(1));
export default function Multiplayer(){
 const [touchMode]=useState(usesTouchControls);
 const [api]=useState(()=>import.meta.env.VITE_MATCH_HTTP||(location.hostname==='127.0.0.1'||location.hostname==='localhost'?'http://127.0.0.1:8790':''));
 const [ended,setEnded]=useState(false);
 const [key,setKey]=useState(''),[error,setError]=useState(''),[status,setStatus]=useState('Create a private match or open an invite.'),[busy,setBusy]=useState(false);
 const [identity,setIdentity]=useState<{id:string;ticket:string}|null>(()=>initial.get('ticket')?{id:initial.get('room')||'',ticket:initial.get('ticket')!}:null);
 const [invite,setInvite]=useState(''),[phoneLink,setPhoneLink]=useState(''),[qr,setQr]=useState(''),[connected,setConnected]=useState(false),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[mode,setMode]=useState('mouse');
 const [match]=useState(()=>new Match('left'));const surface=useRef<HTMLElement>(null),socket=useRef<WebSocket|null>(null),input=useRef<PlayerInput>({x:0,y:0}),side=useRef(0),latest=useRef<Snapshot|null>(null),previous=useRef<Snapshot|null>(null),arrived=useRef(0),locked=useRef(false),lastSequence=useRef(-1);
 const noPose=useRef(null);
 const send=(m:object)=>{if(socket.current?.readyState===1&&socket.current.bufferedAmount<8192)socket.current.send(JSON.stringify(m));};
 const request=async(path:string,body?:object)=>{
  if(!api)throw Error('Multiplayer has not been configured in this build.');
  const response=await fetch(api+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);
  const result=await response.json();if(!response.ok)throw Error(result.error||'Match request failed');return result;
 };
 const remember=(value:{id:string;ticket:string})=>{history.replaceState(null,'',`?multiplayer#room=${value.id}&ticket=${value.ticket}`);setIdentity(value);};
 const create=async()=>{setBusy(true);setError('');try{const room=await request('/rooms',{key});remember(room);setInvite(`${base()}?multiplayer#room=${room.id}&invite=${room.invite}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 useEffect(()=>{
  if(identity||!initial.get('invite'))return;
  let cancelled=false;setBusy(true);
  // The single promise survives StrictMode's effect replay without claiming twice.
  const pending=joinInvite(api,initial.get('room')!,initial.get('invite')!);
  void pending.then(room=>{if(!cancelled)remember(room);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});
  return()=>{cancelled=true;};
 },[api,identity]);
 useEffect(()=>{
  if(!identity)return;
  let cancelled=false,timer:ReturnType<typeof setTimeout>,ws:WebSocket|null=null,retries=0;
  const poll=async()=>{
   try{
    setStatus('Starting match server… You can share the invite while it wakes.');
    const result=await request(`/rooms/${identity.id}?ticket=${identity.ticket}`);if(cancelled)return;
    if(result.status==='stopped'){setEnded(true);setStatus('Match server stopped. Create a new match.');return;}
    if(result.status!=='ready'){timer=setTimeout(poll,2500);return;}
    side.current=result.side;
    if(result.invite)setInvite(`${base()}?multiplayer#room=${identity.id}&invite=${result.invite}`);
    const url=new URL(`${base()}controller.html`);url.hash=new URLSearchParams({room:identity.id,relay:result.wsUrl,token:result.phoneToken}).toString();setPhoneLink(url.href);void QRCode.toDataURL(url.href,{width:180,margin:1}).then(setQr);
    ws=new WebSocket(`${result.wsUrl}?role=display&token=${identity.ticket}`);socket.current=ws;lastSequence.current=-1;
    ws.onopen=()=>{if(cancelled)return;setConnected(true);setError('');setStatus('Connected. Choose a paddle, then Ready.');retries=0;};
    ws.onmessage=event=>{if(cancelled)return;const m=JSON.parse(event.data);
     if(m.type==='snapshot'&&m.sequence>lastSequence.current){lastSequence.current=m.sequence;previous.current=latest.current;latest.current=m;arrived.current=performance.now();setSnapshot(m);setMode(m.seats[side.current].mode);}
     if(m.type==='shutdown'){setStatus(m.reason);setConnected(false);}
    };
    ws.onclose=event=>{if(cancelled)return;if(event.code===4001){setConnected(false);setError('This player seat was opened in another tab. Close that tab before reconnecting.');return;}setConnected(false);setStatus('Disconnected. Reconnecting…');if(++retries<=24)timer=setTimeout(poll,2500);else setError('Connection lost. Reopen your saved match link or create a new room.');};
    ws.onerror=()=>setStatus('Connecting securely to the game server…');
   }catch(e){if(!cancelled){setError((e as Error).message);timer=setTimeout(poll,5000);}}
  };void poll();
  return()=>{cancelled=true;clearTimeout(timer);ws?.close();socket.current=null;};
 // request uses the fixed API URL; identity is the connection lifetime.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[api,identity]);
 useEffect(()=>{
  const held=new Set<string>();
  const editable=(e:KeyboardEvent)=>e.target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
  const keydown=(e:KeyboardEvent)=>{
   if(editable(e))return;
   if(['KeyA','KeyD','KeyW','KeyS','Space'].includes(e.code))e.preventDefault();
   held.add(e.code);
   if(e.code==='Space'&&!e.repeat)send({type:'toss'});
   if(e.code==='Escape')send({type:'suspend'});
   if(e.code==='KeyF'&&!e.repeat)void (document.fullscreenElement?document.exitFullscreen():surface.current?.requestFullscreen());
  };
  const keyup=(e:KeyboardEvent)=>held.delete(e.code);
  const mouse=(e:MouseEvent)=>{if(touchMode||!locked.current)return;input.current.x=Math.max(-1,Math.min(1,input.current.x+e.movementX*.009));input.current.y=Math.max(-1,Math.min(1,input.current.y-e.movementY*.009));};
  const change=()=>{locked.current=document.pointerLockElement===surface.current;if(!locked.current&&!touchMode){held.clear();send({type:'suspend'});}};
  const blur=()=>{held.clear();send({type:'suspend'});};
  const timer=setInterval(()=>{
   if(!touchMode){input.current.moveX=Number(held.has('KeyD'))-Number(held.has('KeyA'));input.current.moveZ=Number(held.has('KeyS'))-Number(held.has('KeyW'));}
   send({type:'input',...input.current});if(!touchMode){input.current.x*=Math.exp(-.8/60);input.current.y*=Math.exp(-2.4/60);}
  },1000/60);
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('mousemove',mouse);window.addEventListener('blur',blur);document.addEventListener('pointerlockchange',change);
  return()=>{clearInterval(timer);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('mousemove',mouse);window.removeEventListener('blur',blur);document.removeEventListener('pointerlockchange',change);};
 },[touchMode]);
 useEffect(()=>{if((snapshot?.paused||snapshot?.phase==='over')&&document.pointerLockElement)document.exitPointerLock();},[snapshot?.paused,snapshot?.phase]);
 const applySnapshot=()=>{
  const s=latest.current;if(!s)return;
  const other=side.current===0?1:0,sign=side.current===0?1:-1;
  const mix=(a:number,b:number)=>a+(b-a)*Math.min(1,(performance.now()-arrived.current)/(1000/30));
  const lerp=(object:object,old?:object)=>Object.fromEntries(Object.entries(object).map(([k,v])=>[k,old?mix((old as Record<string,number>)[k],v):v]));
  match.phase=s.phase;match.score=[s.score[side.current],s.score[other]];match.server=s.server===side.current?0:1;match.winner=s.winner===null?null:s.winner===side.current?0:1;
  const b=lerp(s.ball,previous.current?.ball) as unknown as Match['ball'];b.x*=sign;b.z*=sign;b.vx*=sign;b.vz*=sign;b.wx*=sign;b.wz*=sign;match.ball=b;
  match.paddles=[side.current,other].map(i=>{const p=lerp(s.paddles[i],previous.current?.paddles[i]) as unknown as Match['paddles'][number];return {...p,x:p.x*sign,z:p.z*sign,vx:p.vx*sign,vz:p.vz*sign};});
  const player=s.players[side.current];match.body=player.body;match.brush=player.brush;match.handedness=player.handedness;match.backhand=player.backhand;match.paddleRotation=player.rotation;
  const q=s.players[other].rotation;match.far.rotation=[q[2],q[3],-q[0],-q[1]];
  match.message=s.paused?'Both players must be ready to play':s.phase==='serve'?`${match.server===0?'Your':'Opponent’s'} serve${match.server===0?(touchMode?' · Tap to toss':' · Space / phone Toss'):''}`:s.phase==='over'?`${match.winner===0?'You win!':'Opponent wins.'}`:s.phase==='point'?'Point · next serve shortly':'Rally';
 };
 const ready=async()=>{setError('');try{if(mode==='mouse'&&!touchMode){if(!surface.current?.requestPointerLock)throw Error('Mouse capture is unavailable. Open this game in Chrome.');await surface.current.requestPointerLock();}send({type:'ready'});}catch(e){setError((e as Error).message||'Mouse capture was blocked. Click Ready again.');}};
 const mine=snapshot?.seats[side.current],opponent=snapshot?.seats[side.current===0?1:0];
 return <main ref={surface} className={touchMode?'touch-game':undefined}>
  <Canvas><color attach="background" args={['#102a34']}/><Suspense fallback={null}><Court steadyInput={touchMode} match={match} input={input} update={()=>{}} cameraStrength={.65} phoneActive={false} phonePose={noPose} phoneSensitivity={2} lateralFollow={1.5} impact={()=>{}} networkFrame={applySnapshot}/></Suspense></Canvas>
  {touchMode&&mode==='mouse'&&connected&&snapshot&&!snapshot.paused&&snapshot.phase!=='over'&&<TouchControls input={input} hand={snapshot.players[side.current].handedness} serve={()=>send({type:'toss'})}/>}
  <header><div className="brand">TABLE / TENNIS<small>Private multiplayer</small></div><div className="score">YOU <b>{snapshot?.score[side.current]??0}</b> : <b>{snapshot?.score[side.current===0?1:0]??0}</b> OPPONENT</div><div className="view-controls"><button onClick={()=>send({type:'pause'})}>Pause / ready</button><button onClick={()=>{send({type:'leave'});socket.current?.close();location.href=base();}}>Leave match</button></div></header>
  <section className="status"><h2>{match.message}</h2><p>{touchMode?'Movement wheel to move · Drag to swing · Tap to toss':'A/D move · W/S step · Mouse swing · Space toss · F fullscreen · Esc pause'}</p></section>
  {(!connected||snapshot?.paused||snapshot?.phase==='over')&&<div className="overlay pairing"><article><small>PRIVATE MULTIPLAYER</small><h1>{snapshot?.phase==='over'?match.message:identity?'Your match room.':'Play together.'}</h1><p role="status">{status}</p>{error&&<p role="alert">{error}</p>}
   {ended&&<button onClick={()=>{location.href='?multiplayer';}}>Create another match</button>}
   {!identity&&<><label>Private launch key <input aria-label="Private launch key" type="password" value={key} onChange={e=>setKey(e.target.value)}/></label><button disabled={busy} onClick={()=>void create()}>Create match</button></>}
   {invite&&<p>Invite your opponent: <a href={invite}>{invite}</a><br/><button onClick={()=>void navigator.clipboard.writeText(invite)}>Copy invite</button></p>}
   {connected&&<><p>You: {mine?.ready?'Ready':'Not ready'} · Opponent: {opponent?.connected?opponent.ready?'Ready':'Choosing controls':'Waiting to join'}</p><div className="hand-choice"><button aria-pressed={mode==='mouse'} onClick={()=>send({type:'mode',mode:'mouse'})}>{touchMode?'Touch controls':'Mouse + keyboard'}</button><button aria-pressed={mode==='phone'} onClick={()=>send({type:'mode',mode:'phone'})}>iPhone / Android</button></div>
    {mode==='phone'&&<><p>{mine?.phone?'Phone paired. Keep its controller open.':'Scan with your phone, tap Connect, then calibrate.'}</p>{qr&&<img src={qr} width="180" height="180" alt="Pair your phone to your player seat"/>}<p><a href={phoneLink}>Open phone controller</a></p></>}
    <div className="hand-choice"><button onClick={()=>send({type:'hand',hand:'left'})}>Left handed</button><button onClick={()=>send({type:'hand',hand:'right'})}>Right handed</button></div>
    {snapshot?.phase==='over'?<button onClick={()=>send({type:'rematch'})}>New game</button>:<button disabled={mode==='phone'&&!mine?.phone} onClick={()=>void ready()}>Ready / resume</button>}<p>Both players must be ready. Keep this match link to reconnect; treat it like a password.</p></>}
   <p><a href={base()}>Back to solo play</a></p>
  </article></div>}
 </main>;
}
let joining:Promise<{id:string;ticket:string}>|null=null;
function joinInvite(api:string,id:string,invite:string){
 joining??=fetch(`${api}/rooms/${id}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite})}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error);return body;});return joining;
}
