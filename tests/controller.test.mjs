import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WebSocket} from 'ws';
const origin='http://127.0.0.1:5174';
const moduleResponse=await fetch('http://127.0.0.1:8787/swing.mjs');assert.equal(moduleResponse.status,200);assert.ok((await moduleResponse.text()).includes('class SwingTracker'));
const platformResponse=await fetch('http://127.0.0.1:8787/platform.mjs');assert.equal(platformResponse.status,200);assert.match(platformResponse.headers.get('content-type'),/javascript/);assert.match(await platformResponse.text(),/requestSensorAccess/);
const res=await fetch('http://127.0.0.1:8787/session',{method:'POST',headers:{Origin:origin}});assert.equal(res.status,200);const session=await res.json();
assert.ok(session.phoneUrl.startsWith('https://'));assert.ok(!session.phoneUrl.includes(session.host));
const sockets=[];
const connect=role=>new Promise((resolve,reject)=>{const endpoint=role==='phone'?new URL(session.phoneUrl).origin.replace('https:','wss:'):'ws://127.0.0.1:8787';const ws=new WebSocket(`${endpoint}/?room=${session.room}&role=${role}&host=${role==='host'?session.host:''}`,{origin:role==='phone'?new URL(session.phoneUrl).origin:origin,ca:fs.readFileSync(new URL('../controller/.certs/ca.crt',import.meta.url))});sockets.push(ws);ws.once('open',()=>resolve(ws));ws.once('error',reject);});
const next=(ws,type,predicate=()=>true)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',listen);reject(Error(`Timed out waiting for ${type}`));},1500);const listen=raw=>{const m=JSON.parse(raw);if(m.type===type&&predicate(m)){clearTimeout(timer);ws.off('message',listen);resolve(m);}};ws.on('message',listen);});
try{
 const host=await connect('host');const paired=next(host,'status',m=>m.connected);const phone=await connect('phone');assert.equal((await paired).connected,true);
 const motion=next(host,'motion');phone.send(JSON.stringify({type:'motion',sentAt:1234.5,x:.5,y:-.4,yaw:.3,pitch:.2,roll:0,q:[0,0,0,1],swing:[.1,.2,-.3]}));const packet=await motion;assert.equal(packet.x,.5);assert.equal(packet.sentAt,1234.5);assert.deepEqual(packet.q,[0,0,0,1]);assert.deepEqual(packet.swing,[.1,.2,-.3]);
 const suspended=next(host,'suspend');phone.send(JSON.stringify({type:'suspend'}));await suspended;
 const aligned=next(phone,'align');host.send(JSON.stringify({type:'align'}));await aligned;
 const calibration=next(phone,'calibrate-grip');host.send(JSON.stringify({type:'calibrate-grip'}));await calibration;
 const gripReady=next(host,'grip-ready');phone.send(JSON.stringify({type:'grip-ready'}));await gripReady;
 const started=next(host,'start');phone.send(JSON.stringify({type:'start'}));await started;
 const gameState=next(phone,'game-status');host.send(JSON.stringify({type:'game-status',message:'Ready — tap Start'}));assert.equal((await gameState).message,'Ready — tap Start');
 const stoppedRecording=next(host,'stop-recording');phone.send(JSON.stringify({type:'stop-recording'}));await stoppedRecording;
 for(const [from,to,type]of [[phone,host,'alignment-start'],[host,phone,'show-marker'],[host,phone,'sync-screen'],[phone,host,'screen-aligned']]){const ack=next(to,type);from.send(JSON.stringify({type,nonce:'1234abcd'}));assert.equal((await ack).nonce,'1234abcd');}
 const toss=next(host,'toss');phone.send(JSON.stringify({type:'toss'}));await toss;
 const hit=next(phone,'impact');host.send(JSON.stringify({type:'impact',strength:20}));assert.equal((await hit).strength,1);
 let bad=false;const listener=raw=>{if(JSON.parse(raw).type==='motion')bad=true;};host.on('message',listener);phone.send(JSON.stringify({type:'motion',x:'bad',y:0,yaw:0,pitch:0,roll:0}));await new Promise(r=>setTimeout(r,60));assert.equal(bad,false);host.off('message',listener);
 const disconnected=next(host,'status');phone.close();assert.equal((await disconnected).connected,false);
 const trialResponse=await fetch(`http://127.0.0.1:8787/trial?room=${session.room}`,{method:'POST',headers:{Origin:origin},body:JSON.stringify({version:1,hand:'left',synthetic:true,rows:[{t:0,a:[0,0,0]}]})});
 assert.equal(trialResponse.status,200);const saved=await trialResponse.json();assert.equal(saved.samples,1);
 assert.match(saved.id,/^[0-9TZ-]+-[a-f0-9]{6}$/);
 const trialFile=new URL(`../controller/.trials/${saved.id}.json`,import.meta.url);assert.equal(JSON.parse(fs.readFileSync(trialFile,'utf8')).synthetic,true);fs.unlinkSync(trialFile);
 const invalidTrial=await fetch(`http://127.0.0.1:8787/trial?room=${session.room}`,{method:'POST',headers:{Origin:origin},body:JSON.stringify({version:1,hand:'left',rows:[{t:0,a:[null,0,0]}]})});assert.equal(invalidTrial.status,400);
 const forbidden=await fetch('http://127.0.0.1:8787/session',{method:'POST',headers:{Origin:'https://unrelated.example'}});assert.equal(forbidden.status,403);
 console.log('Passed: pairing, host-secret isolation, motion and toss relay, impact feedback/clamping, invalid motion rejection, disconnect, origin restriction.');
}finally{for(const ws of sockets)ws.close();}
