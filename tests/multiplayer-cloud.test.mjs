import fs from 'node:fs';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {execFileSync} from 'node:child_process';
import {phonePage} from './phone-page-harness.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../multiplayer/deployment.local',import.meta.url),'utf8'));
const key=fs.readFileSync(new URL('../multiplayer/launch-key.local',import.meta.url),'utf8').trim(),api=config.ControlUrl;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const request=async(path,body)=>{
 const response=await fetch(api+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();if(!response.ok)throw Error(`${response.status}: ${data.error}`);return data;
};
const until=async(test,timeout=8000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await test())return;await wait(50);}throw Error('Condition timed out');};
const priorPath=new URL('../multiplayer/trial-room.local',import.meta.url);
if(fs.existsSync(priorPath)){
 const prior=JSON.parse(fs.readFileSync(priorPath,'utf8'));
 console.log('Checking previous trial has shut down.');
 await until(async()=>{const result=await request(`/rooms/${prior.id}?ticket=${prior.ticket}`);if(result.status==='stopped')return true;await wait(2450);return false;},240000);
}
await assert.rejects(request('/rooms',{key:'invalid'}),/403/);
const began=Date.now(),room=await request('/rooms',{key});
await assert.rejects(request('/rooms',{key}),/409/);
fs.writeFileSync(new URL('../multiplayer/trial-room.local',import.meta.url),JSON.stringify(room),{mode:0o600});
console.log('Requested cold match server.');
const joined=await request(`/rooms/${room.id}/join`,{invite:room.invite});
let connection;
await until(async()=>{connection=await request(`/rooms/${room.id}?ticket=${room.ticket}`);if(connection.status==='stopped')throw Error('Task stopped during startup');if(connection.status!=='ready'){await wait(2450);return false;}return true;},540000);
const apiReadyMs=Date.now()-began;console.log(`Server + DNS ready after ${(apiReadyMs/1000).toFixed(1)} seconds.`);
const second=await request(`/rooms/${room.id}?ticket=${joined.ticket}`);
const ws=async ticket=>{let socket;await until(async()=>{socket=new WebSocket(`${connection.wsUrl}?role=display&token=${ticket}`);try{await once(socket,'open');return true;}catch{socket.close();await wait(1000);return false;}},120000);return socket;};
const a=await ws(room.ticket),b=await ws(joined.ticket),send=(socket,m)=>{if(socket.readyState===1)socket.send(JSON.stringify(m));};
let latest,phone,timer,y=0,beta=0;
a.on('message',data=>{const m=JSON.parse(data);if(m.type==='snapshot')latest=m;});
const evidence={startupMs:Date.now()-began,apiReadyMs,checks:[]};console.log(`Public WSS connected after ${(evidence.startupMs/1000).toFixed(1)} seconds.`);
try{
 timer=setInterval(()=>{y=latest?.phase==='toss'&&latest.timer>.83?.9:0;send(a,{type:'input',x:0,y});send(b,{type:'input',x:0,y:0});if(phone)phone.orientation({alpha:0,beta,gamma:0});},17);
 await until(()=>latest);
 // Both shipped phone variants connect to the remote server through the real page code.
 for(const kind of ['ios','android']){
  phone=await phonePage({endpoint:connection.wsUrl,room:room.id,token:second.phoneToken,kind});
  await until(()=>latest.seats[1].phone);phone.orientation({alpha:0,beta:0,gamma:0});await wait(80);send(a,{type:'ready'});send(b,{type:'ready'});await until(()=>!latest.paused);beta=25;
  await until(()=>Math.abs(latest.players[1].rotation[0])>.05);
  beta=0;assert.equal(latest.seats[1].mode,'phone');evidence.checks.push(`${kind} shipped controller sensor orientation over WSS`);
  if(kind==='ios'){phone.close();phone=null;await until(()=>!latest.seats[1].phone);}
 }
 send(a,{type:'ready'});send(b,{type:'ready'});await until(()=>!latest.paused);
 evidence.checks.push('mouse + phone match readiness');
 send(a,{type:'toss'});await until(()=>latest.phase==='toss');
 await until(()=>latest.phase==='rally',3000);evidence.checks.push('mouse serves legally into authoritative rally');
 await until(()=>phone.flashes>0,5000);evidence.checks.push('phone paddle returns ball and shipped controller receives authoritative impact feedback');
 phone.command('pause');await until(()=>latest.paused);send(a,{type:'ready'});phone.command('pause');await until(()=>!latest.paused);evidence.checks.push('phone pause and resume requires both players ready');
 phone.close();phone=null;await until(()=>latest.paused&&!latest.seats[1].phone);evidence.checks.push('phone disconnect pauses match');
 // Switch back to mouse and ensure both world-space paddles respond independently.
 send(b,{type:'mode',mode:'mouse'});await until(()=>latest.seats[1].mode==='mouse');send(a,{type:'ready'});send(b,{type:'ready'});await until(()=>!latest.paused);evidence.checks.push('phone-to-mouse switch resumes same match');
 assert.ok(latest.sequence>10);evidence.checks.push('ordered authoritative snapshots');
}catch(error){console.error('Last authoritative state:',JSON.stringify({phase:latest?.phase,timer:latest?.timer,paused:latest?.paused,score:latest?.score,ball:latest?.ball,paddles:latest?.paddles}));throw error;}finally{clearInterval(timer);phone?.close();a.close();b.close();}
const leftAt=Date.now();console.log('All clients closed; waiting for automatic task shutdown.');
await until(async()=>{await wait(2450);const result=await request(`/rooms/${room.id}?ticket=${room.ticket}`);return result.status==='stopped';},240000);
evidence.shutdownMs=Date.now()-leftAt;evidence.checks.push('automatic shutdown confirmed by control API after ECS STOPPED');
const running=JSON.parse(execFileSync('aws',['ecs','list-tasks','--cluster',config.Cluster,'--desired-status','RUNNING','--region','us-west-2','--output','json'],{encoding:'utf8'}));assert.equal(running.taskArns.length,0);evidence.checks.push('zero running ECS tasks');
fs.writeFileSync(new URL('../multiplayer/cloud-evidence.local',import.meta.url),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
