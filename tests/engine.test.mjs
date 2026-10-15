import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const code = ts.transpileModule(fs.readFileSync(new URL('../src/engine.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2020 } }).outputText;
let seed = 12345;
Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const { Match, serverFor, winnerFor, flyBall, bounceBall, followSwing, SPIN, localPoint, blendRotation } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const neutral = {x:0,y:0};
assert.equal(winnerFor([11,9]),0); assert.equal(winnerFor([11,10]),null); assert.equal(winnerFor([12,14]),1);
assert.deepEqual([[0,0],[1,0],[2,0],[10,10],[11,10],[11,11]].map(serverFor),[0,0,1,0,1,0]);
const duplicate = new Match(); duplicate.phase='rally'; duplicate.point(0,'test'); duplicate.point(0,'late'); assert.deepEqual(duplicate.score,[1,0]);
for (const hand of ['left','right']) {
 const sign = hand === 'right' ? 1 : -1;
 const m = new Match(hand); m.start();
 for(let i=0;i<120;i++) m.step(1/120,neutral);
 assert.ok(Math.abs(m.paddles[0].x-sign*.55)<.001);
 for(let i=0;i<120;i++) m.step(1/120,{x:-sign,y:0});
 assert.equal(m.backhand,true);
 // Remain backhand within the body-center transition zone.
 for(let i=0;i<120;i++) m.step(1/120,{x:-sign*.55/2,y:0});
 assert.equal(m.backhand,true);
 for(let i=0;i<120;i++) m.step(1/120,neutral);
 assert.equal(m.backhand,false);
 const toss = new Match(hand); toss.start(); toss.serve();
 assert.equal(toss.phase,'toss'); assert.ok(toss.ball.vy>0); assert.equal(toss.ball.vz,0);
 const before={...toss.ball}; toss.serve(); assert.deepEqual(toss.ball,before);
 for(let i=0;i<240 && toss.phase==='toss';i++) toss.step(1/120,neutral);
 assert.equal(toss.phase,'point'); assert.deepEqual(toss.score,[0,1]);
 const strike = new Match(hand); strike.start(); strike.serve();
 for(let i=0;i<108;i++) strike.step(1/120,neutral);
 for(let i=0;i<30 && strike.phase==='toss';i++) strike.step(1/120,{x:0,y:.9});
 assert.equal(strike.phase,'rally',`${hand} serve should require and accept a mouse stroke`);
 assert.ok(strike.ball.vz<0); assert.equal(strike.serving,true);
 let aiReturned = false;
 for(let i=0;i<600 && strike.phase==='rally';i++) {strike.step(1/120,neutral); if(strike.last===1) aiReturned=true;}
 assert.ok(aiReturned,`${hand} struck serve should bounce legally and reach AI`);
}
for(const [offset,contact] of [[0,true],[.3,true],[.8,false]]) {
 const m=new Match(); m.phase='rally';m.last=1;m.bounces=1;
 Object.assign(m.ball,{x:.55+offset,y:1.9,z:2.89,vx:0,vy:0,vz:5});m.step(1/120,neutral);
 assert.equal(m.ball.vz<0,contact);
}
const movement=new Match();movement.start();
for(let i=0;i<1200;i++)movement.step(1/120,{x:0,y:0,moveX:1,moveZ:-1});
assert.equal(movement.body.x,1.9);assert.equal(movement.body.z,3.75);
for(let i=0;i<1200;i++)movement.step(1/120,{x:0,y:0,moveX:-1,moveZ:1});
assert.equal(movement.body.x,-1.9);assert.equal(movement.body.z,4.5);
const full=new Match();full.start();const servers=new Set();
for(let i=0;i<40000 && full.phase!=='over';i++){
 if(full.phase==='serve'){servers.add(full.server);if(full.server===0)full.serve();}
 full.step(1/120,neutral);
}
assert.equal(full.phase,'over');assert.equal(servers.size,2);assert.ok(winnerFor(full.score)!==null);
console.log('Passed: scoring/deuce, service rotation, duplicate points, mirrored handedness, backhand hysteresis, toss/no auto-hit, missed toss fault, both-handed legal service strikes/AI returns, passive paddle contacts, bounded movement, complete match.');

for(const hand of ['left','right']) {
 const m = new Match(hand);
 assert.equal(m.ball.x,m.paddles[0].x);
 assert.ok(m.ball.y-m.paddles[0].y>.5);
 m.start();
 for(let i=0;i<90;i++)m.step(1/120,{x:.3,y:.2,moveX:1,moveZ:1});
 assert.equal(m.ball.x,m.paddles[0].x);
 assert.equal(m.ball.y,m.paddles[0].y+.6);
 const held={...m.ball};m.serve();assert.equal(m.ball.x,held.x);assert.equal(m.ball.y,held.y);assert.equal(m.ball.z,held.z);assert.ok(m.ball.vy>0);
}
console.log('Passed: ready/serve ball follows paddle without overlap and toss starts at the held position.');

for (const hand of ['left', 'right']) {
 const m = new Match(hand); m.start();
 for(let i=0;i<120;i++)m.step(1/120,{x:-1,y:0});
 const left=m.paddles[0].x;
 for(let i=0;i<120;i++)m.step(1/120,{x:1,y:0});
 assert.ok(m.paddles[0].x-left>3.9,'Full horizontal sweep should span four world units');
}
console.log('Passed: expanded horizontal paddle reach for both hands.');

const flight = (wx = 0, wy = 0) => ({x:0,y:5,z:0,vx:0,vy:1,vz:-5,wx,wy,wz:0});
const flat=flight(), top=flight(-70), back=flight(70), left=flight(0,70), right=flight(0,-70);
for(let i=0;i<48;i++)for(const b of [flat,top,back,left,right])flyBall(b,1/120);
assert.ok(top.y<flat.y && back.y>flat.y,'Topspin dips and backspin floats');
assert.ok(left.x<0 && right.x>0,'Opposite sidespin curves in opposite directions');
assert.ok(Math.abs(top.wx)<70,'Airborne spin decays');
const topBounce={...flight(-70),y:1.58,vy:-4}, backBounce={...flight(70),y:1.58,vy:-4};
bounceBall(topBounce);bounceBall(backBounce);
assert.ok(Math.abs(topBounce.vz)>Math.abs(backBounce.vz),'Topspin kicks forward; backspin checks');
assert.ok(topBounce.vy<backBounce.vy,'Topspin produces a lower bounce');
for(const hand of ['left','right']) {
 const shot=new Match(hand);shot.ball.vz=-5;shot.brush={x:5,y:7};shot.applyBrush(0);
 assert.ok(shot.ball.wx<0 && shot.ball.wy<0,'Handedness must not invert the brush controls');
 const weak=new Match(hand);weak.brush={x:2,y:2};weak.applyBrush(0);
 assert.ok(Math.abs(shot.ball.wx)>Math.abs(weak.ball.wx),'Faster brushing produces more spin');
 shot.brush={x:1000,y:-1000};shot.applyBrush(0);
 assert.ok(Math.abs(shot.ball.wx)<=SPIN.max && Math.abs(shot.ball.wy)<=SPIN.max);
 shot.start();shot.holdBall();assert.equal(shot.ball.wx,0);assert.equal(shot.ball.wy,0);
}
const bodyOnly=new Match();bodyOnly.start();for(let i=0;i<60;i++)bodyOnly.step(1/120,{x:0,y:0,moveX:1});
assert.ok(Math.abs(bodyOnly.brush.x)<.001,'Keyboard movement alone must not create brush spin');
const sway={yaw:0,pitch:0,x:0,y:0};
followSwing(sway,1000,-1000,1/120,.65);
assert.ok(Math.abs(sway.yaw)<.028*.65,'Camera begins smoothly rather than snapping');
for(let i=0;i<500;i++)followSwing(sway,1000,-1000,1/120,.65);
assert.ok(Math.abs(sway.yaw)<=.028*.65 && Math.abs(sway.pitch)<=.018*.65 && Math.abs(sway.x)<=.045*.65 && Math.abs(sway.y)<=.02*.65,'Camera stays within comfort bounds');
for(let i=0;i<500;i++)followSwing(sway,0,0,1/120,.65);
assert.ok(Math.abs(sway.yaw)<1e-8 && Math.abs(sway.x)<1e-8,'Camera settles smoothly');
const off={yaw:0,pitch:0,x:0,y:0};followSwing(off,1000,1000,.1,0);assert.deepEqual(off,{yaw:0,pitch:0,x:0,y:0});
console.log('Passed: topspin/backspin flight and bounce, sidespin curvature, speed/handedness, spin limits/reset, body isolation, camera smoothing/limits/off.');

const half=Math.sin(Math.PI/8), real=Math.cos(Math.PI/8);
const turn=[0,half,0,real];
const inverse=[0,-half,0,real];
const v=localPoint(1,2,3,turn);const restored=localPoint(v.x,v.y,v.z,inverse);
assert.ok(Math.hypot(restored.x-1,restored.y-2,restored.z-3)<1e-9);
assert.ok(Math.abs(Math.hypot(...blendRotation([0,0,0,1],turn,.5))-1)<1e-9);
const rotated=new Match();rotated.phase='rally';rotated.last=1;rotated.bounces=1;
rotated.step(1/120,{x:0,y:0,phone:true,orientation:turn});
Object.assign(rotated.ball,{x:.75,y:1.9,z:2.52,vx:0,vy:0,vz:6});
for(let i=0;i<9 && rotated.last!==0;i++)rotated.step(1/120,{x:0,y:0,phone:true,orientation:turn});
assert.equal(rotated.last,0,'Tilted paddle should intercept on its rotated face');
assert.ok(rotated.ball.z<2.8,'Tilted contact must occur before the old flat collision plane');
const flatPhone=new Match();flatPhone.phase='rally';flatPhone.last=1;flatPhone.bounces=1;
Object.assign(flatPhone.ball,{x:.55,y:1.9,z:2.89,vx:0,vy:0,vz:5});flatPhone.step(1/120,{x:0,y:0,phone:true,orientation:[0,0,0,1]});assert.equal(flatPhone.last,0);
const heldPhone=new Match();heldPhone.start();heldPhone.step(1/120,{x:0,y:0,phone:true,orientation:turn});
const localHeld=localPoint(heldPhone.ball.x-heldPhone.paddles[0].x,heldPhone.ball.y-heldPhone.paddles[0].y,heldPhone.ball.z-heldPhone.paddles[0].z,turn);
assert.ok(Math.abs(localHeld.y-.6)<1e-9 && Math.abs(localHeld.z+.22)<1e-9,'Held ball clearance must rotate with the paddle');
console.log('Passed: quaternion transforms/interpolation, rotated and neutral paddle collisions, rotated held-ball clearance.');

const accelerationHand=new Match();accelerationHand.start();
for(let i=0;i<60;i++)accelerationHand.step(1/120,{x:0,y:0,phone:true,orientation:turn,swingOffset:[.3,.2,-.25]});
assert.ok(Math.abs(accelerationHand.paddles[0].x-.85)<1e-9);
assert.ok(Math.abs(accelerationHand.paddles[0].y-2.1)<1e-9);
assert.ok(Math.abs(accelerationHand.paddles[0].z-2.8)<1e-9);
assert.deepEqual(accelerationHand.paddleRotation,turn,'Linear swing must not change 1:1 orientation');
assert.equal(accelerationHand.body.x,0);assert.equal(accelerationHand.body.z,4.05);
console.log('Passed: acceleration offsets control all hand axes independently of face orientation and player body.');
