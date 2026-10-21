import {readBody,BodySample,Landmark} from './poseTracking';
export interface LateralCalibration {center:number;right:number;left:number;stepUnits:number;stepCm:number}
export const median=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);if(!v.length)throw Error('No confident camera samples');return (v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;};
export function stance(samples:BodySample[]){
 if(samples.length<15)throw Error('Not enough visible hips/shoulders. Stay in view and retry calibration.');
 const center=median(samples.map(s=>s.hipX));
 if(Math.sqrt(samples.reduce((sum,s)=>sum+(s.hipX-center)**2,0)/samples.length)>.025)throw Error('That stance was moving. Hold still on each marker and retry.');
 return center;
}
export function calibrateLateral(center:number,right:number,left:number,stepCm:number):LateralCalibration {
 if(![center,right,left,stepCm].every(Number.isFinite)||stepCm<15||stepCm>80)throw Error('Use a marker distance between 15 and 80 cm.');
 if(center-right<.025||left-center<.025)throw Error('Side positions were too close or reversed. Face the camera and use your left/right markers.');
 return {center,right,left,stepUnits:stepCm/50,stepCm};
}
export function lateralTarget(hipX:number,c:LateralCalibration){
 const distance=c.center-hipX,span=distance>=0?c.center-c.right:c.left-c.center;
 const value=distance/span*c.stepUnits;
 return Math.abs(value)<.025?0:Math.max(-1.9,Math.min(1.9,value));
}
export function shoulderBody(points:Landmark[]):BodySample|null {
 const a=points[11],b=points[12];if(!a||!b||[a,b].some(p=>(p.visibility??0)<.65||![p.x,p.y].every(Number.isFinite)))return null;
 const shoulderWidth=Math.abs(a.x-b.x);if(shoulderWidth<.035)return null;
 return {hipX:(a.x+b.x)/2,hipY:(a.y+b.y)/2+.18,shoulderWidth,lean:0,confidence:Math.min(a.visibility??0,b.visibility??0)};
}
export function estimateCalibration(samples:BodySample[]):LateralCalibration {
 const center=median(samples.map(s=>s.hipX)),width=median(samples.map(s=>s.shoulderWidth));
 return calibrateLateral(center,center-Math.max(.04,width),center+Math.max(.04,width),40);
}
export class WebcamBodyMapper {
 calibration:LateralCalibration|null=null;x=0;lastGood=-Infinity;lastResult=-Infinity;lastTime=0;confidence=0;
 update(points:Landmark[],now:number,capturedAt=now,shouldersOnly=false){
  const dt=this.lastTime?Math.max(0,Math.min(.1,(now-this.lastTime)/1000)):1/30;this.lastTime=now;this.lastResult=now;
  const body=shouldersOnly?shoulderBody(points):readBody(points);
  if(body&&now-capturedAt<500){this.lastGood=now;this.confidence=body.confidence;if(this.calibration){if(shouldersOnly){const oldSpan=this.calibration.center-this.calibration.right,span=oldSpan+(Math.max(.04,body.shoulderWidth)-oldSpan)*(1-Math.exp(-2*dt));this.calibration.right=this.calibration.center-span;this.calibration.left=this.calibration.center+span;}const target=lateralTarget(body.hipX,this.calibration);this.x+=(target-this.x)*(1-Math.exp(-20*dt));}}
  else this.confidence=0;
  return body;
 }
 safe(now:number){return !!this.calibration&&now-this.lastGood<500&&now-this.lastResult<500;}
}
