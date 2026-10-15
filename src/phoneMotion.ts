import {blendRotation, Rotation} from './engine';
export interface PhonePose {x:number;y:number;yaw:number;pitch:number;roll:number;received:number;sentAt?:number;swing?:[number,number,number];q?:Rotation}
type Sample = PhonePose & {time:number};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
// Source-clock interpolation absorbs packet bunching without integrating fictitious hand travel.
// No angular extrapolation: a lost packet must never invent a wrist turn.
export class PhoneMotionBuffer {
 private samples:Sample[]=[];
 private offset=Infinity;
 private jitter=0;
 private output:PhonePose|null=null;
 private lastFrame=0;
 get delay(){return clamp(28+this.jitter*1.5,28,80);}
 reset(){this.samples=[];this.offset=Infinity;this.jitter=0;this.output=null;this.lastFrame=0;}
 push(pose:PhonePose){
  if(![pose.x,pose.y,pose.yaw,pose.pitch,pose.roll,pose.received].every(Number.isFinite))return;
  if(pose.q&&(!pose.q.every(Number.isFinite)||Math.hypot(...pose.q)<.5))return;
  if(pose.swing&&!pose.swing.every(Number.isFinite))return;
  const time=Number.isFinite(pose.sentAt)?pose.sentAt!:pose.received;
  const previous=this.samples[this.samples.length-1];
  if(previous&&time<=previous.time)return;
  if(previous&&pose.received-previous.received>1000)this.reset();
  const last=this.samples[this.samples.length-1];
  if(last)this.jitter+=(Math.min(120,Math.abs((pose.received-last.received)-(time-last.time)))-this.jitter)*.12;
  this.offset=Math.min(this.offset,pose.received-time);
  this.samples.push({...pose,time});
  if(this.samples.length>48)this.samples.shift();
 }
 sample(now:number):PhonePose|null{
  const last=this.samples[this.samples.length-1];if(!last)return null;
  const target=now-this.offset-this.delay;
  let a=this.samples[0],b=a;
  for(const row of this.samples){if(row.time<=target)a=row;if(row.time>=target){b=row;break;}b=row;}
  // A stall holds the last displayed pose, instead of snapping back to neutral.
  if(now-last.received>120&&this.output){this.output.received=last.received;this.lastFrame=now;return this.output;}
  const t=a===b?0:clamp((target-a.time)/(b.time-a.time),0,1);
  const mix=(x:number,y:number)=>x+(y-x)*t;
  const desired:PhonePose={...last,x:mix(a.x,b.x),y:mix(a.y,b.y),yaw:mix(a.yaw,b.yaw),pitch:mix(a.pitch,b.pitch),roll:mix(a.roll,b.roll),q:a.q&&b.q?blendRotation(a.q,b.q,t):last.q,swing:a.swing&&b.swing?a.swing.map((v,i)=>mix(v,b.swing![i])) as [number,number,number]:last.swing};
  // Only bridge one missing frame. At most 3 cm estimated travel per axis.
  const prev=this.samples[this.samples.length-2],ahead=clamp(target-last.time,0,25);
  if(target>last.time&&prev&&last.time-prev.time<100&&now-last.received<80){
   const predict=(value:number,old:number)=>value+clamp((value-old)/(last.time-prev.time)*ahead,-.03,.03);
   if(last.swing&&prev.swing)desired.swing=last.swing.map((v,i)=>predict(v,prev.swing![i])) as [number,number,number];
  }
  if(!this.output||now-this.lastFrame>500)this.output=desired;
  else {
   const alpha=1-Math.exp(-clamp(now-this.lastFrame,0,50)/12);
   const out=this.output;
   for(const key of ['x','y','yaw','pitch','roll'] as const)out[key]+=(desired[key]-out[key])*alpha;
   if(out.q&&desired.q)out.q=blendRotation(out.q,desired.q,alpha);else out.q=desired.q;
   if(out.swing&&desired.swing)out.swing=out.swing.map((v,i)=>v+(desired.swing![i]-v)*alpha) as [number,number,number];else out.swing=desired.swing;
   out.received=last.received;
  }
  this.lastFrame=now;return this.output;
 }
}
