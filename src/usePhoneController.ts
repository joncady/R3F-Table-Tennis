import {useEffect, useRef, useState} from 'react';
import QRCode from 'qrcode';
import {PhoneMotionBuffer, PhonePose} from './phoneMotion';
export type {PhonePose} from './phoneMotion';
export default function usePhoneController(onCommand:(command:string)=>void){
 const [status,setStatus]=useState('Relay not paired');
 const [connected,setConnected]=useState(false);
 const [pairing,setPairing]=useState<{phoneUrl:string;certificateUrl?:string;qr:string}|null>(null);
 const pose=useRef<PhonePose|null>(null),socket=useRef<WebSocket|null>(null),generation=useRef(0);
 const motion=useRef(new PhoneMotionBuffer());
 const handler=useRef(onCommand);handler.current=onCommand;
 const pair=async()=>{
  motion.current.reset();const attempt=++generation.current;socket.current?.close();pose.current=null;setConnected(false);setStatus('Connecting to controller relay…');
  try{
   const response=await fetch(`${(import.meta.env.VITE_RELAY_HTTP || 'http://127.0.0.1:8787').replace(/\/$/, '')}/session`,{method:'POST'});if(!response.ok)throw Error('Relay rejected pairing');
   const session=await response.json();const qr=await QRCode.toDataURL(session.phoneUrl,{width:200,margin:1});
   if(attempt!==generation.current)return;
   setPairing({phoneUrl:session.phoneUrl,certificateUrl:session.certificateUrl,qr});
   const ws=new WebSocket(`${session.wsUrl || 'ws://127.0.0.1:8787/'}?room=${session.room}&role=host&host=${session.host}`);socket.current=ws;
   let latestSequence=-1;
   ws.onopen=()=>{setStatus('Scan QR on your phone');ws.send(JSON.stringify({type:'hello'}));};
   ws.onmessage=e=>{if(attempt!==generation.current)return;const m=JSON.parse(e.data);
    if(m.type==='status'){latestSequence=-1;setConnected(m.connected);setStatus(m.connected?'Phone connected':'Waiting for phone');if(!m.connected){pose.current=null;motion.current.reset();handler.current('disconnected');}}
    else if(m.type==='motion'&&['x','y','yaw','pitch','roll'].every(k=>Number.isFinite(m[k]))){if(Number.isSafeInteger(m.seq)){if(m.seq<=latestSequence)return;latestSequence=m.seq;}pose.current={...m,received:performance.now()};motion.current.push(pose.current!);}
    else if(m.type==='probe'&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'probe',id:m.id,sent:m.sent}));
    else if(['toss','pause','recenter','suspend'].includes(m.type)){if(m.type==='recenter')motion.current.reset();handler.current(m.type);}
   };
   ws.onclose=()=>{if(attempt===generation.current){setConnected(false);pose.current=null;setStatus('Relay disconnected · pair again');handler.current('disconnected');}};
   ws.onerror=()=>setStatus('Relay unavailable · check your connection and retry pairing');
  }catch{if(attempt===generation.current)setStatus('Relay unavailable. Retry pairing; for local development run npm run controller');}
 };
 const impact=(strength:number)=>{if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:'impact',strength}));};
 useEffect(()=>()=>{generation.current++;socket.current?.close();},[]);
 return {status,connected,pairing,pose,pair,impact,samplePose:(now:number)=>motion.current.sample(now)};
}
