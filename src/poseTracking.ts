export interface Landmark {x:number;y:number;z:number;visibility?:number}
export interface BodySample {hipX:number;hipY:number;shoulderWidth:number;lean:number;confidence:number}
export function readBody(points:Landmark[]):BodySample|null {
 const ids=[11,12,23,24];
 if(ids.some(i=>!points[i]||![points[i].x,points[i].y].every(Number.isFinite)))return null;
 const confidence=Math.min(...ids.map(i=>points[i].visibility??0));
 const shoulderWidth=Math.abs(points[11].x-points[12].x);
 if(!Number.isFinite(confidence)||confidence<.65||shoulderWidth<.035||ids.some(i=>points[i].x<0||points[i].x>1||points[i].y<0||points[i].y>1))return null;
 const hipX=(points[23].x+points[24].x)/2,hipY=(points[23].y+points[24].y)/2;
 return {hipX,hipY,shoulderWidth,lean:((points[11].x+points[12].x)/2-hipX)/shoulderWidth,confidence};
}
export class BodyTracker {
 neutral:BodySample|null=null;history:BodySample[]=[];x=0;lastValid=-Infinity;lastTime=0;
 calibrate(){if(this.history.length<10||this.lastTime-this.lastValid>150)return false;const samples=this.history.slice(-30);this.neutral=Object.fromEntries(Object.keys(samples[0]).map(k=>[k,samples.reduce((n,s)=>n+s[k as keyof BodySample],0)/samples.length])) as unknown as BodySample;this.x=0;return true;}
 update(points:Landmark[],time:number){
  const body=readBody(points),dt=this.lastTime?Math.max(0,Math.min(.1,(time-this.lastTime)/1000)):1/30;this.lastTime=time;
  if(body){this.lastValid=time;this.history.push(body);if(this.history.length>30)this.history.shift();}else if(time-this.lastValid>500)this.history=[];
  const raw=body&&this.neutral?(this.neutral.hipX-body.hipX)/this.neutral.shoulderWidth:null;
  if(raw!==null){const target=Math.abs(raw)<.025?0:Math.max(-3,Math.min(3,raw));this.x+=(target-this.x)*(1-Math.exp(-20*dt));}
  return {body,raw,x:this.x,gameX:Math.max(-1.9,Math.min(1.9,this.x*.9)),lean:body&&this.neutral?body.lean-this.neutral.lean:null,state:body?(this.neutral?'tracking':'uncalibrated'):time-this.lastValid<500?'hold':'lost'};
 }
}
export const POSE_TRIAL=[
 {seconds:5,id:'neutral',text:'Stand at CENTER. Hold still; arms relaxed.'},
 {seconds:6,id:'right',text:'Step onto your RIGHT marker and HOLD.'},
 {seconds:4,id:'center-1',text:'Return to CENTER and hold.'},
 {seconds:6,id:'left',text:'Step onto your LEFT marker and HOLD.'},
 {seconds:4,id:'center-2',text:'Return to CENTER and hold.'},
 {seconds:8,id:'arms-only',text:'Keep your feet and hips STILL. Swing your paddle arm.'},
 {seconds:6,id:'side-steps',text:'Move LEFT ↔ RIGHT naturally. Keep facing the screen.'},
 {seconds:5,id:'neutral-end',text:'Return to CENTER. Hold still until finished.'},
];
export function stageAt(seconds:number){let start=0;for(const stage of POSE_TRIAL){if(seconds<start+stage.seconds)return {...stage,remaining:start+stage.seconds-seconds};start+=stage.seconds;}return null;}
export function percentile(values:number[],fraction:number){if(!values.length)return null;const ordered=[...values].sort((a,b)=>a-b);return ordered[Math.min(ordered.length-1,Math.floor((ordered.length-1)*fraction))];}
