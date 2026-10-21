import assert from 'node:assert/strict';
import {rigSensors} from './rig.mjs';
import {accelerationInNeutral,rotateVector,screenFaceFrame} from '../controller/swing.mjs';
const neutral=[Math.SQRT1_2,0,0,Math.SQRT1_2],basis=screenFaceFrame(neutral);
const close=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${v} != ${b[i]}`));
close(rigSensors([0,0],[1,0,0],.02).a,[-1,0,0]);
for(const velocity of [[0,0],[1,-.8],[-2,1.5],[.1,.2]])for(const world of [[1,0,0],[0,2,0],[-3,4,1]]){
 const sample=rigSensors(velocity,world,.05);
 close(rotateVector(accelerationInNeutral(sample.a,null,sample.relative,neutral),basis),world);
 close(rotateVector(accelerationInNeutral(null,sample.a.map((v,i)=>v+sample.g[i]),sample.relative,neutral),basis),world);
 assert.ok(Object.values(sample.rate).every(Number.isFinite));
}
assert.deepEqual(rigSensors([0,0],[0,0,0],.02).rate,{alpha:0,beta:0,gamma:0});
console.log('Passed: virtual phone device-axis acceleration/gravity round trips through the shipped controller, including both swing directions and tilt.');
