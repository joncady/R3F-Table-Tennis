import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2020}}).outputText;
const {Match,NET,collideNet}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const neutral={x:0,y:0};
function trajectory({server=0,y=1.88,x=0,vx=0,serving=true,bounces=1,vz=4}={}){const m=new Match();m.multiplayer=true;m.phase='rally';m.server=server;m.last=server;m.serving=serving;m.bounces=bounces;const sign=server===0?1:-1;Object.assign(m.ball,{x,y,z:.15*sign,vx,vy:0,vz:-vz*sign,wx:0,wy:0,wz:0});return m;}
function finish(m){for(let i=0;i<1200&&m.phase==='rally';i++)m.step(1/120,neutral,neutral);return m;}
for(const server of [0,1]){
 const letBall=finish(trajectory({server}));assert.equal(letBall.phase,'serve');assert.deepEqual(letBall.score,[0,0]);assert.equal(letBall.server,server);assert.match(letBall.message,/let/);assert.equal(letBall.net,false);assert.equal(letBall.bounces,0);assert.equal(letBall.serving,false);assert.equal(letBall.netMotion.sequence,1);
 const blocked=finish(trajectory({server,y:1.65}));assert.equal(blocked.phase,'point');assert.equal(blocked.score[1-server],1);assert.doesNotMatch(blocked.message,/let/);
 const fallingBack=finish(trajectory({server,y:1.84}));assert.equal(fallingBack.score[1-server],1);assert.equal(fallingBack.netMotion.sequence,1);
 const out=finish(trajectory({server,x:1.5,vx:4}));assert.equal(out.score[1-server],1,'Net touch that lands out is a fault');assert.equal(out.netMotion.sequence,1);
 const early=finish(trajectory({server,bounces:0}));assert.equal(early.score[1-server],1,'Net before server-side bounce is not a let');
 const rally=trajectory({server,serving:false,bounces:0});for(let i=0;i<180&&rally.bounces===0&&rally.phase==='rally';i++)rally.step(1/120,neutral,neutral);assert.equal(rally.phase,'rally');assert.equal(rally.bounces,1);assert.deepEqual(rally.score,[0,0]);assert.equal(rally.netMotion.sequence,1);
 const obstruction=trajectory({server});obstruction.net=true;obstruction.ball.z=server===0?-.2:.2;obstruction.hit(1-server);assert.equal(obstruction.phase,'serve','Receiver obstruction of net service is a let');
 const noNet=trajectory({server,y:2.1});for(let i=0;i<5;i++)noNet.step(1/120,neutral,neutral);assert.equal(noNet.netMotion.sequence,0,'Clear ball does not shake the net');
}
// Swept detection at high speed and positive/negative court directions. A net
// collision dissipates energy; it never invents an upward kick of fixed size.
for(const direction of [-1,1])for(const y of [NET.top-.15,NET.top+.055,NET.top+.08]){
 const old={x:0,y,z:-direction*.3},b={...old,z:direction*.3,vx:1,vy:0,vz:direction*72,wx:30,wy:5,wz:0};const before=Math.hypot(b.vx,b.vy,b.vz);const hit=collideNet(b,old,1/120);assert.ok(hit);assert.ok(Math.hypot(b.vx,b.vy,b.vz)<=before);assert.equal(hit.kind,y<NET.top?'mesh':'cord');assert.ok(Object.values(b).every(Number.isFinite));
}
console.log('Passed: both-server legal lets, blocked/falling-back/out/early faults, live rally net cords, receiver obstruction, clear shots, high-speed swept contacts and bounded energy.');
