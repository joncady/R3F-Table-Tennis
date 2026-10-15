import fs from 'node:fs';
import {SwingTracker} from './swing.mjs';
import {SwingTracker as Baseline} from '../tests/fixtures/swing-baseline.mjs';
const directory=new URL('./.trials/',import.meta.url);
const files=fs.existsSync(directory)?fs.readdirSync(directory).filter(n=>n.endsWith('.json')).sort().reverse():[];
let data;
for(const name of files){const candidate=JSON.parse(fs.readFileSync(new URL(name,directory)));if(!candidate.synthetic&&!candidate.partial&&candidate.rows?.length){data=candidate;break;}}
if(!data){console.log('No complete real trial available. This comparison stays local.');process.exit(0);}
const report=[];
for(const [name,Tracker]of [['previous',Baseline],['tuned',SwingTracker]]){
 const tracker=new Tracker();
 const rows=data.rows.map(r=>({...r,estimate:tracker.update(r.a,r.dt,r.angular)}));
 for(const stage of ['lateral-fixed-face','natural-swings','still-after']){
  const selected=rows.filter(r=>r.stage===stage);if(!selected.length)continue;
  const clipped=selected.filter(({estimate:p})=>p[0]<-2/3||p[0]>2/3||p[1]<-.4||p[1]>.45||p[2]<-.3||p[2]>.225).length;
  report.push({tracker:name,stage,spanCmXYZ:[0,1,2].map(i=>+(100*(Math.max(...selected.map(r=>r.estimate[i]))-Math.min(...selected.map(r=>r.estimate[i])))).toFixed(1)),clippedPercent:+(100*clipped/selected.length).toFixed(1)});
 }
}
console.table(report);
console.log('Local replay only: no measured hand-position ground truth. Clipping uses current default 2× reach / 1.5× lateral gain; source trial remains private.');
