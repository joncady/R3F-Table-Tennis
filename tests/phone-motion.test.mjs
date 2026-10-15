import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const moduleUrl=name=>{let text=fs.readFileSync(new URL(`../src/${name}.ts`,import.meta.url),'utf8');if(name==='phoneMotion')text=text.replace("'./engine'",JSON.stringify(moduleUrl('engine')));return 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ES2020}}).outputText).toString('base64');};
const {PhoneMotionBuffer}=await import(moduleUrl('phoneMotion'));
const pose=(t,x,q=[0,0,0,1])=>({x:0,y:0,yaw:0,pitch:0,roll:0,swing:[x,0,0],q,sentAt:t,received:t+100});
const b=new PhoneMotionBuffer();
b.push(pose(0,0));b.push(pose(100,.1,[0,Math.SQRT1_2,0,Math.SQRT1_2]));
const middle=b.sample(178);
assert.ok(middle.swing[0]>0&&middle.swing[0]<.1);
assert.ok(Math.abs(Math.hypot(...middle.q)-1)<1e-9);
for(let t=200;t<400;t+=8)b.sample(t);
assert.ok(Math.abs(b.sample(400).swing[0]-.1)<.002);
// Endpoints remain 1:1; q and -q represent the same rotation.
const endpoint=new PhoneMotionBuffer();endpoint.push(pose(0,0));endpoint.push(pose(16,0,[0,0,0,-1]));
assert.ok(Math.abs(endpoint.sample(150).q[3])>.999);
// Sparse and bunched arrival must substantially reduce visible acceleration spikes.
const jitter=new PhoneMotionBuffer();let raw=0,rawPrev=0,smoothPrev=0,rawVelocity=0,smoothVelocity=0,rawJerk=0,smoothJerk=0,index=0,maxError=0;
const packets=Array.from({length:180},(_,i)=>{const t=i*16.667;return {...pose(t,.35*Math.sin(t/300)),received:100+t+([0,4,40,28,8,3][i%6])};}).sort((a,b)=>a.received-b.received);
for(let now=100;now<3000;now+=1000/120){
 while(index<packets.length&&packets[index].received<=now){const p=packets[index++];jitter.push(p);raw=p.swing[0];}
 const sample=jitter.sample(now);if(!sample)continue;
 const smooth=sample.swing[0],rv=(raw-rawPrev)*120,sv=(smooth-smoothPrev)*120;
 rawJerk+=Math.abs(rv-rawVelocity);smoothJerk+=Math.abs(sv-smoothVelocity);
 maxError=Math.max(maxError,Math.abs(smooth-.35*Math.sin((now-100)/300)));
 rawPrev=raw;smoothPrev=smooth;rawVelocity=rv;smoothVelocity=sv;
}
assert.ok(smoothJerk<rawJerk*.65,`${smoothJerk} vs ${rawJerk}`);
assert.ok(maxError<.13,'Smoothing must not add excessive trajectory lag');
const frozen=jitter.sample(3300).swing.slice();assert.deepEqual(jitter.sample(6000).swing,frozen);
assert.ok(jitter.delay>=28&&jitter.delay<=80);
const before=jitter.sample(6000).swing.slice();jitter.push({...pose(0,100),received:6100});assert.deepEqual(jitter.sample(6001).swing,before,'Out-of-order source time is rejected');
jitter.reset();assert.equal(jitter.sample(7000),null);
jitter.push({...pose(0,0),x:NaN});assert.equal(jitter.sample(7000),null);
console.log(`Passed: source-clock interpolation, normalized shortest-arc rotation, 1:1 endpoints, stale hold/reset, invalid/out-of-order samples; synthetic jitter acceleration spikes reduced ${(100*(1-smoothJerk/rawJerk)).toFixed(0)}%, max path error ${(maxError*100).toFixed(1)} cm before reach gain.`);
