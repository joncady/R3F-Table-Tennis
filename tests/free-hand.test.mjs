import ts from 'typescript';import fs from 'node:fs';import assert from 'node:assert/strict';
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(new URL('../src/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2020}}).outputText).toString('base64'));
const {readFreeHand,readTossHand,TossGesture}=await load('freeHand'),{Match}=await load('engine');
const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1}));pose[15].x=.3;pose[16].x=.6;
const hand=open=>{const h=Array.from({length:21},()=>({x:.6,y:.46,z:0}));h[0].y=.5;for(const i of [8,12,16,20])h[i].y=open?.40:.48;return h;};
const closed=readFreeHand([hand(false)],pose,'left'),open=readFreeHand([hand(true)],pose,'left');assert.ok(closed.closed);assert.ok(open.open);assert.equal(readFreeHand([hand(true)],pose,'right'),null);assert.equal(readFreeHand([],pose,'left'),null);
// A straight finger can have a tip/PIP wrist-distance ratio below the old 1.55 threshold.
const natural=hand(true);for(const tip of [8,12,16,20]){natural[tip-3]={x:.6,y:.46,z:0};natural[tip-2]={x:.6,y:.42,z:0};natural[tip-1]={x:.6,y:.40,z:0};natural[tip]={x:.6,y:.38,z:0};}
assert.ok(readFreeHand([natural],pose,'left').open,'straight fingers with 1.5 distance ratio must count as open');
const bent=hand(false);for(const tip of [8,12,16,20]){bent[tip-3]={x:.6,y:.46,z:0};bent[tip-2]={x:.6,y:.42,z:0};bent[tip-1]={x:.62,y:.44,z:0};bent[tip]={x:.6,y:.48,z:0};}assert.ok(readFreeHand([bent],pose,'left').closed);assert.equal(readFreeHand([bent],pose,'left').open,false);
const world=Array.from({length:21},()=>({x:0,y:0,z:0}));world[5]={x:.03,y:0,z:.05};world[17]={x:-.03,y:0,z:.05};
assert.equal(readFreeHand([hand(true)],pose,'left',[world]).palmFlat,true);
const down=world.map(p=>({...p,z:-p.z}));assert.equal(readFreeHand([hand(true)],pose,'left',[down]).palmFlat,true);
const leftHand=hand(true).map(p=>({...p,x:p.x-.3}));const mirrored=world.map(p=>({...p,x:-p.x}));assert.equal(readFreeHand([leftHand],pose,'right',[mirrored]).palmFlat,true);
pose[11].x=.4;pose[12].x=.6;
const wristOnly=readTossHand([],pose,'left');assert.equal(wristOnly.source,'wrist');assert.equal(wristOnly.probablyOpen,true);
const detailed=readTossHand([hand(true)],pose,'left',[world]);assert.equal(detailed.motionY,wristOnly.motionY,'switching wrist/finger visibility must not invent movement');assert.equal(detailed.motionX,wristOnly.motionX);
assert.equal(readTossHand([hand(false)],pose,'left').probablyOpen,false);
const sample=(y=0,x=0)=>({...open,palmFlat:true,motionY:y,motionX:x});
const gesture=new TossGesture();for(const time of [0,66,132,198,264])assert.equal(gesture.update(sample(),time,true),false);assert.ok(gesture.armed);
let released=false;for(const [t,y]of [[330,.04],[396,.11],[462,.2]])released=gesture.update(sample(y),t,true)||released;assert.ok(released,'open palm upward acceleration releases without closing fingers');assert.ok(gesture.launchSpeed>=3&&gesture.launchSpeed<=6);assert.equal(gesture.update(sample(.3),528,true),false);
const loss=new TossGesture();for(const time of [0,100,200,300])loss.update(sample(),time,true);loss.update(null,400,true);assert.equal(loss.armed,false);assert.equal(loss.update(sample(.2),500,true),false);loss.update(sample(),600,false);assert.equal(loss.armed,false);
for(const mode of ['stationary-noise','sideways','slow-lift','edge-on-palm','body-translation']){const g=new TossGesture();let fire=false;for(let i=0;i<35;i++){const t=i*66;let p=sample();if(mode==='stationary-noise')p=sample(Math.sin(i)*.006,Math.cos(i)*.004);if(i>6&&mode==='sideways')p=sample(0,(i-6)*.035);if(i>6&&mode==='slow-lift')p=sample((i-6)*.004);if(mode==='edge-on-palm')p={...p,palmFlat:false};if(mode==='body-translation')p={...p,y:p.y+i*.02,motionY:0};fire=g.update(p,t,true)||fire;}assert.equal(fire,false,mode+' must not toss');}
for(const step of [66,100,125]){const g=new TossGesture();let time=0;for(let i=0;i<6;i++)g.update(sample(),time+=step,true);let fire=false;for(let i=1;i<=4;i++)fire=g.update(sample(.045*i*i),time+=step,true)||fire;assert.ok(fire,'toss at '+Math.round(1000/step)+' Hz');}
for(const kind of ['wrist','probably-open','tilted-palm']){const g=new TossGesture();let fire=false;for(const [time,y]of [[0,0],[66,.035],[132,.09],[198,.15]]){const p={...sample(y),source:kind==='wrist'?'wrist':'hand',open:false,palmFlat:false,probablyOpen:true};fire=g.update(p,time,true)||fire;}assert.ok(fire,kind+' must toss without a stationary pose');}
const fist=new TossGesture();for(let i=0;i<5;i++)assert.equal(fist.update({...sample(i*.1),probablyOpen:false},i*66,true),false);
const game=new Match('left');game.start();game.step(1/120,{x:0,y:0,heldHand:{x:.5,y:2.2,z:3.05}});assert.equal(game.ball.x,.5);assert.equal(game.ball.y,2.2);game.serve();assert.equal(game.phase,'toss');assert.equal(game.ball.vy,4.4);game.step(1/120,{x:0,y:0,heldHand:{x:-.5,y:1.5,z:3.05}});assert.ok(game.ball.x>0,'released ball no longer follows hand');
console.log('Passed: opposite-hand association, open/closed fingers, wrist-only/probably-open/tilted-hand release without waiting, source-switch stability, upward movement, 8–15 Hz release, noise/lateral/slow/body-motion rejection, dropout disarm, disabled/rally safety, free-hand held ball and independent toss physics.');
