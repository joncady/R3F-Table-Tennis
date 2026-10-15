import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const page=fs.readFileSync(new URL('../controller/phone.html',import.meta.url),'utf8');
const source=page.split('<script type="module">')[1].split('</script>')[0];
execFileSync(process.execPath,['--check','--input-type=module'],{input:source});
import {SwingTracker,rotateVector,gripFrame,mappedRotation} from '../controller/swing.mjs';
const make=()=>{const t=new SwingTracker();for(let i=0;i<40;i++)t.update([.08,-.04,.03],1/60);return t;};
const idle=make();for(let i=0;i<600;i++)idle.update([.08,-.04,.03],1/60);
assert.ok(Math.hypot(...idle.offset)<1e-8,'Stationary bias should not move the hand');
for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
 const t=make();const acceleration=[.08,-.04,.03];acceleration[axis]+=sign*5;
 for(let i=0;i<15;i++)t.update(acceleration,1/60);
 assert.ok(t.offset[axis]*sign>.025,`Acceleration must move hand along axis ${axis}`);
 for(let i=0;i<600;i++)t.update([.08,-.04,.03],1/60);
 assert.ok(Math.hypot(...t.offset)<.0001,'Motion should settle at rest');assert.deepEqual(t.velocity,[0,0,0]);
}
const drift=make();for(let i=0;i<6000;i++)drift.update([25,25,-25],1/60);
assert.ok(Math.abs(drift.offset[0])<=.8&&Math.abs(drift.offset[1])<=.55&&Math.abs(drift.offset[2])<=.5);
drift.update([0,0,0],.5);assert.deepEqual(drift.offset,[0,0,0]);assert.deepEqual(drift.velocity,[0,0,0]);
drift.update([NaN,0,0],1/60);assert.ok(drift.offset.every(Number.isFinite));
const turned=rotateVector([1,0,0],[0,0,Math.SQRT1_2,Math.SQRT1_2]);assert.ok(Math.abs(turned[0])<1e-9&&Math.abs(turned[1]-1)<1e-9);
const rotating=new SwingTracker();for(let i=0;i<120;i++)rotating.update([0,0,0],1/60,1);assert.equal(rotating.calibration,0,'Calibration must wait for a quiet pose');
console.log('Passed: bias calibration, 3-axis signed movement, rest/velocity reset, drift bounds, stale samples, invalid input, frame rotation, calibration guard.');

const gentle=make();for(let i=0;i<15;i++)gentle.update([2.08,-.04,.03],1/60);
const reached=gentle.offset[0];assert.ok(reached>.035,'A modest sideways stroke must produce visible displacement');
for(let i=0;i<30;i++)gentle.update([.08,-.04,.03],1/60);
assert.ok(gentle.offset[0]>=reached*.95,'Lateral position should remain during the short hold instead of snapping back');
console.log('Passed: modest lateral stroke response and displacement retention.');

const interrupted=new SwingTracker();for(let i=0;i<20;i++)interrupted.update([.08,0,0],1/60);
assert.ok(interrupted.calibration>0);interrupted.update([2,0,0],1/60,1);
assert.equal(interrupted.calibration,0);assert.deepEqual(interrupted.bias,[0,0,0]);
for(let i=0;i<30;i++)interrupted.update([.08,0,0],1/60);
assert.ok(interrupted.calibration>=.4);assert.ok(Math.abs(interrupted.bias[0]-.08)<1e-9);
console.log('Passed: calibration requires a continuous quiet hold and rejects interrupted bias samples.');

const grip=gripFrame([-1,0,0],[0,1,0]);assert.ok(grip);
const mappedRight=rotateVector([0,1,0],grip),mappedUp=rotateVector([-1,0,0],grip);
assert.ok(Math.abs(mappedRight[0]-1)<1e-9&&Math.abs(mappedUp[1]-1)<1e-9,'A sideways grip must map measured right and gravity into game right/up');
const original=[Math.sin(.3),0,0,Math.cos(.3)];const mapped=mappedRotation(original,grip);
assert.ok(Math.abs(mapped[3]-original[3])<1e-9&&Math.abs(Math.hypot(...mapped)-1)<1e-9,'Grip alignment must preserve 1:1 rotation angle');
assert.equal(gripFrame([0,1,0],[0,2,0]),null,'An upward gesture cannot calibrate sideways');
console.log('Passed: natural-grip coordinate alignment, signed rightward direction, 1:1 orientation, and invalid lateral calibration.');
