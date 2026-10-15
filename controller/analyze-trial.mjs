import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=path.join(path.dirname(fileURLToPath(import.meta.url)),'.trials');
const files=fs.existsSync(directory)?fs.readdirSync(directory).filter(f=>f.endsWith('.json')).sort().reverse():[];
let trial,filename;
for(const file of files){const data=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));if(!data.synthetic){trial=data;filename=file;break;}}
if(!trial){console.log('No real phone trial recorded yet. Run Start left-handed movement trial on the phone.');process.exit(0);}
const mean=a=>a.reduce((sum,n)=>sum+n,0)/Math.max(1,a.length);
const rms=a=>Math.sqrt(mean(a.map(n=>n*n)));
const range=a=>a.length?Math.max(...a)-Math.min(...a):0;
const report={file:filename,hand:trial.hand,partial:trial.partial,samples:trial.rows.length,stages:{}};
for(const stage of ['still-before','lateral-fixed-face','natural-swings','still-after']){
 const rows=trial.rows.filter(r=>r.stage===stage);
 const dt=rows.map(r=>r.dt).filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
 report.stages[stage]={samples:rows.length,sampleHz:dt.length?1/mean(dt):null,maxGapMs:dt.length?Math.max(...dt)*1000:null,calibratedPercent:100*mean(rows.map(r=>Number(r.calibration>=.4))),accelRmsXYZ:[0,1,2].map(i=>rms(rows.map(r=>r.a[i]))),offsetRangeCmXYZ:[0,1,2].map(i=>100*range(rows.map(r=>r.offset?.[i]??0))),filteredRmsXYZ:[0,1,2].map(i=>rms(rows.map(r=>r.filtered?.[i]??0))),gravityFallbackPercent:100*mean(rows.map(r=>Number(r.source==='gravity-fallback')))};
}
const lateral=report.stages['lateral-fixed-face'];
report.notes=[];
if(lateral.calibratedPercent<90)report.notes.push('Calibration blocked part of the movement stage; inspect stationary acceleration and angular-rate thresholds before increasing gain.');
if(lateral.maxGapMs>120)report.notes.push('Sensor gaps trigger tracker resets; inspect sampling/visibility before gain tuning.');
const dominant=lateral.accelRmsXYZ.indexOf(Math.max(...lateral.accelRmsXYZ));
report.notes.push(`Largest lateral-stage acceleration is on calibrated ${'XYZ'[dominant]}; compare against X before assuming a gain problem.`);
report.notes.push('Offset is an estimate, not measured hand travel. Match the recording with the approximate physical sweep distance before tuning gain.');
console.log(JSON.stringify(report,null,2));
