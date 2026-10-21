import type {Landmark} from './poseTracking';
export interface CameraHand {x:number;y:number;at:number}
export function cameraHand(points:Landmark[],hand:'left'|'right',at:number,aspect=9/16):CameraHand|undefined {
 const left=points[11],right=points[12],wrist=points[hand==='left'?15:16];
 if(!left||!right||!wrist||[left,right,wrist].some(p=>(p.visibility??0)<.6||![p.x,p.y].every(Number.isFinite)))return;
 const span=Math.abs(left.x-right.x);if(span<.035)return;
 return {x:Math.max(-2.4,Math.min(2.4,((left.x+right.x)/2-wrist.x)/span*.8)),y:Math.max(1.2,Math.min(3.2,2.8-(wrist.y-(left.y+right.y)/2)*aspect/span*.8)),at};
}
// Camera anchors hand position; fast inertial residuals bridge camera frames.
export class PaddleAnchor {
 x=0;y=1.9;slow=[0,0];active=false;lastHand:CameraHand|undefined;
 update(hand:CameraHand|undefined,swing:[number,number,number]|undefined,playingHand:'left'|'right',now:number,dt:number):[number,number,number]|undefined {
  if(hand)this.lastHand=hand;else hand=this.lastHand;
  if(!hand||now-hand.at>300){this.active=false;return swing;}
  const raw=swing??[0,0,0],alpha=1-Math.exp(-22*Math.min(.1,Math.max(0,dt)));
  if(!this.active){this.x=hand.x;this.y=hand.y;this.slow=[raw[0],raw[1]];this.active=true;}
  this.x+=(hand.x-this.x)*alpha;this.y+=(hand.y-this.y)*alpha;
  const low=1-Math.exp(-6*Math.min(.1,Math.max(0,dt)));
  this.slow[0]+=(raw[0]-this.slow[0])*low;this.slow[1]+=(raw[1]-this.slow[1])*low;
  return [this.x-(playingHand==='right'?.55:-.55)+Math.max(-.3,Math.min(.3,(raw[0]-this.slow[0])*.4)),this.y-1.9+Math.max(-.2,Math.min(.2,(raw[1]-this.slow[1])*.3)),raw[2]];
 }
}

export function bladeCenter(grip:CameraHand,rotation:[number,number,number,number],distance=.42){
 const [qx,qy,qz,qw]=rotation,tx=-2*qz*distance,tz=2*qx*distance;
 return {x:grip.x+qw*tx+qy*tz,y:grip.y+distance+qz*tx-qx*tz,z:qw*tz-qy*tx,at:grip.at};
}
