import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createMatchServer,sanitizeInput} from '../multiplayer/server.mjs';
import {Match} from '../multiplayer/engine.mjs';
import {phonePage} from './phone-page-harness.mjs';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/practicePlayer.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2020}}).outputText.replace("'./engine'",JSON.stringify(new URL('../multiplayer/engine.mjs',import.meta.url).href));
const {PracticePlayer}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// Court inversion preserves every relevant field, including spin and handedness.
const symmetry=new Match('left');symmetry.multiplayer=true;symmetry.far.handedness='right';
const before=JSON.stringify(symmetry);symmetry.mirror();symmetry.mirror();assert.equal(JSON.stringify(symmetry),before);
for(const side of [0,1])for(const phone of [false,true]){
 const m=new Match('left');m.multiplayer=true;m.start();m.server=side;m.serve();assert.equal(m.phase,'toss');
 assert.equal(Math.sign(m.ball.z),side===0?1:-1);
 for(let n=0;n<240&&m.phase==='toss';n++){
  const input={x:0,y:n>108?.9:0,...(phone?{phone:true,orientation:[0,0,0,1],swingOffset:[0,n>108?.72:0,0]}:{})};
  m.step(1/120,side===0?input:{x:0,y:0},side===1?input:{x:0,y:0});
 }
 assert.equal(m.phase,'rally',`seat ${side} ${phone?'phone':'mouse'} legal service`);
 assert.equal(m.last,side);assert.ok(side===0?m.ball.vz<0:m.ball.vz>0);
}
const duel=new Match('left');duel.multiplayer=true;duel.start();const bots=[new PracticePlayer(.5,.1),new PracticePlayer(0,0)];
let serveSides=new Set(),contacts=[0,0];
for(let n=0;n<120*1800&&duel.phase!=='over';n++){
 const a=bots[0].input(duel,1/120);duel.mirror();let b=bots[1].input(duel,1/120);duel.mirror();
 if(duel.phase==='rally'&&n%(120*20)>120*16)b={x:1,y:-1};
 if(duel.phase==='toss')serveSides.add(duel.server);
 duel.step(1/120,a,b);contacts=duel.impacts;
}
assert.equal(duel.phase,'over');assert.ok(duel.score.some(n=>n>=11));assert.ok(serveSides.has(0)&&serveSides.has(1));assert.ok(contacts.every(n=>n>0));
console.log(`Passed: symmetric court, legal mouse/phone service at both ends, full human-vs-human simulation to ${duel.score}, contacts ${contacts}.`);
assert.deepEqual(sanitizeInput({x:Infinity,y:NaN,orientation:[1,2,3,4]}),{x:0,y:0,moveX:0,moveZ:0});
const room={id:'test',seats:[{display:'d0',phone:'p0'},{display:'d1',phone:'p1'}]};
let stopped=false;const game=createMatchServer({room,port:0,idleMs:180,waitingMs:10000,onStop:()=>{stopped=true;}});
await once(game.server,'listening');const endpoint=`ws://127.0.0.1:${game.server.address().port}`;
const connect=async(role,token)=>{const ws=new WebSocket(`${endpoint}?role=${role}&token=${token}`);await once(ws,'open');return ws;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const rejected=new WebSocket(`${endpoint}?role=display&token=invalid`);const [closeCode]=await once(rejected,'close');assert.equal(closeCode,1008);
const a=await connect('display','d0'),b=await connect('display','d1'),p=await connect('phone','p1');
const send=(ws,m)=>ws.send(JSON.stringify(m));
let snapshot,otherSnapshot,impact=false; b.on('message',v=>{const m=JSON.parse(v);if(m.type==='snapshot')otherSnapshot=m;});a.on('message',v=>{const m=JSON.parse(v);if(m.type==='snapshot')snapshot=m;});p.on('message',v=>{if(JSON.parse(v).type==='impact')impact=true;});
const feed=setInterval(()=>{send(a,{type:'input',x:.4,y:.2});send(b,{type:'input',x:0,y:0});send(p,{type:'motion',seq:Date.now(),q:[0,0,0,1],swing:[.3,.1,0]});},16);
await wait(50);send(a,{type:'ready'});send(b,{type:'ready'});await wait(120);
assert.equal(game.snapshot().paused,false);assert.equal(game.seats[1].mode,'phone');assert.ok(game.match.paddles[0].x>0);assert.ok(game.match.paddles[1].x<-.55);
send(a,{type:'toss'});await wait(50);assert.equal(game.match.phase,'toss');
send(p,{type:'pause'});await wait(50);assert.equal(game.snapshot().paused,true);
send(a,{type:'ready'});send(p,{type:'pause'});await wait(50);assert.equal(game.snapshot().paused,false);
// Impact routing to the striking seat only; no phone can inject points or a ball.
game.match.impacts[1]++;await wait(35);assert.ok(impact);const score=[...game.match.score];send(p,{type:'score',score:[11,0]});await wait(25);assert.deepEqual(game.match.score,score);
// Both displays receive the same authoritative net contact (renderers mirror it).
const beforeNet=game.match.netMotion.sequence;
Object.assign(game.match,{phase:'rally',last:0,server:0,bounces:1,serving:true});Object.assign(game.match.ball,{x:.2,y:1.88,z:.15,vx:0,vy:0,vz:-4,wx:0,wy:0,wz:0});
await wait(120);assert.equal(game.match.netMotion.sequence,beforeNet+1);assert.equal(snapshot.netMotion.sequence,beforeNet+1);assert.equal(otherSnapshot.netMotion.sequence,beforeNet+1);assert.equal(snapshot.netMotion.x,otherSnapshot.netMotion.x);assert.equal(snapshot.netMotion.direction,otherSnapshot.netMotion.direction);
assert.ok(snapshot.sequence>1);assert.equal(typeof snapshot.netMotion.sequence,'number');assert.equal(typeof snapshot.netMotion.age,'number');p.close();await wait(50);assert.equal(game.snapshot().paused,true);
clearInterval(feed);
for(const kind of ['ios','android']){
 const page=await phonePage({endpoint,room:room.id,token:'p1',kind});page.orientation({alpha:0,beta:0,gamma:0});await wait(40);page.orientation({alpha:0,beta:15,gamma:0});await wait(40);assert.ok(Math.abs(game.seats[1].input.orientation[0])>.05);
 game.match.impacts[1]++;await wait(40);assert.ok(page.flashes>0);assert.match(page.element('device').textContent,kind==='ios'?/iPhone/:/Android/);page.command('pause');page.close();await wait(30);
}
const phones=await Promise.all([connect('phone','p0'),connect('phone','p1')]);
const dualFeed=setInterval(()=>{send(a,{type:'input',x:0,y:0});send(b,{type:'input',x:0,y:0});phones.forEach((ws,i)=>send(ws,{type:'motion',seq:Date.now(),q:[0,0,0,1],swing:[i===0?-.2:.2,0,0]}));},16);
await wait(40);send(a,{type:'ready'});send(b,{type:'ready'});await wait(100);assert.equal(game.snapshot().paused,false);assert.ok(game.seats.every(s=>s.mode==='phone'));assert.ok(game.seats[0].input.swingOffset[0]<0&&game.seats[1].input.swingOffset[0]>0);
clearInterval(dualFeed);phones.forEach(ws=>ws.close());await wait(40);assert.equal(game.snapshot().paused,true);
send(a,{type:'mode',mode:'mouse'});send(b,{type:'mode',mode:'mouse'});await wait(30);assert.ok(game.seats.every(s=>s.mode==='mouse'));
a.close();b.close();await wait(350);assert.ok(stopped);assert.equal(game.server.listening,false);
console.log('Passed: real WebSocket mouse/mouse, mouse/phone, phone/phone sessions, iPhone/Android page sensor events, normalized motion, seat isolation, ready/pause/toss, snapshots, impact routing, disconnect pause, automatic empty-server shutdown.');
