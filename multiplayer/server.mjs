import http from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';
import {Match} from './engine.mjs';

const neutral=()=>({x:0,y:0,moveX:0,moveZ:0});
const finite=(v,low,high)=>Number.isFinite(v)?Math.max(low,Math.min(high,v)):0;
export function sanitizeInput(m){
 const input={x:finite(m.x,-1,1),y:finite(m.y,-1,1),moveX:finite(m.moveX,-1,1),moveZ:finite(m.moveZ,-1,1)};
 if(m.phone===true){
  input.phone=true;
  if(Array.isArray(m.swingOffset)&&m.swingOffset.length===3&&m.swingOffset.every(Number.isFinite))input.swingOffset=m.swingOffset.map((v,i)=>finite(v,i===0?-2:-.8,i===0?2:.9));
  if(Array.isArray(m.orientation)&&m.orientation.length===4&&m.orientation.every(Number.isFinite)){
   const length=Math.hypot(...m.orientation);
   if(length>.01)input.orientation=m.orientation.map(v=>v/length);
  }
 }
 return input;
}
export function createMatchServer({room,port=8080,idleMs=90000,waitingMs=300000,maxMs=7200000,onStop=()=>{},heartbeat=()=>{}}){
 const match=new Match('left');match.multiplayer=true;
 const seats=[0,1].map(()=>({display:null,phone:null,mode:'mouse',input:neutral(),ready:false,lastInput:0,lastMotion:0,lastSeq:-1,impacts:0,lastStatus:''}));
 let stopped=false,started=false,paused=true,emptySince=Date.now(),lastTick=performance.now(),accumulator=0,sequence=0;
 const born=Date.now();let hadDisplay=false,pausedSince=born,overSince=0;
 const server=http.createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:!stopped}));});
 const wss=new WebSocketServer({server,maxPayload:4096});
 const send=(ws,m)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<65536)ws.send(JSON.stringify(m));};
 const pause=()=>{if(!paused)pausedSince=Date.now();paused=true;for(const seat of seats){seat.ready=false;seat.input=neutral();}};
 const snapshot=()=>({type:'snapshot',sequence:sequence++,time:Date.now(),paused,started,phase:match.phase,timer:match.timer,score:match.score,server:match.server,winner:match.winner,ball:match.ball,paddles:match.paddles,players:[{body:match.body,brush:match.brush,rotation:match.paddleRotation,handedness:match.handedness,backhand:match.backhand},{body:match.far.body,brush:match.far.brush,rotation:match.far.rotation,handedness:match.far.handedness,backhand:match.far.backhand}],seats:seats.map(s=>({connected:!!s.display,phone:!!s.phone,mode:s.mode,ready:s.ready})),message:match.message});
 const broadcast=()=>{const m=snapshot();for(let i=0;i<2;i++){
  const seat=seats[i];send(seat.display,m);
  const status={type:'match-status',paused,ready:seat.ready,phase:match.phase,serving:match.server===i,display:!!seat.display,opponent:!!seats[1-i].display};
  const key=JSON.stringify(status);if(key!==seat.lastStatus){seat.lastStatus=key;send(seat.phone,status);}
 }};
 wss.on('connection',(ws,req)=>{
  const url=new URL(req.url,'http://localhost');
  const role=url.searchParams.get('role'),token=url.searchParams.get('token');
  const side=room.seats.findIndex(s=>token===(role==='phone'?s.phone:s.display));
  if(side<0||!['phone','display'].includes(role)){ws.close(1008,'Invalid seat credential');return;}
  const seat=seats[side];const previous=seat[role];
  seat[role]=ws;seat.lastSeq=-1;
  if(previous)previous.close(4001,'Controller replaced');
  if(role==='phone'){seat.mode='phone';seat.lastStatus='';}
  pause();emptySince=Date.now();
  ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true;});
  send(ws,{type:'welcome',side,role});send(ws,{type:'status',connected:!!seat.display});broadcast();
  let budget=0,windowStart=Date.now();
  ws.on('message',data=>{
   if(seat[role]!==ws)return;
   if(Date.now()-windowStart>=1000){windowStart=Date.now();budget=0;}
   if(++budget>180){ws.close(1008,'Input rate exceeded');return;}
   let m;try{m=JSON.parse(data);}catch{return;}
   if(!m||typeof m!=='object')return;
   if(m.type==='probe'){send(ws,{type:'probe',id:m.id,sent:m.sent});return;}
   if(m.type==='input'&&role==='display'){
    if(seat.mode==='mouse')seat.input=sanitizeInput({...m,phone:false});
    else {seat.input.moveX=finite(m.moveX,-1,1);seat.input.moveZ=finite(m.moveZ,-1,1);}
    seat.lastInput=Date.now();
   }
   if(m.type==='motion'&&role==='phone'&&seat.mode==='phone'){
    if(!Number.isSafeInteger(m.seq)||m.seq<=seat.lastSeq)return;seat.lastSeq=m.seq;
    const phoneInput=sanitizeInput({phone:true,x:m.x,y:m.y,swingOffset:Array.isArray(m.swing)?m.swing.map((v,i)=>v*(i===0?3:2)):undefined,orientation:m.q});
    seat.input={...seat.input,...phoneInput};seat.lastMotion=Date.now();
   }
   if(m.type==='mode'&&role==='display'&&['mouse','phone'].includes(m.mode)){seat.mode=m.mode;seat.input=neutral();pause();}
   if(m.type==='hand'&&role==='display'&&['left','right'].includes(m.hand)&&!['toss','rally'].includes(match.phase)){
    if(side===1)match.mirror();match.setHand(m.hand);if(side===1)match.mirror();
   }
   if(m.type==='ready'&&role==='display'||m.type==='pause'){
    if(m.type==='pause'&&!paused)pause();
    else if(seat.display&&(seat.mode==='mouse'||seat.phone))seat.ready=true;
   }
   if(m.type==='suspend'){pause();}
   if(m.type==='recenter'){seat.input=neutral();}
   if(m.type==='toss'&&!paused&&side===match.server)match.serve();
   if(m.type==='leave'&&role==='display')ws.close(1000,'Left match');
   if(m.type==='rematch'&&role==='display'&&match.phase==='over'){
    // Both players explicitly ready a fresh game; never overwrite a live score.
    match.score=[0,0];match.winner=null;match.server=0;match.phase='ready';started=false;pause();
   }
  });
  ws.on('close',()=>{if(seat[role]!==ws)return;seat[role]=null;pause();broadcast();});
 });
 const shutdown=async(reason)=>{
  if(stopped)return;stopped=true;clearInterval(tick);clearInterval(publish);clearInterval(liveness);clearInterval(report);
  for(const ws of wss.clients){send(ws,{type:'shutdown',reason});ws.close(1001,reason);setTimeout(()=>ws.terminate(),200).unref();}
  server.close();wss.close();await onStop(reason);
 };
 const tick=setInterval(()=>{
  const now=Date.now(),clock=performance.now();accumulator+=Math.min(.1,(clock-lastTick)/1000);lastTick=clock;
  const displays=seats.filter(s=>s.display).length;
  if(displays){hadDisplay=true;emptySince=now;}
  if(match.phase==='over'){overSince ||= now;}else overSince=0;
  if((!displays&&hadDisplay&&now-emptySince>idleMs)||(!started&&now-born>waitingMs)||now-born>maxMs||(paused&&now-pausedSince>waitingMs)||(overSince&&now-overSince>120000)){void shutdown('Match server idle or lifetime limit reached');return;}
  if(seats.some(s=>s.ready&&(!s.lastInput||now-s.lastInput>1500||(s.mode==='phone'&&(!s.lastMotion||now-s.lastMotion>1500))))){pause();}
  if(seats.every(s=>s.ready&&s.display&&(s.mode==='mouse'||s.phone))){
   if(!started){match.start();started=true;}paused=false;
  }
  while(accumulator>=1/120){if(!paused)match.step(1/120,seats[0].input,seats[1].input);accumulator-=1/120;}
  for(let side=0;side<2;side++)if(match.impacts[side]!==seats[side].impacts){seats[side].impacts=match.impacts[side];send(seats[side].phone,{type:'impact',strength:match.impactStrength});}
 },1000/120);
 const publish=setInterval(broadcast,1000/30);
 const liveness=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},10000);
 const report=setInterval(()=>{void heartbeat({started,displays:seats.filter(s=>s.display).length});},15000);
 server.listen(port,'0.0.0.0');
 return {server,match,seats,shutdown,snapshot};
}
if(process.env.ROOM_JSON){
 const room=JSON.parse(process.env.ROOM_JSON);
 const callback=async(extra)=>{
  if(!process.env.CONTROL_URL)return;
  try{await fetch(`${process.env.CONTROL_URL}/heartbeat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:room.id,secret:room.secret,...extra}),signal:AbortSignal.timeout(5000)});}catch(error){console.error('Heartbeat unavailable',error.message);}
 };
 createMatchServer({room,port:Number(process.env.PORT||8080),idleMs:Number(process.env.IDLE_MS||90000),heartbeat:callback,onStop:async(reason)=>{await callback({stopped:true,reason});process.exit(0);}});
}
