import type {Landmark} from './poseTracking';
export interface FreeHandSample {x:number;y:number;open:boolean;closed:boolean;extended?:number;probablyOpen?:boolean;source?:'hand'|'wrist';palmFlat?:boolean;motionX?:number;motionY?:number;points:Landmark[]}
const distance=(a:Landmark,b:Landmark)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function readFreeHand(hands:Landmark[][],pose:Landmark[],playingHand:'left'|'right',worldHands:Landmark[][]=[]):FreeHandSample|null {
 const wrist=pose[playingHand==='left'?16:15];if(!wrist||(wrist.visibility??0)<.65)return null;
 const other=pose[playingHand==='left'?15:16];
 const candidates=hands.filter(h=>h.length===21&&h.every(p=>[p.x,p.y,p.z].every(Number.isFinite))).map(h=>({h,d:Math.hypot(h[0].x-wrist.x,h[0].y-wrist.y)})).sort((a,b)=>a.d-b.d);
 const selected=candidates[0];if(!selected||selected.d>.12)return null;
 const h=selected.h;if(other&&Math.hypot(h[0].x-other.x,h[0].y-other.y)<selected.d*.8)return null;
 const scale=distance(h[0],h[9]);if(scale<.008)return null;
 const fingers=[8,12,16,20].map(tip=>{
  const mcp=h[tip-3],pip=h[tip-2],dip=h[tip-1],end=h[tip];
  const a=[mcp.x-pip.x,mcp.y-pip.y,mcp.z-pip.z],b=[dip.x-pip.x,dip.y-pip.y,dip.z-pip.z];
  const magnitude=Math.hypot(...a)*Math.hypot(...b);
  const angle=magnitude>1e-8?Math.acos(Math.max(-1,Math.min(1,a.reduce((v,n,i)=>v+n*b[i],0)/magnitude)))*180/Math.PI:null;
  const ratio=distance(end,h[0])/Math.max(.0001,distance(pip,h[0]));
  return {open:angle!==null?angle>=150&&ratio>1.08:ratio>1.4,closed:angle!==null?angle<125||ratio<1.02:ratio<1.2};
 });
 const world=worldHands[hands.indexOf(h)],geometry=world?.length===21?world:h;
 const a=[geometry[5].x-geometry[0].x,geometry[5].y-geometry[0].y,geometry[5].z-geometry[0].z],b=[geometry[17].x-geometry[0].x,geometry[17].y-geometry[0].y,geometry[17].z-geometry[0].z];
 const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...normal);
 const palmFlat=length>1e-8&&(Math.abs(normal[1])/length)>.3;
 const x=(h[0].x+h[5].x+h[9].x+h[17].x)/4,y=(h[0].y+h[5].y+h[9].y+h[17].y)/4;
 const shoulders=pose[11]&&pose[12]&&(pose[11].visibility??0)>.65&&(pose[12].visibility??0)>.65;
 const shoulderWidth=shoulders?Math.abs(pose[11].x-pose[12].x):0;
 const motionX=shoulderWidth>.035?(x-(pose[11].x+pose[12].x)/2)/shoulderWidth:undefined;
 const motionY=shoulderWidth>.035?((pose[11].y+pose[12].y)/2-y)/shoulderWidth:undefined;
 const extended=fingers.filter(f=>f.open).length;
 return {x,y,palmFlat,motionX,motionY,open:extended>=3,closed:fingers.filter(f=>f.closed).length>=3,extended,points:h};
}
// Use the same pose wrist for motion whether fingers are visible or not.
// Switching between a palm center and a wrist would manufacture an upward jump.
export function readTossHand(hands:Landmark[][],pose:Landmark[],playingHand:'left'|'right',world:Landmark[][]=[]):FreeHandSample|null {
 const wrist=pose[playingHand==='left'?16:15],left=pose[11],right=pose[12];
 if(!wrist||!left||!right||[wrist,left,right].some(p=>(p.visibility??0)<.6||![p.x,p.y].every(Number.isFinite)))return null;
 const span=Math.abs(left.x-right.x);if(span<.035)return null;
 const detail=readFreeHand(hands,pose,playingHand,world);
 return {x:wrist.x,y:wrist.y,open:detail?.open??false,closed:detail?.closed??false,points:detail?.points??[],extended:detail?.extended,source:detail?'hand':'wrist',probablyOpen:!detail||detail.open||(detail.extended??0)>=1||!detail.closed,motionX:(wrist.x-(left.x+right.x)/2)/span,motionY:((left.y+right.y)/2-wrist.y)/span};
}
export class TossGesture {
 lastSeen=-Infinity;armed=false;cooldownUntil=0;
 history:{t:number;x:number;y:number}[]=[];velocity=0;acceleration=0;launchSpeed=4.4;
 reset(){this.armed=false;this.lastSeen=-Infinity;this.history=[];this.velocity=0;this.acceleration=0;}
 update(sample:FreeHandSample|null,now:number,enabled:boolean){
  if(!enabled||!sample||sample.probablyOpen===false||!Number.isFinite(sample.motionX)||!Number.isFinite(sample.motionY)){this.reset();return false;}
  if(now<=this.lastSeen)return false;
  if(now-this.lastSeen>250)this.reset();
  const dt=(now-this.lastSeen)/1000;this.lastSeen=now;
  if(now<this.cooldownUntil)return false;
  const current={t:now/1000,x:sample.motionX!,y:sample.motionY!};this.history.push(current);this.history=this.history.filter(p=>current.t-p.t<=.3);
  if(this.history.length<3||current.t-this.history[0].t<.08)return false;
  this.armed=true;
  const mean=this.history.reduce((s,p)=>s+p.t,0)/this.history.length,ym=this.history.reduce((s,p)=>s+p.y,0)/this.history.length;
  const denominator=this.history.reduce((s,p)=>s+(p.t-mean)**2,0);
  const speed=denominator>1e-6?this.history.reduce((s,p)=>s+(p.t-mean)*(p.y-ym),0)/denominator:0;
  const previous=this.velocity;this.velocity+=(speed-this.velocity)*(1-Math.exp(-22*Math.min(.2,dt)));
  this.acceleration=dt>0&&dt<.25?(this.velocity-previous)/dt:0;
  const origin=this.history.reduce((lowest,p)=>p.y<lowest.y?p:lowest),rise=current.y-origin.y,sideways=Math.abs(current.x-origin.x);
  if(rise>=.05&&sideways<=Math.max(.35,rise*2)&&this.velocity>=.28){
   this.launchSpeed=Math.max(3,Math.min(6,2.8+this.velocity*.8));this.reset();this.cooldownUntil=now+1200;return true;
  }
  return false;
 }
}
