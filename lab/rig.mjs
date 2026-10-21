import {Euler,Quaternion,Vector3} from 'three';
import {screenFaceFrame} from '../controller/swing.mjs';
const radians=Math.PI/180,neutral=new Quaternion().setFromEuler(new Euler(Math.PI/2,0,0,'ZXY'));
const basis=new Quaternion().fromArray(screenFaceFrame(neutral.toArray()));
const orientation=({alpha,beta,gamma})=>new Quaternion().setFromEuler(new Euler(beta*radians,gamma*radians,alpha*radians,'ZXY'));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// World-space motion must be rotated into the phone's device axes before it
// enters DeviceMotion. In particular, the aligned phone's X points opposite
// player X. Feeding world acceleration directly fights the optical anchor.
export function rigSensors(velocity,acceleration,dt,previous={alpha:0,beta:90,gamma:0}){
 const angles={alpha:clamp(velocity[0]*3,-8,8),beta:90+clamp(velocity[1]*3,-8,8),gamma:0};
 const current=orientation(angles),relative=neutral.clone().invert().multiply(current),mapped=basis.clone().multiply(relative),inverse=mapped.clone().invert();
 const a=new Vector3(...acceleration).applyQuaternion(inverse).toArray(),g=new Vector3(0,9.80665,0).applyQuaternion(inverse).toArray();
 const change=orientation(previous).invert().multiply(current);if(change.w<0)change.set(-change.x,-change.y,-change.z,-change.w);
 const angle=2*Math.acos(clamp(change.w,-1,1)),divisor=Math.sqrt(Math.max(0,1-change.w*change.w)),scale=divisor>1e-8?angle/divisor/Math.max(.001,dt)/radians:0;
 return {...angles,a,g,rate:{alpha:change.z*scale,beta:change.x*scale,gamma:change.y*scale},relative:relative.toArray(),mapped:mapped.toArray()};
}
