import {SwingTracker,rotateVector,multiplyRotation,accelerationInNeutral,mappedRotation} from './swing.mjs';
import {SwingTracker as Baseline} from '../tests/fixtures/swing-baseline.mjs';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const bias=[.07,-.04,.025];
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const inverse=q=>[-q[0],-q[1],-q[2],q[3]];
const axis=(v,angle)=>[...scale(v,Math.sin(angle/2)),Math.cos(angle/2)];
// Analytic minimum-jerk hand paths: p, dp/dt, d²p/dt² are known independently.
function segment(t,start,end,duration,curve=[0,0,0]){
 const u=Math.max(0,Math.min(1,t/duration));
 const f=10*u**3-15*u**4+6*u**5;
 const v=(30*u**2-60*u**3+30*u**4)/duration;
 const a=(60*u-180*u**2+120*u**3)/duration**2;
 const delta=end.map((n,i)=>n-start[i]);
 const moving=Math.hypot(...delta)>0;
 const bow=moving?curve:[0,0,0];
 return {p:add(add(start,scale(delta,f)),scale(bow,Math.sin(Math.PI*f))),v:add(scale(delta,v),scale(bow,Math.PI*Math.cos(Math.PI*f)*v)),a:add(scale(delta,a),scale(bow,Math.PI*Math.cos(Math.PI*f)*a-Math.PI**2*Math.sin(Math.PI*f)*v*v))};
}
function path(t,config){
 const zero=[0,0,0];t-=1;
 if(t<0)return {p:zero,v:zero,a:zero};
 const phases=config.continuous?[[config.sweep,config.duration],[scale(config.sweep,-1),config.duration*2],[zero,config.duration]]:[[config.sweep,config.duration],[config.sweep,.25],[scale(config.sweep,-1),config.duration*2],[scale(config.sweep,-1),.25],[zero,config.duration]];
 let previous=zero;
 for(const [next,duration]of phases){if(t<duration)return segment(t,previous,next,duration,config.curve);t-=duration;previous=next;}
 return {p:zero,v:zero,a:zero};
}
export const configs=[
 {id:'left-handed-lateral',sweep:[-.25,0,0],duration:.45},
 {id:'slow-lateral',sweep:[-.25,0,0],duration:1},
 {id:'fast-forehand',sweep:[-.30,.10,-.15],duration:.3},
 {id:'backhand-reversal',sweep:[.22,.08,-.12],duration:.4},
 {id:'continuous-rally',sweep:[-.28,.07,-.1],duration:.55,continuous:true},
 {id:'rotation-only',sweep:[0,0,0],duration:.5,rotate:true},
 {id:'noisy-wrist-only',sweep:[0,0,0],duration:.5,rotate:true,noise:.2},
 {id:'natural-grip',sweep:[-.25,.09,-.14],duration:.45,rotate:true,grip:true},
 {id:'noisy-60hz',sweep:[-.25,.07,-.12],duration:.45,rotate:true,noise:.12},
 {id:'irregular-30hz',sweep:[-.25,0,-.1],duration:.6,rotate:true,noise:.06,hz:30,jitter:true},
 {id:'gravity-fallback',sweep:[-.25,.09,-.12],duration:.45,rotate:true,grip:true,fallback:true},
 {id:'tilt-error',sweep:[-.25,.09,-.12],duration:.45,rotate:true,noise:.06,tiltError:.008},
 {id:'curved-forehand',sweep:[-.28,.10,-.16],curve:[0,.05,-.08],duration:.45,rotate:true,grip:true,noise:.04},
 {id:'curved-backhand',sweep:[.23,.12,-.13],curve:[0,.07,-.05],duration:.4,rotate:true,noise:.04},
];
export function simulate(config,Tracker=SwingTracker){
 const tracker=new Tracker(),rows=[];
 let t=0,seed=config.seed||1001,previousQ=[0,0,0,1];
 const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
 const basis=config.grip?axis([0,0,1],.95):[0,0,0,1];
 const neutral=multiplyRotation(axis([1,0,0],Math.PI/2),basis);
 while(t<7){
  const dt=(1/(config.hz||60))*(config.jitter?.7+random()*.6:1);t+=dt;
  const truth=path(t,config),theta=config.rotate&&t>1?.65*Math.sin((t-1)*4):0;
  const q=multiplyRotation(axis([0,1,0],theta),axis([1,0,0],theta*.35));
  // Move a virtual device through space; express acceleration in its local axes.
  const neutralAcceleration=rotateVector(truth.a,inverse(basis));
  let local=rotateVector(neutralAcceleration,inverse(q));
  if(config.fallback){const g=rotateVector([0,9.80665,0],inverse(basis));local=add(local,rotateVector(g,inverse(q)));}
  // Sensor-frame noise, then the same orientation/grip transforms as the phone.
  local=local.map(n=>n+(config.noise||0)*(random()+random()+random()-1.5));
  let reconstructed=accelerationInNeutral(config.fallback?null:local,config.fallback?local:null,q,neutral);
  reconstructed=add(rotateVector(reconstructed,basis),bias);
  if(config.tiltError)reconstructed[0]+=9.80665*config.tiltError*Math.sin(t*2);
  const angular=2*Math.acos(Math.min(1,Math.abs(q.reduce((sum,v,i)=>sum+v*previousQ[i],0))))/dt;previousQ=q;
  const estimate=tracker.update(reconstructed,dt,angular);
  rows.push({t,p:truth.p,estimate,q:mappedRotation(q,basis),a:reconstructed,velocity:truth.v});
 }
 const active=rows.filter(r=>r.t>=1&&r.t<=1+config.duration*4+.5);
 const rms=Math.sqrt(active.reduce((s,r)=>s+r.p.reduce((v,n,i)=>v+(r.estimate[i]-n)**2,0),0)/active.length);
 const peak=axis=>Math.max(...active.map(r=>r.p[axis]))-Math.min(...active.map(r=>r.p[axis]));
 const estimated=axis=>Math.max(...active.map(r=>r.estimate[axis]))-Math.min(...active.map(r=>r.estimate[axis]));
 const span=Math.hypot(...[0,1,2].map(peak)),trackedSpan=Math.hypot(...[0,1,2].map(estimated));
 return {id:config.id,rmsCm:rms*100,spanCm:span*100,trackedSpanCm:trackedSpan*100,restErrorCm:Math.hypot(...rows.at(-1).estimate)*100,rows};
}
export const validationCases=Array.from({length:16},(_,i)=>({id:`validation-${i+1}`,sweep:[(i%2?-1:1)*(.12+(i%4)*.055),.03+(i%3)*.035,-.03-(i%5)*.025],duration:.32+(i%6)*.13,hz:[24,40,90,120][i%4],noise:.03+(i%3)*.025,jitter:true,rotate:i%2===0,grip:i%3===0,continuous:i%4===0,seed:5000+i}));
export function trials(){return configs.map(config=>({config,baseline:simulate(config,Baseline),tuned:simulate(config)}));}
export function validation(){return validationCases.map(config=>({config,baseline:simulate(config,Baseline),tuned:simulate(config)}));}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const results=trials();
 console.table(results.map(r=>({trial:r.config.id,baselineRmsCm:r.baseline.rmsCm.toFixed(2),tunedRmsCm:r.tuned.rmsCm.toFixed(2),actualSpan:r.tuned.spanCm.toFixed(1),baselineSpan:r.baseline.trackedSpanCm.toFixed(1),tunedSpan:r.tuned.trackedSpanCm.toFixed(1)})));
 const output=new URL('../public/synthetic-trials.json',import.meta.url);fs.writeFileSync(output,JSON.stringify({synthetic:true,results,validation:validation().map(r=>({id:r.config.id,baselineRmsCm:r.baseline.rmsCm,tunedRmsCm:r.tuned.rmsCm}))}));
}
