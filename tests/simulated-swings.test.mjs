import assert from 'node:assert/strict';
import {configs,trials,simulate} from '../controller/simulate-swings.mjs';
import {SwingTracker,accelerationInNeutral,rotateVector} from '../controller/swing.mjs';
import {SwingTracker as Baseline} from './fixtures/swing-baseline.mjs';
const results=trials();
const byId=id=>results.find(r=>r.config.id===id);
for(const r of results){assert.ok(r.tuned.rows.every(row=>row.estimate.every(Number.isFinite)));assert.ok(r.tuned.rmsCm<=r.baseline.rmsCm+1e-8,`${r.config.id}: regression`);}
assert.ok(Math.abs(byId('left-handed-lateral').tuned.trackedSpanCm-50)<3);
assert.ok(byId('slow-lateral').tuned.rmsCm<byId('slow-lateral').baseline.rmsCm*.5);
assert.ok(byId('irregular-30hz').tuned.rmsCm<byId('irregular-30hz').baseline.rmsCm*.5);
assert.ok(byId('noisy-wrist-only').tuned.trackedSpanCm<2,'Wrist rotation must not create substantial translation');
// Fresh mixed cases, defined after selecting the tuning. Aggregate error is the
// acceptance criterion, not a promise of improvement for every possible stroke.
const fresh=Array.from({length:20},(_,i)=>({id:`fresh-${i}`,sweep:[(i%2?1:-1)*(.14+(i%5)*.037),.02+(i%4)*.027,-.04-(i%3)*.04],duration:.37+(i%7)*.117,hz:[27,45,75,110,60][i%5],noise:.045+(i%4)*.019,jitter:true,rotate:i%3!==1,grip:i%4!==1,continuous:i%5===1,seed:9013+i*17}));
const baseMean=fresh.reduce((s,c)=>s+simulate(c,Baseline).rmsCm,0)/fresh.length;
const newMean=fresh.reduce((s,c)=>s+simulate(c,SwingTracker).rmsCm,0)/fresh.length;
assert.ok(newMean<baseMean*.75,`Fresh-case mean ${newMean} vs ${baseMean}`);
const q=[0,Math.sin(.4),0,Math.cos(.4)],inv=[0,-q[1],0,q[3]],neutral=[Math.SQRT1_2,0,0,Math.SQRT1_2],a=[.4,-.2,.3];
const linear=rotateVector(a,inv),gravityInNeutral=rotateVector([0,0,9.80665],[-neutral[0],0,0,neutral[3]]),gravity=rotateVector(a.map((v,i)=>v+gravityInNeutral[i]),inv);
for(const sample of [accelerationInNeutral(linear,gravity,q,neutral),accelerationInNeutral(null,gravity,q,neutral)])assert.ok(Math.hypot(...sample.map((v,i)=>v-a[i]))<1e-9);
assert.equal(accelerationInNeutral(null,null,q,neutral),null);
const invalid=new SwingTracker();assert.deepEqual(invalid.update([NaN,0,0],.01),[0,0,0]);
console.log(`Passed: ${configs.length} virtual-device cases, shared Android linear/gravity conversion, 1:1 face mapping, noisy wrist-only bounds; 20 fresh cases mean error ${baseMean.toFixed(2)} → ${newMean.toFixed(2)} cm (${(100*(1-newMean/baseMean)).toFixed(0)}% lower). Synthetic accuracy only.`);
