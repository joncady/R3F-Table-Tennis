import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {performance} from 'node:perf_hooks';
const http=process.env.RELAY_HTTP;if(!http)throw Error('Set RELAY_HTTP to the deployed HTTPS API endpoint');
const origin='https://joncady.github.io';
const request=await fetch(`${http}/session`,{method:'POST',headers:{Origin:origin}});assert.equal(request.status,200);const session=await request.json();assert.ok(session.cloud);assert.ok(session.phoneUrl.includes('relay='));
const connections=[];
const open=role=>new Promise((resolve,reject)=>{const ws=new WebSocket(`${session.wsUrl}?room=${session.room}&role=${role}${role==='host'?`&host=${session.host}`:''}`,{origin});connections.push(ws);ws.once('open',()=>resolve(ws));ws.once('error',reject);});
const next=(ws,type,predicate=()=>true)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',listener);reject(Error(`Timeout: ${type}`));},15000);const listener=raw=>{const value=JSON.parse(raw);if(value.type===type&&predicate(value)){clearTimeout(timer);ws.off('message',listener);resolve(value);}};ws.on('message',listener);});
try{
 const host=await open('host');const phone=await open('phone');
 const ready=next(host,'status',m=>m.connected);phone.send(JSON.stringify({type:'hello'}));await ready;
 host.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='probe')host.send(JSON.stringify(m));});
 const motion=next(host,'motion');phone.send(JSON.stringify({type:'motion',sentAt:1234.5,seq:1,x:.4,y:-.2,yaw:.3,pitch:.1,roll:0,q:[0,0,0,1],swing:[.2,0,-.1]}));const pose=await motion;assert.deepEqual(pose.swing,[.2,0,-.1]);assert.equal(pose.seq,1);assert.equal(pose.sentAt,1234.5);
 const pause=next(host,'pause');phone.send(JSON.stringify({type:'pause'}));await pause;
 const impact=next(phone,'impact');host.send(JSON.stringify({type:'impact',strength:.7}));assert.equal((await impact).strength,.7);
 const toss=next(host,'toss');phone.send(JSON.stringify({type:'toss'}));await toss;
 const rtt=[];for(let id=1;id<=10;id++){const response=next(phone,'probe',m=>m.id===id),sent=performance.now();phone.send(JSON.stringify({type:'probe',id,sent}));await response;rtt.push(performance.now()-sent);}
 const received=[];const listener=raw=>{const m=JSON.parse(raw);if(m.type==='motion')received.push(m.seq);};host.on('message',listener);
 for(let seq=2;seq<32;seq++){phone.send(JSON.stringify({type:'motion',seq,x:.4,y:0,yaw:0,pitch:0,roll:0,q:[0,0,0,1],swing:[.1,0,0]}));await new Promise(r=>setTimeout(r,17));}
 await new Promise(r=>setTimeout(r,5000));host.off('message',listener);console.log(`Received ${new Set(received).size}/30 motion packets`);assert.equal(new Set(received).size,30);
 const disconnected=next(host,'status',m=>!m.connected);phone.close();await disconnected;
 const rejected=await fetch(`${http}/session`,{method:'POST',headers:{Origin:'https://unrelated.example'}});assert.equal(rejected.status,403);
 rtt.sort((a,b)=>a-b);console.log(JSON.stringify({passed:true,tests:['public pairing','CA-trusted WSS','orientation and acceleration','impact feedback','toss','pause','source timestamps','bidirectional probe','30 motion packets at ~60Hz','disconnect','origin restrictions'],roundTripMs:{min:Math.round(rtt[0]),median:Math.round(rtt[5]),max:Math.round(rtt.at(-1))},motionPackets:received.length,outOfOrder:received.some((v,i)=>i>0&&v<received[i-1])},null,2));
}finally{for(const ws of connections)ws.close();}
